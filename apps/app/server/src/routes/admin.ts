import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  tenants,
  tenantMembers,
  organisations,
  creditBalances,
  creditTransactions,
  creditPurchases,
  uploads,
  users,
  adminAuditLog,
  impersonationSessions,
} from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';
import { requireAdminToken, ADMIN_EMAIL } from '../middleware/adminAuth.js';

export const adminRouter = new Hono<AppEnv>();

// /api/admin/stop-impersonate is called from the CUSTOMER portal while
// the admin is impersonating someone. At that point the browser has a
// Better Auth session (for the impersonated user) but NOT the admin cookie.
// So this one route still uses requireUser + actor validation.
adminRouter.post('/stop-impersonate', requireUser, async (c) => {
  const session = c.get('session');
  const actor = c.get('actor');
  if (!actor) {
    return c.json({ error: 'Not currently impersonating' }, 400);
  }
  await db
    .update(impersonationSessions)
    .set({ endedAt: new Date() })
    .where(eq(impersonationSessions.id, actor.impersonationId));

  await db.insert(adminAuditLog).values({
    actorUserId: actor.realUserId,
    action: 'impersonation.stopped',
    targetUserId: c.get('user').id,
    metadata: { sessionId: session.id, impersonationId: actor.impersonationId },
    ipAddress: c.req.header('x-forwarded-for') ?? null,
  });
  return c.json({ ok: true });
});

// Everything else requires the dedicated admin token cookie
adminRouter.use('*', requireAdminToken);

// ─── DASHBOARD ──────────────────────────────────────────
adminRouter.get('/stats', async (c) => {
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM ${tenants}) AS total_tenants,
      (SELECT count(*)::int FROM ${users}) AS total_users,
      (SELECT count(*)::int FROM ${uploads}) AS total_uploads,
      (SELECT COALESCE(sum(balance), 0)::int FROM ${creditBalances}) AS total_credits_in_circulation,
      (SELECT COALESCE(sum(lifetime_spent), 0)::int FROM ${creditBalances}) AS total_credits_spent,
      (SELECT COALESCE(sum(amount_kobo), 0)::bigint FROM ${creditPurchases} WHERE status = 'success') AS total_revenue_kobo
  `);
  const stats = result.rows[0];
  return c.json({ stats });
});

adminRouter.get('/tenants', async (c) => {
  const rows = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      orgId: tenants.orgId,
      createdAt: tenants.createdAt,
      memberCount: sql<number>`(SELECT count(*)::int FROM ${tenantMembers} WHERE tenant_id = ${tenants.id})`,
      uploadCount: sql<number>`(SELECT count(*)::int FROM ${uploads} WHERE tenant_id = ${tenants.id})`,
      creditBalance: sql<number>`COALESCE((SELECT cb.balance FROM ${creditBalances} cb WHERE cb.org_id = ${tenants.orgId}), 0)`,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
  return c.json({ tenants: rows });
});

// ─── TENANT DRILLDOWN ───────────────────────────────────
adminRouter.get('/tenants/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

  const [balance, members, recentUploads, recentTxns, recentPurchases] = await Promise.all([
    tenant.orgId
      ? db.query.creditBalances.findFirst({ where: eq(creditBalances.orgId, tenant.orgId) })
      : Promise.resolve(null),
    db
      .select({
        userId: tenantMembers.userId,
        role: tenantMembers.role,
        joinedAt: tenantMembers.createdAt,
        email: users.email,
        name: users.name,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.userId, users.id))
      .where(eq(tenantMembers.tenantId, tenantId))
      .orderBy(desc(tenantMembers.createdAt)),
    db
      .select()
      .from(uploads)
      .where(eq(uploads.tenantId, tenantId))
      .orderBy(desc(uploads.createdAt))
      .limit(20),
    db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.tenantId, tenantId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20),
    tenant.orgId
      ? db
          .select()
          .from(creditPurchases)
          .where(eq(creditPurchases.orgId, tenant.orgId))
          .orderBy(desc(creditPurchases.createdAt))
          .limit(20)
      : Promise.resolve([]),
  ]);

  return c.json({ tenant, balance, members, recentUploads, recentTxns, recentPurchases });
});

// ─── Helpers ─────────────────────────────────────────────
/** Resolve the admin's own DB user row (needed for audit trails + FK constraints). */
async function getAdminActor() {
  const actor = await db.query.users.findFirst({ where: eq(users.email, ADMIN_EMAIL) });
  if (!actor) throw new Error(`Admin user not found for email ${ADMIN_EMAIL}`);
  return actor;
}

// ─── CREDIT GRANTS / REVOKES ────────────────────────────
const grantSchema = z.object({
  amount: z.number().int().positive().max(1000),
  note: z.string().max(200).optional(),
});

adminRouter.post('/tenants/:tenantId/credits/grant', zValidator('json', grantSchema), async (c) => {
  const tenantId = c.req.param('tenantId');
  const { amount, note } = c.req.valid('json');
  const actor = await getAdminActor();

  // Credits are at org level — look up the tenant's org
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!tenant?.orgId) return c.json({ error: 'Tenant has no organisation' }, 400);
  const orgId = tenant.orgId;

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${amount}`,
        lifetimePurchased: sql`${creditBalances.lifetimePurchased} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.orgId, orgId))
      .returning({ balance: creditBalances.balance });
    if (!updated) throw new Error('Organisation has no credit balance row');

    const [txn] = await tx
      .insert(creditTransactions)
      .values({
        orgId,
        tenantId,
        type: 'admin_grant',
        amount,
        balanceAfter: updated.balance,
        actorUserId: actor.id,
        note: note ?? `Admin grant by ${actor.email}`,
      })
      .returning();

    await tx.insert(adminAuditLog).values({
      actorUserId: actor.id,
      action: 'credits.grant',
      targetTenantId: tenantId,
      metadata: { amount, note, orgId, transactionId: txn.id, balanceAfter: updated.balance },
      ipAddress: c.req.header('x-forwarded-for') ?? null,
    });

    return { balance: updated.balance };
  });

  return c.json(result);
});

adminRouter.post('/tenants/:tenantId/credits/revoke', zValidator('json', grantSchema), async (c) => {
  const tenantId = c.req.param('tenantId');
  const { amount, note } = c.req.valid('json');
  const actor = await getAdminActor();

  // Credits are at org level — look up the tenant's org
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!tenant?.orgId) return c.json({ error: 'Tenant has no organisation' }, 400);
  const orgId = tenant.orgId;

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`GREATEST(${creditBalances.balance} - ${amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.orgId, orgId))
      .returning({ balance: creditBalances.balance });
    if (!updated) throw new Error('Organisation has no credit balance row');

    const [txn] = await tx
      .insert(creditTransactions)
      .values({
        orgId,
        tenantId,
        type: 'admin_revoke',
        amount: -amount,
        balanceAfter: updated.balance,
        actorUserId: actor.id,
        note: note ?? `Admin revoke by ${actor.email}`,
      })
      .returning();

    await tx.insert(adminAuditLog).values({
      actorUserId: actor.id,
      action: 'credits.revoke',
      targetTenantId: tenantId,
      metadata: { amount, note, orgId, transactionId: txn.id, balanceAfter: updated.balance },
      ipAddress: c.req.header('x-forwarded-for') ?? null,
    });

    return { balance: updated.balance };
  });

  return c.json(result);
});

// ─── USERS ──────────────────────────────────────────────
adminRouter.get('/users', async (c) => {
  const q = c.req.query('q')?.trim();
  const where = q
    ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`))
    : undefined;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isSuperAdmin: users.isSuperAdmin,
      createdAt: users.createdAt,
      tenantCount: sql<number>`(SELECT count(*)::int FROM ${tenantMembers} WHERE user_id = ${users.id})`,
    })
    .from(users)
    .where(where as any)
    .orderBy(desc(users.createdAt))
    .limit(100);
  return c.json({ users: rows });
});

// ─── IMPERSONATION ──────────────────────────────────────
const impersonateSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().max(200).optional(),
});

adminRouter.post('/impersonate', zValidator('json', impersonateSchema), async (c) => {
  const { userId, reason } = c.req.valid('json');

  // Resolve the admin's own user record from their email (stored in env / admin JWT).
  // This bridges the admin-token auth to the Better Auth user table.
  const adminUser = await db.query.users.findFirst({
    where: eq(users.email, ADMIN_EMAIL),
  });
  if (!adminUser) {
    return c.json({ error: 'Admin user record not found — ensure ADMIN_EMAIL matches a DB user.' }, 500);
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return c.json({ error: 'User not found' }, 404);
  if (target.isSuperAdmin) {
    return c.json({ error: "Can't impersonate another super admin." }, 403);
  }
  if (target.id === adminUser.id) {
    return c.json({ error: "You can't impersonate yourself." }, 400);
  }

  // Create a real Better Auth session for the impersonated user so the
  // customer portal can load their workspace normally. Middleware will detect
  // the active impersonationSession row and swap in the impersonated context.
  const { randomUUID } = await import('crypto');
  const sessionToken = randomBytes(32).toString('hex');
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 4 * 1000); // 4 h max impersonation

  await db.execute(sql`
    INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
    VALUES (${sessionId}, ${target.id}, ${sessionToken}, ${expiresAt.toISOString()},
            ${c.req.header('x-forwarded-for') ?? null}, ${c.req.header('user-agent') ?? null},
            NOW(), NOW())
  `);

  const [imp] = await db
    .insert(impersonationSessions)
    .values({
      sessionId,
      impersonatedUserId: target.id,
      startedById: adminUser.id,
      reason: reason ?? null,
    })
    .returning();

  await db.insert(adminAuditLog).values({
    actorUserId: adminUser.id,
    action: 'impersonation.started',
    targetUserId: target.id,
    metadata: { reason, impersonationId: imp.id, sessionId },
    ipAddress: c.req.header('x-forwarded-for') ?? null,
  });

  // The cookie the customer portal will pick up
  const IS_PROD = process.env.NODE_ENV === 'production';
  const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? '';
  const cookieOpts = [
    `better-auth.session_token=${sessionToken}`,
    `HttpOnly`,
    `SameSite=Lax`,
    IS_PROD ? 'Secure' : '',
    `Path=/`,
    `Max-Age=${60 * 60 * 4}`,
    COOKIE_DOMAIN ? `Domain=${COOKIE_DOMAIN}` : '',
  ].filter(Boolean).join('; ');

  c.header('Set-Cookie', cookieOpts);

  // Return the target's first tenant slug so the client can navigate there
  const firstMembership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.tenantId, target.id),
    with: { tenant: true },
  });

  return c.json({
    ok: true,
    impersonating: { id: target.id, email: target.email, name: target.name },
    tenantSlug: (firstMembership as any)?.tenant?.slug ?? null,
  });
});

// ─── AUDIT LOG ──────────────────────────────────────────
adminRouter.get('/audit-log', async (c) => {
  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      actorUserId: adminAuditLog.actorUserId,
      actorEmail: users.email,
      actorName: users.name,
      targetTenantId: adminAuditLog.targetTenantId,
      targetUserId: adminAuditLog.targetUserId,
      metadata: adminAuditLog.metadata,
      ipAddress: adminAuditLog.ipAddress,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.actorUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(200);
  return c.json({ entries: rows });
});
