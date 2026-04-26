import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { creditBalances, tenantMembers, users, organisations } from '../db/schema.js';
import { requireUser, requireTenant, type AppEnv } from '../middleware/auth.js';
import { billingRouter } from './billing.js';
import { uploadsRouter } from './uploads.js';
import { analyticsRouter } from './analytics.js';
import { membersRouter } from './members.js';
import { teachersRouter } from './teachers.js';
import { nomenclatureRouter } from './nomenclature.js';
import { exportRouter } from './export.js';

/**
 * Tenant-scoped routes — mounted at /api/t/:tenantSlug/*
 * Every endpoint here is gated by requireTenant middleware.
 */
export const tenantRouter = new Hono<AppEnv>();

tenantRouter.use('*', requireUser, requireTenant);

// Sub-routers
tenantRouter.route('/billing', billingRouter);
tenantRouter.route('/uploads', uploadsRouter);
tenantRouter.route('/analytics', analyticsRouter);
tenantRouter.route('/members', membersRouter);
tenantRouter.route('/teachers', teachersRouter);
tenantRouter.route('/nomenclature', nomenclatureRouter);
tenantRouter.route('/export', exportRouter);

/**
 * GET /api/t/:tenantSlug — tenant overview (current user's view)
 * Credits are fetched from the org-level balance.
 */
tenantRouter.get('/', async (c) => {
  const tenant = c.get('tenant')!;

  // Fetch org-level credits
  const balance = tenant.orgId
    ? await db.query.creditBalances.findFirst({
        where: eq(creditBalances.orgId, tenant.orgId),
      })
    : null;

  // Fetch org metadata (workspace limit info)
  const org = tenant.orgId
    ? await db.query.organisations.findFirst({
        where: eq(organisations.id, tenant.orgId),
        columns: { id: true, name: true, slug: true, maxWorkspaces: true },
      })
    : null;

  return c.json({
    tenant: {
      id: tenant.tenantId,
      slug: tenant.tenantSlug,
      name: tenant.tenantName,
      orgId: tenant.orgId,
    },
    org,
    membership: {
      role: tenant.role,
    },
    credits: {
      balance: balance?.balance ?? 0,
      lifetimePurchased: balance?.lifetimePurchased ?? 0,
      lifetimeSpent: balance?.lifetimeSpent ?? 0,
    },
  });
});

/**
 * GET /api/t/:tenantSlug/members — list team members
 */
tenantRouter.get('/members', async (c) => {
  const tenant = c.get('tenant')!;
  const members = await db
    .select({
      userId: tenantMembers.userId,
      role: tenantMembers.role,
      joinedAt: tenantMembers.createdAt,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.userId, users.id))
    .where(eq(tenantMembers.tenantId, tenant.tenantId));

  return c.json({ members });
});
