-- Issue #111: must_change_password column for forced first-login password change.
-- Used only for admin bootstrap accounts created via scripts/create-admin.ts.
-- Regular signups always have must_change_password = false (DEFAULT).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;
