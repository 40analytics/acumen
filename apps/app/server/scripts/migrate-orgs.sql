-- ============================================================
-- Acumen: Organisations migration
-- Run with: DATABASE_URL=... node scripts/apply-sql.mjs scripts/migrate-orgs.sql
--
-- What this does:
--   1. Creates organisations, org_members, org_join_requests tables
--   2. Adds org_id column to tenants
--   3. Adds org_id column to credit_balances (becomes new PK)
--   4. Adds org_id column to credit_transactions and credit_purchases (context)
--   5. DATA: creates a personal org for each existing tenant (using the tenant owner)
--   6. DATA: migrates credit balances, transactions, and purchases to org references
--   7. Finalises credit_balances PK swap
-- ============================================================

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email_domain TEXT,
  max_workspaces INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS organisations_slug_idx ON organisations (slug);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organisations_domain_idx ON organisations (email_domain);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS org_members (
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS org_members_user_idx ON org_members (user_id);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS org_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  reviewed_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS org_join_requests_org_user_idx ON org_join_requests (org_id, user_id);

--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE SET NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tenants_org_idx ON tenants (org_id);

--> statement-breakpoint
-- Add org_id to credit tables (nullable during migration)
ALTER TABLE credit_balances ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

--> statement-breakpoint
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

--> statement-breakpoint
ALTER TABLE credit_purchases ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

--> statement-breakpoint
-- ==============================================================
-- DATA MIGRATION: create one org per tenant, migrate all credits
-- ==============================================================
DO $$
DECLARE
  t RECORD;
  owner_user_id TEXT;
  new_org_id UUID;
  org_slug TEXT;
  attempt INT;
BEGIN
  FOR t IN
    SELECT id, slug, name, created_at
    FROM tenants
    WHERE org_id IS NULL
    ORDER BY created_at ASC
  LOOP
    -- Find the owner of this workspace (first owner by join date)
    SELECT user_id INTO owner_user_id
    FROM tenant_members
    WHERE tenant_id = t.id AND role = 'owner'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Fall back to any member if no owner found
    IF owner_user_id IS NULL THEN
      SELECT user_id INTO owner_user_id
      FROM tenant_members
      WHERE tenant_id = t.id
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    -- Skip tenants with no members (orphaned)
    IF owner_user_id IS NULL THEN
      RAISE NOTICE 'Skipping tenant % (no members)', t.slug;
      CONTINUE;
    END IF;

    -- Check if this user already has an org (from a previous iteration)
    SELECT org_id INTO new_org_id
    FROM org_members
    WHERE user_id = owner_user_id AND role = 'owner'
    LIMIT 1;

    IF new_org_id IS NOT NULL THEN
      -- User already has an org — just link this workspace to it
      UPDATE tenants SET org_id = new_org_id WHERE id = t.id;
      RAISE NOTICE 'Linked tenant % to existing org %', t.slug, new_org_id;
      CONTINUE;
    END IF;

    -- Find a unique org slug
    org_slug := t.slug;
    attempt := 0;
    WHILE EXISTS (SELECT 1 FROM organisations WHERE slug = org_slug) LOOP
      attempt := attempt + 1;
      org_slug := t.slug || '-' || attempt;
    END LOOP;

    -- Create the org
    INSERT INTO organisations (id, slug, name, max_workspaces, created_at, updated_at)
    VALUES (gen_random_uuid(), org_slug, t.name, 1, t.created_at, t.created_at)
    RETURNING id INTO new_org_id;

    RAISE NOTICE 'Created org % (id=%) for tenant %', org_slug, new_org_id, t.slug;

    -- Add owner to org_members
    INSERT INTO org_members (org_id, user_id, role, created_at)
    VALUES (new_org_id, owner_user_id, 'owner', t.created_at)
    ON CONFLICT DO NOTHING;

    -- Link the tenant to the org
    UPDATE tenants SET org_id = new_org_id WHERE id = t.id;

    -- Migrate credit balance: insert org-level row from tenant row
    INSERT INTO credit_balances (org_id, balance, lifetime_purchased, lifetime_spent, updated_at)
    SELECT new_org_id, balance, lifetime_purchased, lifetime_spent, updated_at
    FROM credit_balances
    WHERE tenant_id = t.id
    ON CONFLICT DO NOTHING;

    -- If no existing balance row, seed with 1 free credit
    IF NOT EXISTS (SELECT 1 FROM credit_balances WHERE org_id = new_org_id) THEN
      INSERT INTO credit_balances (org_id, balance, lifetime_purchased, lifetime_spent, updated_at)
      VALUES (new_org_id, 1, 0, 0, NOW());
    END IF;

  END LOOP;
END $$;

--> statement-breakpoint
-- Backfill org_id on credit_transactions from the workspace's org
UPDATE credit_transactions ct
SET org_id = t.org_id
FROM tenants t
WHERE ct.tenant_id = t.id
  AND ct.org_id IS NULL
  AND t.org_id IS NOT NULL;

--> statement-breakpoint
-- Backfill org_id on credit_purchases from the workspace's org
UPDATE credit_purchases cp
SET org_id = t.org_id
FROM tenants t
WHERE cp.tenant_id = t.id
  AND cp.org_id IS NULL
  AND t.org_id IS NOT NULL;

--> statement-breakpoint
-- ==============================================================
-- Finalise: swap credit_balances PK from tenant_id to org_id
-- (Only safe once all rows have org_id populated)
-- ==============================================================
DO $$
BEGIN
  -- Check that all rows have org_id
  IF EXISTS (SELECT 1 FROM credit_balances WHERE org_id IS NULL AND tenant_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Some credit_balances rows still have no org_id — migration incomplete';
  END IF;

  -- Drop old PK constraint (named "credit_balances_pkey" by default)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_balances' AND constraint_name = 'credit_balances_pkey'
  ) THEN
    ALTER TABLE credit_balances DROP CONSTRAINT credit_balances_pkey;
  END IF;

  -- Add new PK on org_id
  BEGIN
    ALTER TABLE credit_balances ADD PRIMARY KEY (org_id);
  EXCEPTION WHEN duplicate_table THEN
    -- already exists
  END;

  -- Drop the old tenant_id column (no longer needed as PK)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_balances' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE credit_balances DROP COLUMN tenant_id;
  END IF;

  RAISE NOTICE 'credit_balances PK swapped to org_id successfully';
END $$;

--> statement-breakpoint
-- Add indexes for the new credit table columns
CREATE INDEX IF NOT EXISTS credit_txn_org_idx ON credit_transactions (org_id, created_at);
CREATE INDEX IF NOT EXISTS credit_purchases_org_idx ON credit_purchases (org_id, created_at);

--> statement-breakpoint
SELECT 'Migration complete: organisations feature applied' AS status;
