import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  organisations,
  orgMembers,
  orgJoinRequests,
  tenants,
  tenantMembers,
  users,
} from '../db/schema.js';
import { requireUser, type AppEnv } from '../middleware/auth.js';

export const orgsRouter = new Hono<AppEnv>();

orgsRouter.use('*', requireUser);

// Free email providers — we skip domain suggestions for these
const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'live.com', 'me.com', 'protonmail.com', 'mail.com',
]);

/**
 * GET /api/orgs/suggestions — find orgs whose emailDomain matches the caller's
 * email domain. Used by the Onboarding page.
 */
orgsRouter.get('/suggestions', async (c) => {
  const user = c.get('user');
  const domain = user.email.split('@')[1]?.toLowerCase();

  if (!domain || FREE_PROVIDERS.has(domain)) {
    return c.json({ orgs: [] });
  }

  const matched = await db.query.organisations.findMany({
    where: eq(organisations.emailDomain, domain),
    with: { members: true },
    columns: { id: true, name: true, slug: true, emailDomain: true },
  });

  // Check if user already has pending/approved join requests for these orgs
  const orgIds = matched.map((o) => o.id);
  const existingRequests = orgIds.length
    ? await db.query.orgJoinRequests.findMany({
        where: and(
          eq(orgJoinRequests.userId, user.id),
        ),
      })
    : [];

  const requestMap = new Map(existingRequests.map((r) => [r.orgId, r.status]));

  return c.json({
    orgs: matched.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      memberCount: org.members.length,
      joinRequestStatus: requestMap.get(org.id) ?? null,
    })),
  });
});

/**
 * GET /api/orgs — list orgs the current user belongs to
 */
orgsRouter.get('/', async (c) => {
  const user = c.get('user');
  const memberships = await db.query.orgMembers.findMany({
    where: eq(orgMembers.userId, user.id),
    with: {
      org: {
        with: { workspaces: { columns: { id: true, slug: true, name: true } } },
        columns: { id: true, slug: true, name: true, maxWorkspaces: true, emailDomain: true },
      },
    },
  });
  return c.json({
    orgs: memberships.map((m) => ({
      ...m.org,
      role: m.role,
      workspaceCount: m.org.workspaces.length,
    })),
  });
});

/**
 * POST /api/orgs/:orgId/join-requests — request to join an org
 */
orgsRouter.post('/:orgId/join-requests', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const { message } = await c.req.json().catch(() => ({ message: undefined })) as { message?: string };

  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, orgId),
  });
  if (!org) return c.json({ error: 'Organisation not found' }, 404);

  // Already a member?
  const alreadyMember = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
  });
  if (alreadyMember) return c.json({ error: 'You are already a member of this organisation' }, 409);

  // Already has a pending request?
  const existingReq = await db.query.orgJoinRequests.findFirst({
    where: and(
      eq(orgJoinRequests.orgId, orgId),
      eq(orgJoinRequests.userId, user.id),
      eq(orgJoinRequests.status, 'pending')
    ),
  });
  if (existingReq) return c.json({ error: 'You already have a pending request to join this organisation' }, 409);

  const [request] = await db
    .insert(orgJoinRequests)
    .values({ orgId, userId: user.id, message: message ?? null })
    .returning();

  return c.json({ request }, 201);
});

/**
 * GET /api/orgs/:orgId/join-requests — list pending join requests (org admins only)
 */
orgsRouter.get('/:orgId/join-requests', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  // Must be an org admin/owner
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
  });
  if (!membership || membership.role === 'member') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const requests = await db
    .select({
      id: orgJoinRequests.id,
      status: orgJoinRequests.status,
      message: orgJoinRequests.message,
      createdAt: orgJoinRequests.createdAt,
      userId: users.id,
      userEmail: users.email,
      userName: users.name,
    })
    .from(orgJoinRequests)
    .innerJoin(users, eq(orgJoinRequests.userId, users.id))
    .where(and(eq(orgJoinRequests.orgId, orgId), eq(orgJoinRequests.status, 'pending')));

  return c.json({ requests });
});

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

/**
 * PATCH /api/orgs/:orgId/join-requests/:requestId — approve or reject a join request
 */
orgsRouter.patch(
  '/:orgId/join-requests/:requestId',
  zValidator('json', reviewSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const requestId = c.req.param('requestId');
    const { action } = c.req.valid('json');

    // Must be an org admin/owner
    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership || membership.role === 'member') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const request = await db.query.orgJoinRequests.findFirst({
      where: and(eq(orgJoinRequests.id, requestId), eq(orgJoinRequests.orgId, orgId)),
    });
    if (!request) return c.json({ error: 'Request not found' }, 404);
    if (request.status !== 'pending') {
      return c.json({ error: 'This request has already been reviewed' }, 409);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(orgJoinRequests)
        .set({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedById: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(orgJoinRequests.id, requestId));

      if (action === 'approve') {
        // Add to org
        await tx.insert(orgMembers).values({
          orgId,
          userId: request.userId,
          role: 'member',
        });

        // Add to all workspaces in this org as member
        const orgWorkspaces = await tx.query.tenants.findMany({
          where: eq(tenants.orgId, orgId),
          columns: { id: true },
        });
        if (orgWorkspaces.length > 0) {
          await tx.insert(tenantMembers).values(
            orgWorkspaces.map((ws) => ({
              tenantId: ws.id,
              userId: request.userId,
              role: 'member' as const,
            }))
          );
        }
      }
    });

    return c.json({ ok: true, action });
  }
);

/**
 * GET /api/orgs/:orgId — org details (for members)
 */
orgsRouter.get('/:orgId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
  });
  const isSuperAdmin = c.get('user')?.isSuperAdmin ?? false;
  if (!membership && !isSuperAdmin) {
    return c.json({ error: 'Not found' }, 404);
  }

  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, orgId),
    with: {
      workspaces: { columns: { id: true, slug: true, name: true, createdAt: true } },
      members: {
        with: { user: { columns: { id: true, email: true, name: true } } },
      },
      creditBalance: true,
    },
  });
  if (!org) return c.json({ error: 'Not found' }, 404);

  return c.json({ org, role: membership?.role ?? 'admin' });
});

/**
 * PATCH /api/orgs/:orgId — update org (admin+)
 */
const updateOrgSchema = z.object({
  name: z.string().min(2).max(80).trim().optional(),
  emailDomain: z.string().toLowerCase().trim().optional().or(z.literal('')),
});

orgsRouter.patch('/:orgId', zValidator('json', updateOrgSchema), async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json');

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
  });
  if (!membership || membership.role === 'member') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.emailDomain !== undefined) updates.emailDomain = input.emailDomain || null;

  const [updated] = await db
    .update(organisations)
    .set(updates as any)
    .where(eq(organisations.id, orgId))
    .returning();

  return c.json({ org: updated });
});
