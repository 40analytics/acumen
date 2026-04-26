import type { MiddlewareHandler } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { impersonationSessions, users } from '../db/schema.js';
import { resolveTenantAccess, type TenantContext, TenantAccessError } from '../lib/tenant.js';

export interface ActorMeta {
  /** The real signed-in super admin when impersonating */
  realUserId: string;
  realUserEmail: string;
  realUserName: string | null;
  impersonationId: string;
}

export interface AppEnv {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string | null;
      isSuperAdmin: boolean;
    };
    session: {
      id: string;
      token: string;
      expiresAt: Date;
    };
    /** When set, the request is being made under impersonation. */
    actor?: ActorMeta;
    tenant?: TenantContext;
  };
}

/**
 * Require an authenticated user. Loads from Better Auth session.
 * If an active impersonation row exists for this session, swap in
 * the impersonated user and expose the real super admin via `actor`.
 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user || !session.session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('session', {
    id: session.session.id,
    token: session.session.token,
    expiresAt: session.session.expiresAt,
  });

  // Check for active impersonation on this session
  const imp = await db.query.impersonationSessions.findFirst({
    where: and(
      eq(impersonationSessions.sessionId, session.session.id),
      isNull(impersonationSessions.endedAt)
    ),
  });

  if (imp) {
    const target = await db.query.users.findFirst({
      where: eq(users.id, imp.impersonatedUserId),
    });
    if (!target) {
      // The impersonated user was deleted — auto-end and fall back to real user
      await db
        .update(impersonationSessions)
        .set({ endedAt: new Date() })
        .where(eq(impersonationSessions.id, imp.id));
    } else {
      c.set('user', {
        id: target.id,
        email: target.email,
        name: target.name ?? null,
        isSuperAdmin: false, // impersonation never grants super admin
      });
      c.set('actor', {
        realUserId: session.user.id,
        realUserEmail: session.user.email,
        realUserName: session.user.name ?? null,
        impersonationId: imp.id,
      });
      await next();
      return;
    }
  }

  c.set('user', {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    isSuperAdmin: (session.user as any).isSuperAdmin === true,
  });
  await next();
};

/**
 * Require a tenant scope. Reads `:tenantSlug` from URL params and verifies
 * the authenticated user has membership.
 */
export const requireTenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const slug = c.req.param('tenantSlug');
  if (!slug) return c.json({ error: 'Tenant slug missing' }, 400);

  try {
    const ctx = await resolveTenantAccess({
      slug,
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin,
    });
    c.set('tenant', ctx);
  } catch (err) {
    if (err instanceof TenantAccessError) {
      return c.json({ error: err.message }, 403);
    }
    throw err;
  }
  await next();
};

/**
 * Require super admin. For /admin routes.
 * Blocks while impersonating — admin must stop impersonation first.
 */
export const requireSuperAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const actor = c.get('actor');
  if (actor) {
    return c.json(
      { error: 'Stop impersonation before accessing the admin portal.', code: 'IMPERSONATING' },
      403
    );
  }
  const user = c.get('user');
  if (!user?.isSuperAdmin) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
};
