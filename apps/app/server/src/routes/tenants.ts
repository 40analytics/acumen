import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenants, tenantMembers, creditBalances } from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';
import { createTenantSchema } from '@acumen/shared';

export const tenantsRouter = new Hono<AppEnv>();

tenantsRouter.use('*', requireUser);

/**
 * POST /api/tenants — create a new organization, becoming the owner
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

  const tenant = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tenants)
      .values({ slug: input.slug, name: input.name })
      .returning();

    await tx.insert(tenantMembers).values({
      tenantId: created.id,
      userId: user.id,
      role: 'owner',
    });

    await tx.insert(creditBalances).values({
      tenantId: created.id,
      balance: 1, // first upload free
      lifetimePurchased: 0,
      lifetimeSpent: 0,
    });

    return created;
  });

  return c.json({ tenant }, 201);
});

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
