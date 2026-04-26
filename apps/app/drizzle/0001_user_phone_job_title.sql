-- Add phone to users and job_title to tenant_members

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;

ALTER TABLE "tenant_members" ADD COLUMN IF NOT EXISTS "job_title" text;
