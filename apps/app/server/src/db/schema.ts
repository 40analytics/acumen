import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  real,
  varchar,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── ENUMS ──────────────────────────────────────────────
export const tenantRoleEnum = pgEnum('tenant_role', ['owner', 'admin', 'member']);
export const examTypeEnum = pgEnum('exam_type', ['IGCSE', 'A Level']);
export const uploadStatusEnum = pgEnum('upload_status', ['processing', 'processed', 'failed']);
export const creditTxnTypeEnum = pgEnum('credit_txn_type', [
  'purchase',
  'upload',
  'refund',
  'admin_grant',
  'admin_revoke',
]);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'revoked', 'expired']);
export const purchaseStatusEnum = pgEnum('purchase_status', [
  'initialized',
  'pending',
  'success',
  'failed',
  'abandoned',
]);

// ─── AUTH (Better Auth tables) ──────────────────────────
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    image: text('image'),
    emailVerified: boolean('email_verified').notNull().default(false),
    isSuperAdmin: boolean('is_super_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    activeTenantId: uuid('active_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    tokenIdx: index('sessions_token_idx').on(t.token),
  })
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('accounts_user_idx').on(t.userId),
    providerIdx: uniqueIndex('accounts_provider_account_idx').on(t.providerId, t.accountId),
  })
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── TENANCY ────────────────────────────────────────────
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    countryCode: text('country_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(t.slug),
  })
);

export const tenantMembers = pgTable(
  'tenant_members',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: tenantRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.userId] }),
    userIdx: index('tenant_members_user_idx').on(t.userId),
  })
);

export const tenantInvites = pgTable(
  'tenant_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: tenantRoleEnum('role').notNull().default('member'),
    token: text('token').notNull().unique(),
    invitedById: text('invited_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: inviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantEmailIdx: index('tenant_invites_tenant_email_idx').on(t.tenantId, t.email),
    tokenIdx: uniqueIndex('tenant_invites_token_idx').on(t.token),
  })
);

// ─── CREDITS ────────────────────────────────────────────
export const creditBalances = pgTable('credit_balances', {
  tenantId: uuid('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lifetimePurchased: integer('lifetime_purchased').notNull().default(0),
  lifetimeSpent: integer('lifetime_spent').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    type: creditTxnTypeEnum('type').notNull(),
    amount: integer('amount').notNull(), // positive = credit added; negative = credit spent
    balanceAfter: integer('balance_after').notNull(),
    note: text('note'),
    purchaseId: uuid('purchase_id').references(() => creditPurchases.id, { onDelete: 'set null' }),
    uploadId: uuid('upload_id'),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('credit_txn_tenant_idx').on(t.tenantId, t.createdAt),
  })
);

export const creditPurchases = pgTable(
  'credit_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    initiatedByUserId: text('initiated_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
    packId: text('pack_id').notNull(),
    creditsToCredit: integer('credits_to_credit').notNull(),
    amountKobo: integer('amount_kobo').notNull(), // Paystack uses kobo (1/100 of NGN/GHS/etc)
    currency: text('currency').notNull().default('GHS'),
    paystackReference: text('paystack_reference').notNull().unique(),
    paystackAccessCode: text('paystack_access_code'),
    paystackAuthorizationUrl: text('paystack_authorization_url'),
    status: purchaseStatusEnum('status').notNull().default('initialized'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('credit_purchases_tenant_idx').on(t.tenantId, t.createdAt),
    refIdx: uniqueIndex('credit_purchases_ref_idx').on(t.paystackReference),
  })
);

// ─── EXAM DATA (all tenant-scoped) ─────────────────────
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    uploadedById: text('uploaded_by_id').notNull().references(() => users.id, { onDelete: 'set null' }),
    examType: examTypeEnum('exam_type').notNull(),
    month: text('month').notNull(),
    year: integer('year').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    fileFormat: text('file_format').notNull(), // 'comprehensive' or 'summary'
    status: uploadStatusEnum('status').notNull().default('processing'),
    recordCount: integer('record_count').notNull().default(0),
    errorMessage: text('error_message'),
    creditsCharged: integer('credits_charged').notNull().default(1),
    creditTransactionId: uuid('credit_transaction_id').references(() => creditTransactions.id, { onDelete: 'set null' }),
    period: date('period'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('uploads_tenant_idx').on(t.tenantId, t.createdAt),
    tenantPeriodIdx: index('uploads_tenant_period_idx').on(t.tenantId, t.period, t.examType),
  })
);

export const comprehensiveResults = pgTable(
  'comprehensive_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    uploadId: uuid('upload_id').notNull().references(() => uploads.id, { onDelete: 'cascade' }),
    syllabus: text('syllabus').notNull(),
    optionCode: text('option_code'),
    centreNumber: text('centre_number'),
    candidateNumber: text('candidate_number').notNull(),
    candidateName: text('candidate_name').notNull(),
    componentData: jsonb('component_data'),
    finalMarks: jsonb('final_marks'),
    syllabusTotal: real('syllabus_total'),
    syllabusGrade: text('syllabus_grade'),
    sheetName: text('sheet_name'),
    period: date('period'),
    examType: examTypeEnum('exam_type').notNull(),
    rawData: jsonb('raw_data'),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('comp_results_tenant_idx').on(t.tenantId),
    tenantCandidateIdx: index('comp_results_tenant_candidate_idx').on(t.tenantId, t.candidateNumber, t.candidateName),
    tenantSyllabusIdx: index('comp_results_tenant_syllabus_idx').on(t.tenantId, t.syllabus, t.period),
  })
);

export const summaryResults = pgTable(
  'summary_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    uploadId: uuid('upload_id').notNull().references(() => uploads.id, { onDelete: 'cascade' }),
    candidateNumber: text('candidate_number').notNull(),
    candidateName: text('candidate_name').notNull(),
    subject: text('subject').notNull(),
    syllabusCode: text('syllabus_code'),
    grade: text('grade').notNull(),
    qualification: text('qualification'),
    examType: examTypeEnum('exam_type').notNull(),
    period: date('period'),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('sum_results_tenant_idx').on(t.tenantId),
    tenantCandidateIdx: index('sum_results_tenant_candidate_idx').on(t.tenantId, t.candidateNumber),
    tenantPeriodIdx: index('sum_results_tenant_period_idx').on(t.tenantId, t.period, t.examType),
  })
);

export const syllabusNomenclature = pgTable(
  'syllabus_nomenclature',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    syllabusCode: text('syllabus_code').notNull(),
    syllabusName: text('syllabus_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCodeIdx: uniqueIndex('syllabus_nom_tenant_code_idx').on(t.tenantId, t.syllabusCode),
  })
);

export const componentsNomenclature = pgTable(
  'components_nomenclature',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    syllabusCode: text('syllabus_code').notNull(),
    syllabusName: text('syllabus_name'),
    componentCode: text('component_code').notNull(),
    componentName: text('component_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantSubCompIdx: uniqueIndex('comp_nom_tenant_sub_comp_idx').on(t.tenantId, t.syllabusCode, t.componentCode),
  })
);

export const teachers = pgTable(
  'teachers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    employeeId: text('employee_id'),
    department: text('department'),
    position: text('position'),
    dateJoined: date('date_joined'),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('teachers_tenant_idx').on(t.tenantId),
    tenantEmailIdx: uniqueIndex('teachers_tenant_email_idx').on(t.tenantId, t.email),
  })
);

export const teacherSubjects = pgTable(
  'teacher_subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id').notNull().references(() => teachers.id, { onDelete: 'cascade' }),
    syllabusCode: text('syllabus_code').notNull(),
    examType: examTypeEnum('exam_type').notNull(),
    isPrimaryTeacher: boolean('is_primary_teacher').notNull().default(false),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantTeacherIdx: index('teacher_subjects_tenant_teacher_idx').on(t.tenantId, t.teacherId),
    uniqueAssign: uniqueIndex('teacher_subjects_unique_idx').on(t.teacherId, t.syllabusCode, t.examType),
  })
);

// ─── IMPERSONATION ──────────────────────────────────────
/**
 * When a super admin "logs in as" another user, an impersonation row is
 * created. Middleware checks for an active row on the session and swaps
 * in the impersonated user. Every impersonation also writes to the audit
 * log on start and stop.
 */
export const impersonationSessions = pgTable(
  'impersonation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    impersonatedUserId: text('impersonated_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    startedById: text('started_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    sessionIdx: index('impersonation_session_idx').on(t.sessionId),
  })
);

// ─── AUDIT (super-admin actions) ─────────────────────────
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: text('actor_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetTenantId: uuid('target_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── RELATIONS ──────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMembers),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  members: many(tenantMembers),
  invites: many(tenantInvites),
  uploads: many(uploads),
  creditBalance: one(creditBalances, {
    fields: [tenants.id],
    references: [creditBalances.tenantId],
  }),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
}));
