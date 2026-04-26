import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenantInvites, tenantMembers, tenants, users } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import type { AppEnv } from '../middleware/auth.js';

/**
 * Public invite endpoints — mounted at /api/invites/*
 * GET is public so the accept page can show inviter + tenant name without auth.
 * POST /accept requires the user to be signed in with the invited email.
 */
export const invitesRouter = new Hono<AppEnv>();

/**
 * GET /api/invites/:token — get invite details for the accept page
 */
invitesRouter.get('/:token', async (c) => {
  const token = c.req.param('token');
  const invite = await db.query.tenantInvites.findFirst({
    where: eq(tenantInvites.token, token),
  });
  if (!invite) return c.json({ error: 'Invitation not found' }, 404);

  if (invite.status === 'accepted') return c.json({ status: 'accepted' });
  if (invite.status === 'revoked') return c.json({ status: 'revoked' });
  if (invite.expiresAt < new Date()) {
    await db
      .update(tenantInvites)
      .set({ status: 'expired' })
      .where(eq(tenantInvites.id, invite.id));
    return c.json({ status: 'expired' });
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invite.tenantId),
  });
  const inviter = await db.query.users.findFirst({
    where: eq(users.id, invite.invitedById),
  });

  // Find current session (optional)
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  return c.json({
    status: 'pending',
    invite: {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
    tenant: tenant ? { slug: tenant.slug, name: tenant.name } : null,
    inviter: inviter ? { name: inviter.name, email: inviter.email } : null,
    currentUser: session?.user
      ? { email: session.user.email, name: session.user.name ?? null }
      : null,
  });
});

/**
 * POST /api/invites/:token/accept — accept the invitation
 */
invitesRouter.post('/:token/accept', async (c) => {
  const token = c.req.param('token');
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: 'Sign in to accept this invitation.' }, 401);

  const invite = await db.query.tenantInvites.findFirst({
    where: eq(tenantInvites.token, token),
  });
  if (!invite) return c.json({ error: 'Invitation not found' }, 404);
  if (invite.status !== 'pending')
    return c.json({ error: 'Invitation is no longer valid' }, 400);
  if (invite.expiresAt < new Date()) {
    await db
      .update(tenantInvites)
      .set({ status: 'expired' })
      .where(eq(tenantInvites.id, invite.id));
    return c.json({ error: 'Invitation expired' }, 400);
  }

  // Email must match
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return c.json(
      {
        error: `This invitation is for ${invite.email}. Please sign in with that email.`,
        code: 'EMAIL_MISMATCH',
      },
      403
    );
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invite.tenantId),
  });
  if (!tenant) return c.json({ error: 'Workspace not found' }, 404);

  // Already a member?
  const existing = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenant.id),
      eq(tenantMembers.userId, session.user.id)
    ),
  });
  if (existing) {
    await db
      .update(tenantInvites)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(tenantInvites.id, invite.id));
    return c.json({ tenantSlug: tenant.slug, alreadyMember: true });
  }

  await db.transaction(async (tx) => {
    await tx.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: session.user.id,
      role: invite.role,
    });
    await tx
      .update(tenantInvites)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(tenantInvites.id, invite.id));
  });

  return c.json({ tenantSlug: tenant.slug, alreadyMember: false });
});
