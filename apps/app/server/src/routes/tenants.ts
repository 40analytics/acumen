import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  tenants,
  tenantMembers,
  creditBalances,
  organisations,
  orgMembers,
} from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';
import { createTenantSchema, createOrgWithWorkspaceSchema } from '@acumen/shared';

export const tenantsRouter = new Hono<AppEnv>();

tenantsRouter.use('*', requireUser);

/**
 * POST /api/tenants — create a new workspace.
 * If the user already has an org (from a previous workspace), creates the workspace under it.
 * If the user has no org, creates a personal org named after the workspace first.
 */
tenantsRouter.post('/', zValidator('json', createTenantSchema), async (c) => {
  const user = c.get('user');
  const input = c.req.valid('json');

  // Check slug availability
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, input.slug),
  });
  if (existing) {
    return c.json({ error: 'This URL is already taken — try another.' }, 409);
  }

  // Find the user's primary org (the org they own, or the first org they belong to)
  const existingOrgMembership = await db.query.orgMembers.findFirst({
    where: eq(orgMembers.userId, user.id),
    with: { org: true },
  });

  const tenant = await db.transaction(async (tx) => {
    let orgId: string;

    if (existingOrgMembership) {
      // Add workspace to their existing org
      orgId = existingOrgMembership.orgId;

      // Check workspace limit
      const org = existingOrgMembership.org;
      const [{ wsCount }] = await tx
        .select({ wsCount: count() })
        .from(tenants)
        .where(eq(tenants.orgId, orgId));
      if (wsCount >= org.maxWorkspaces) {
        throw Object.assign(new Error('workspace_limit'), {
          orgName: org.name,
          limit: org.maxWorkspaces,
        });
      }
    } else {
      // No org yet — create a personal org named after the workspace
      const orgSlug = input.slug; // reuse workspace slug for the org
      const [org] = await tx
        .insert(organisations)
        .values({
          slug: orgSlug,
          name: input.name,
          maxWorkspaces: 1,
        })
        .returning();
      orgId = org.id;

      await tx.insert(orgMembers).values({
        orgId: org.id,
        userId: user.id,
        role: 'owner',
      });

      // Seed the org credit balance (1 free credit for first workspace)
      await tx.insert(creditBalances).values({
        orgId: org.id,
        balance: 1,
        lifetimePurchased: 0,
        lifetimeSpent: 0,
      });
    }

    const [created] = await tx
      .insert(tenants)
      .values({ slug: input.slug, name: input.name, orgId })
      .returning();

    await tx.insert(tenantMembers).values({
      tenantId: created.id,
      userId: user.id,
      role: 'owner',
    });

    return created;
  });

  return c.json({ tenant }, 201);
});

/**
 * POST /api/tenants/with-org — create an org + first workspace together (onboarding).
 * Used by the onboarding flow when the user wants to set an explicit org name.
 */
tenantsRouter.post(
  '/with-org',
  zValidator('json', createOrgWithWorkspaceSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');

    // Ensure no slug conflict
    const slugConflict = await db.query.tenants.findFirst({
      where: eq(tenants.slug, input.workspaceSlug),
    });
    if (slugConflict) {
      return c.json({ error: 'This workspace URL is already taken — try another.' }, 409);
    }

    // Check if user already has an org
    const existing = await db.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, user.id),
    });
    if (existing) {
      return c.json({ error: 'You already belong to an organisation.' }, 409);
    }

    const result = await db.transaction(async (tx) => {
      // Derive org slug from workspace slug (org and workspace can share slug in different tables)
      const [org] = await tx
        .insert(organisations)
        .values({
          slug: input.workspaceSlug,
          name: input.orgName,
          emailDomain: input.emailDomain || null,
          maxWorkspaces: 1,
        })
        .returning();

      await tx.insert(orgMembers).values({
        orgId: org.id,
        userId: user.id,
        role: 'owner',
      });

      await tx.insert(creditBalances).values({
        orgId: org.id,
        balance: 1,
        lifetimePurchased: 0,
        lifetimeSpent: 0,
      });

      const [workspace] = await tx
        .insert(tenants)
        .values({
          slug: input.workspaceSlug,
          name: input.workspaceName,
          countryCode: input.countryCode || null,
          orgId: org.id,
        })
        .returning();

      await tx.insert(tenantMembers).values({
        tenantId: workspace.id,
        userId: user.id,
        role: 'owner',
        jobTitle: input.userJobTitle || null,
      });

      // Update the user's profile (name + phone) if provided
      if (input.userName || input.userPhone) {
        await tx
          .update(users)
          .set({
            ...(input.userName ? { name: input.userName } : {}),
            ...(input.userPhone !== undefined ? { phone: input.userPhone || null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }

      return { org, workspace };
    });

    return c.json({ org: result.org, tenant: result.workspace }, 201);
  }
);

/**
 * GET /api/tenants/check-slug?slug=xxx — check slug availability
 */
tenantsRouter.get('/check-slug', async (c) => {
  const slug = c.req.query('slug')?.toLowerCase().trim();
  if (!slug) return c.json({ available: false, reason: 'Required' }, 400);

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  return c.json({ available: !existing });
});
