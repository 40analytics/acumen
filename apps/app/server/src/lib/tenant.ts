import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenants, tenantMembers, orgMembers } from '../db/schema.js';
import type { TenantRole } from '@acumen/shared';

export class TenantAccessError extends Error {
  constructor(message = 'You do not have access to this workspace') {
    super(message);
    this.name = 'TenantAccessError';
  }
}

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /** The organisation this workspace belongs to — used for org-level credit ops */
  orgId: string | null;
  userId: string;
  role: TenantRole;
  isSuperAdmin: boolean;
}

/**
 * Resolve a tenant by slug and verify the user has access.
 * Access is granted if the user is a direct tenant member OR an org member
 * of the org that owns this workspace.
 * Super admins bypass membership checks but still get a `role` of 'admin'.
 * Throws TenantAccessError if the user is not a member.
 */
export async function resolveTenantAccess(args: {
  slug: string;
  userId: string;
  isSuperAdmin: boolean;
}): Promise<TenantContext> {
  const tenant = await db.query.tenants.findFirst({
    where: and(eq(tenants.slug, args.slug)),
  });
  if (!tenant || tenant.deletedAt) {
    throw new TenantAccessError('Workspace not found');
  }

  if (args.isSuperAdmin) {
    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      orgId: tenant.orgId,
      userId: args.userId,
      role: 'admin',
      isSuperAdmin: true,
    };
  }

  // Check direct workspace membership first
  const membership = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenant.id),
      eq(tenantMembers.userId, args.userId)
    ),
  });

  if (membership) {
    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      orgId: tenant.orgId,
      userId: args.userId,
      role: membership.role,
      isSuperAdmin: false,
    };
  }

  // Fall back: check org membership (org members can access all org workspaces)
  if (tenant.orgId) {
    const orgMembership = await db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.orgId, tenant.orgId),
        eq(orgMembers.userId, args.userId)
      ),
    });
    if (orgMembership) {
      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        orgId: tenant.orgId,
        userId: args.userId,
        role: orgMembership.role,
        isSuperAdmin: false,
      };
    }
  }

  throw new TenantAccessError();
}

/**
 * Assert the user has the required role (or higher).
 */
export function requireRole(ctx: TenantContext, minRole: TenantRole) {
  const order: Record<TenantRole, number> = { member: 0, admin: 1, owner: 2 };
  if (ctx.isSuperAdmin) return;
  if (order[ctx.role] < order[minRole]) {
    throw new TenantAccessError(`Requires ${minRole} role`);
  }
}
