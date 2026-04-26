import { z } from 'zod';
import { RESERVED_TENANT_SLUGS } from './constants.js';

export const emailSchema = z.string().email().toLowerCase().trim();

export const slugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens')
  .refine(
    (s) => !RESERVED_TENANT_SLUGS.has(s),
    'This name is reserved — try another'
  );

export const createTenantSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  slug: slugSchema,
});

/** Schema for creating an org + first workspace together during onboarding */
export const createOrgWithWorkspaceSchema = z.object({
  orgName: z.string().min(2).max(80).trim(),
  workspaceName: z.string().min(2).max(80).trim(),
  workspaceSlug: slugSchema,
  /** ISO 3166-1 alpha-2 country code for the school (e.g. "GH") */
  countryCode: z.string().length(2).optional().or(z.literal('')),
  /** Optional email domain to claim for this org (e.g. "school.edu") */
  emailDomain: z
    .string()
    .toLowerCase()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/, 'Enter a valid domain')
    .optional()
    .or(z.literal('')),
  /** User's display name (saved to users.name) */
  userName: z.string().min(1).max(80).trim().optional().or(z.literal('')),
  /** User's phone number */
  userPhone: z.string().max(40).trim().optional().or(z.literal('')),
  /** User's job title at this school */
  userJobTitle: z.string().max(80).trim().optional().or(z.literal('')),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'member']),
});

export const signInSchema = z.object({
  email: emailSchema,
});

export const purchaseCreditsSchema = z.object({
  packId: z.enum(['payg', 'starter', 'school', 'institution']),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type PurchaseCreditsInput = z.infer<typeof purchaseCreditsSchema>;
