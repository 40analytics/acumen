import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { tenantInvites, tenantMembers, users } from '../db/schema.js';
import { type AppEnv } from '../middleware/auth.js';
import { requireRole } from '../lib/tenant.js';
import { sendInviteEmail } from '../lib/email.js';
import { inviteMemberSchema, emailSchema } from '@acumen/shared';

export const membersRouter = new Hono<AppEnv>();

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const INVITE_TTL_DAYS = 7;

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * GET /api/t/:tenantSlug/members — list active members
 */
membersRouter.get('/', async (c) => {
  const tenant = c.get('tenant')!;
  const rows = await db
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
    .where(eq(tenantMembers.tenantId, tenant.tenantId))
    .orderBy(desc(tenantMembers.createdAt));
  return c.json({ members: rows });
});

/**
 * GET /api/t/:tenantSlug/members/invites — list pending invites
 */
membersRouter.get('/invites', async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const invites = await db
    .select()
    .from(tenantInvites)
    .where(
      and(
        eq(tenantInvites.tenantId, tenant.tenantId),
        eq(tenantInvites.status, 'pending')
      )
    )
    .orderBy(desc(tenantInvites.createdAt));
  return c.json({ invites });
});

/**
 * POST /api/t/:tenantSlug/members/invites — create + send an invite
 */
membersRouter.post('/invites', zValidator('json', inviteMemberSchema), async (c) => {
  const tenant = c.get('tenant')!;
  const user = c.get('user');
  requireRole(tenant, 'admin');
  const { email, role } = c.req.valid('json');

  // Already a member?
  const existingMember = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(tenantMembers, eq(tenantMembers.userId, users.id))
    .where(and(eq(users.email, email), eq(tenantMembers.tenantId, tenant.tenantId)))
    .limit(1);
  if (existingMember.length > 0) {
    return c.json({ error: 'This email is already a member of your workspace.' }, 409);
  }

  // Existing pending invite? Revoke it and create a new one (effectively a resend with new role)
  await db
    .update(tenantInvites)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(tenantInvites.tenantId, tenant.tenantId),
        eq(tenantInvites.email, email),
        eq(tenantInvites.status, 'pending')
      )
    );

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [invite] = await db
    .insert(tenantInvites)
    .values({
      tenantId: tenant.tenantId,
      email,
      role,
      token,
      invitedById: user.id,
      expiresAt,
    })
    .returning();

  const acceptUrl = `${APP_URL}/accept-invite/${token}`;
  try {
    await sendInviteEmail({
      email,
      inviterName: user.name ?? user.email,
      tenantName: tenant.tenantName,
      acceptUrl,
    });
  } catch (err) {
    console.error('[invite-email]', err);
    // Keep the invite; user can resend
  }

  return c.json({ invite }, 201);
});

/**
 * POST /api/t/:tenantSlug/members/invites/:inviteId/resend — re-send the email
 */
membersRouter.post('/invites/:inviteId/resend', async (c) => {
  const tenant = c.get('tenant')!;
  const user = c.get('user');
  requireRole(tenant, 'admin');

  const inviteId = c.req.param('inviteId');
  const invite = await db.query.tenantInvites.findFirst({
    where: and(
      eq(tenantInvites.id, inviteId),
      eq(tenantInvites.tenantId, tenant.tenantId)
    ),
  });
  if (!invite || invite.status !== 'pending') {
    return c.json({ error: 'Invite not found or no longer pending' }, 404);
  }
  if (invite.expiresAt < new Date()) {
    return c.json({ error: 'Invite expired — send a new one instead' }, 400);
  }

  const acceptUrl = `${APP_URL}/accept-invite/${invite.token}`;
  await sendInviteEmail({
    email: invite.email,
    inviterName: user.name ?? user.email,
    tenantName: tenant.tenantName,
    acceptUrl,
  });
  return c.json({ ok: true });
});

/**
 * DELETE /api/t/:tenantSlug/members/invites/:inviteId — revoke
 */
membersRouter.delete('/invites/:inviteId', async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');

  const inviteId = c.req.param('inviteId');
  await db
    .update(tenantInvites)
    .set({ status: 'revoked' })
    .where(and(eq(tenantInvites.id, inviteId), eq(tenantInvites.tenantId, tenant.tenantId)));
  return c.json({ ok: true });
});

/**
 * PATCH /api/t/:tenantSlug/members/:userId — change role (owner only)
 */
membersRouter.patch(
  '/:userId',
  zValidator('json', z.object({ role: z.enum(['admin', 'member', 'owner']) })),
  async (c) => {
    const tenant = c.get('tenant')!;
    requireRole(tenant, 'owner');
    const targetUserId = c.req.param('userId');
    const { role } = c.req.valid('json');

    if (targetUserId === tenant.userId && role !== 'owner') {
      return c.json(
        { error: 'You cannot demote yourself — transfer ownership first.' },
        400
      );
    }

    await db
      .update(tenantMembers)
      .set({ role })
      .where(
        and(
          eq(tenantMembers.tenantId, tenant.tenantId),
          eq(tenantMembers.userId, targetUserId)
        )
      );
    return c.json({ ok: true });
  }
);

/**
 * DELETE /api/t/:tenantSlug/members/:userId — remove a member
 * Members can remove themselves; admins can remove members; owners can
 * remove anyone (but not themselves unless they transfer ownership).
 */
membersRouter.delete('/:userId', async (c) => {
  const tenant = c.get('tenant')!;
  const targetUserId = c.req.param('userId');
  const isSelf = targetUserId === tenant.userId;

  if (!isSelf) {
    requireRole(tenant, 'admin');
  }

  // Block: can't remove the last owner
  const target = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenant.tenantId),
      eq(tenantMembers.userId, targetUserId)
    ),
  });
  if (!target) return c.json({ error: 'Not a member' }, 404);

  if (target.role === 'owner') {
    const [{ owners }] = await db
      .select({ owners: sql<number>`count(*)::int` })
      .from(tenantMembers)
      .where(
        and(eq(tenantMembers.tenantId, tenant.tenantId), eq(tenantMembers.role, 'owner'))
      );
    if (owners <= 1) {
      return c.json(
        { error: 'You cannot remove the only owner. Transfer ownership first.' },
        400
      );
    }
  }

  // Admins can't remove an owner; only owners can
  if (target.role === 'owner' && tenant.role !== 'owner') {
    return c.json({ error: 'Only an owner can remove another owner.' }, 403);
  }

  await db
    .delete(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenant.tenantId),
        eq(tenantMembers.userId, targetUserId)
      )
    );
  return c.json({ ok: true });
});
