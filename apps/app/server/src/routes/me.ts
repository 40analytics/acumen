import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, tenantMembers, tenants, orgMembers, organisations } from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';

export const meRouter = new Hono<AppEnv>();

meRouter.use('*', requireUser);

/**
 * GET /api/me — current user + their tenant memberships + org memberships
 */
meRouter.get('/', async (c) => {
  const user = c.get('user');

  const [memberships, orgMemberships, userProfile] = await Promise.all([
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

    db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, user.id))
      .then((rows) => rows[0] ?? null),
  ]);

  const actor = c.get('actor');

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: userProfile?.phone ?? null,
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

/**
 * PATCH /api/me — update the current user's display name and phone.
 */
meRouter.patch(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(80).trim().optional(),
      phone: z.string().max(40).trim().optional().or(z.literal('')),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');

    const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.phone !== undefined) updates.phone = input.phone || null;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, phone: users.phone });

    return c.json({ user: updated });
  }
);
