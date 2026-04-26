export type TenantRole = 'owner' | 'admin' | 'member';

export type ExamType = 'IGCSE' | 'A Level';

export type UploadStatus = 'processing' | 'processed' | 'failed';

export type CreditTransactionType =
  | 'purchase'
  | 'upload'
  | 'refund'
  | 'admin_grant'
  | 'admin_revoke';

export type CreditPackId = 'payg' | 'starter' | 'school' | 'institution';

export interface CreditPack {
  id: CreditPackId;
  name: string;
  uploads: number;
  priceUsd: number;
  perUploadUsd: number;
  popular?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isSuperAdmin: boolean;
  emailVerified: Date | null;
  createdAt: Date;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
}

export interface TenantMember {
  tenantId: string;
  userId: string;
  role: TenantRole;
  createdAt: Date;
}

export interface CreditBalance {
  tenantId: string;
  balance: number;
  updatedAt: Date;
}
