import type { CreditPack } from './types.js';

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'payg', name: 'Pay-as-you-go', uploads: 1, priceUsd: 5, perUploadUsd: 5.0 },
  { id: 'starter', name: 'Starter', uploads: 10, priceUsd: 35, perUploadUsd: 3.5 },
  { id: 'school', name: 'School', uploads: 50, priceUsd: 99, perUploadUsd: 1.98, popular: true },
  { id: 'institution', name: 'Institution', uploads: 200, priceUsd: 249, perUploadUsd: 1.25 },
] as const;

export const TENANT_ROLES = ['owner', 'admin', 'member'] as const;

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_UPLOAD_EXTENSIONS = ['.xlsx', '.xls'] as const;

export const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'signin',
  'signup',
  'onboarding',
  'accept-invite',
  'settings',
  'billing',
  'help',
  'docs',
  'pricing',
  'about',
  'contact',
  'terms',
  'privacy',
  'static',
  'public',
  'assets',
]);
