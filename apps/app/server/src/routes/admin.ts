import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  tenants,
  tenantMembers,
  creditBalances,
  creditTransactions,
  creditPurchases,
  uploads,
  users,
  adminAuditLog,
  impersonationSessions,
} from '../db/schema.js';
import { requireUser, requireSuperAdmin, type AppEnv } from '../middleware/auth.js';

export const adminRouter = new Hono<AppEnv>();

// /api/admin/stop-impersonate is the only route that bypasses requireSuperAdmin
// (because while impersonating, the user *isn't* super admin). It needs to
// run with just requireUser, then verify there's an active impersonation
// for this session.
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

// Everything else requires super admin
adminRouter.use('*', requireUser, requireSuperAdmin);

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
      createdAt: tenants.createdAt,
      memberCount: sql<number>`(SELECT count(*)::int FROM ${tenantMembers} WHERE tenant_id = ${tenants.id})`,
      uploadCount: sql<number>`(SELECT count(*)::int FROM ${uploads} WHERE tenant_id = ${tenants.id})`,
      creditBalance: sql<number>`COALESCE((SELECT balance FROM ${creditBalances} WHERE tenant_id = ${tenants.id}), 0)`,
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
    db.query.creditBalances.findFirst({ where: eq(creditBalances.tenantId, tenantId) }),
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
    db
      .select()
      .from(creditPurchases)
      .where(eq(creditPurchases.tenantId, tenantId))
      .orderBy(desc(creditPurchases.createdAt))
      .limit(20),
  ]);

  return c.json({ tenant, balance, members, recentUploads, recentTxns, recentPurchases });
});

// ─── CREDIT GRANTS / REVOKES ────────────────────────────
const grantSchema = z.object({
  amount: z.number().int().positive().max(1000),
  note: z.string().max(200).optional(),
});

adminRouter.post('/tenants/:tenantId/credits/grant', zValidator('json', grantSchema), async (c) => {
  const tenantId = c.req.param('tenantId');
  const { amount, note } = c.req.valid('json');
  const actor = c.get('user');

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${amount}`,
        lifetimePurchased: sql`${creditBalances.lifetimePurchased} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.tenantId, tenantId))
      .returning({ balance: creditBalances.balance });
    if (!updated) throw new Error('Tenant has no credit balance row');

    const [txn] = await tx
      .insert(creditTransactions)
      .values({
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
      metadata: { amount, note, transactionId: txn.id, balanceAfter: updated.balance },
      ipAddress: c.req.header('x-forwarded-for') ?? null,
    });

    return { balance: updated.balance };
  });

  return c.json(result);
});

adminRouter.post('/tenants/:tenantId/credits/revoke', zValidator('json', grantSchema), async (c) => {
  const tenantId = c.req.param('tenantId');
  const { amount, note } = c.req.valid('json');
  const actor = c.get('user');

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`GREATEST(${creditBalances.balance} - ${amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.tenantId, tenantId))
      .returning({ balance: creditBalances.balance });
    if (!updated) throw new Error('Tenant has no credit balance row');

    const [txn] = await tx
      .insert(creditTransactions)
      .values({
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
      metadata: { amount, note, transactionId: txn.id, balanceAfter: updated.balance },
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
  const session = c.get('session');
  const actor = c.get('user');
  const { userId, reason } = c.req.valid('json');

  if (userId === actor.id) {
    return c.json({ error: "You can't impersonate yourself." }, 400);
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return c.json({ error: 'User not found' }, 404);

  // Refuse to impersonate another super admin
  if (target.isSuperAdmin) {
    return c.json({ error: "Can't impersonate another super admin." }, 403);
  }

  // End any prior active impersonation on this session
  await db
    .update(impersonationSessions)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(impersonationSessions.sessionId, session.id),
        isNull(impersonationSessions.endedAt)
      )
    );

  const [imp] = await db
    .insert(impersonationSessions)
    .values({
      sessionId: session.id,
      impersonatedUserId: target.id,
      startedById: actor.id,
      reason: reason ?? null,
    })
    .returning();

  await db.insert(adminAuditLog).values({
    actorUserId: actor.id,
    action: 'impersonation.started',
    targetUserId: target.id,
    metadata: { reason, impersonationId: imp.id },
    ipAddress: c.req.header('x-forwarded-for') ?? null,
  });

  return c.json({
    ok: true,
    impersonating: { id: target.id, email: target.email, name: target.name },
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
