import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenantMembers, tenants } from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';

export const meRouter = new Hono<AppEnv>();

meRouter.use('*', requireUser);

/**
 * GET /api/me — current user + their tenant memberships
 */
meRouter.get('/', async (c) => {
  const user = c.get('user');
  const memberships = await db
    .select({
      tenantId: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      logoUrl: tenants.logoUrl,
      role: tenantMembers.role,
      joinedAt: tenantMembers.createdAt,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, user.id));

  const actor = c.get('actor');

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    },
    tenants: memberships.filter((m) => m.tenantId), // filter any soft-deleted
    impersonation: actor
      ? {
          realEmail: actor.realUserEmail,
          realName: actor.realUserName,
        }
      : null,
  });
});
