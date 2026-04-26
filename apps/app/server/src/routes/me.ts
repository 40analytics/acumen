import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenantMembers, tenants, orgMembers, organisations } from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';

export const meRouter = new Hono<AppEnv>();

meRouter.use('*', requireUser);

/**
 * GET /api/me — current user + their tenant memberships + org memberships
 */
meRouter.get('/', async (c) => {
  const user = c.get('user');

  const [memberships, orgMemberships] = await Promise.all([
    db
      .select({
        tenantId: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        logoUrl: tenants.logoUrl,
        orgId: tenants.orgId,
        role: tenantMembers.role,
        joinedAt: tenantMembers.createdAt,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(eq(tenantMembers.userId, user.id)),

    db
      .select({
        orgId: organisations.id,
        slug: organisations.slug,
        name: organisations.name,
        maxWorkspaces: organisations.maxWorkspaces,
        emailDomain: organisations.emailDomain,
        role: orgMembers.role,
        joinedAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .innerJoin(organisations, eq(orgMembers.orgId, organisations.id))
      .where(eq(orgMembers.userId, user.id)),
  ]);

  const actor = c.get('actor');

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    },
    tenants: memberships.filter((m) => m.tenantId),
    orgs: orgMemberships,
    impersonation: actor
      ? {
          realEmail: actor.realUserEmail,
          realName: actor.realUserName,
        }
      : null,
  });
});
