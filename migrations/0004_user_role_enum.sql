-- @MX:NOTE [AUTO] Phase 5 Enterprise Hardening — user_role pgEnum migration.
-- @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-016)
--
-- Creates user_role enum type and migrates users.role from TEXT to the new type.
-- Must be run as a multi-step migration:
--   1. Create the enum type
--   2. Update existing 'member' data to 'ra-member' (the new equivalent)
--   3. Alter the column type using USING cast
--   4. Set NOT NULL and DEFAULT
--
-- Rollback: See down comment at bottom of file.

-- Step 1: Create the user_role enum type.
CREATE TYPE user_role AS ENUM ('admin', 'ra-lead', 'ra-member', 'viewer');

-- Step 2: Update any existing rows with the legacy 'member' value.
-- 'member' was the Phase 1 default; it maps to 'ra-member' in Phase 5.
UPDATE users SET role = 'ra-member' WHERE role = 'member';

-- Step 3: Alter the column type from TEXT to user_role.
-- The legacy DEFAULT 'member' (set in 0000) is not a valid user_role value
-- (Step 2 renames it to 'ra-member'), so Postgres cannot cast the existing
-- default to the new enum type. DROP the default first, then re-apply it in
-- Step 4. (SPEC-REGULA-MIGRATION-001 D2 — without DROP DEFAULT the TYPE change
-- fails with "default for column role cannot be cast automatically to type
-- user_role".)
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING role::user_role;

-- Step 4: Set NOT NULL and DEFAULT on the converted column.
ALTER TABLE users
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'ra-member';

-- Rollback (Phase 6 down script placeholder):
-- ALTER TABLE users ALTER COLUMN role TYPE text USING role::text;
-- ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member';
-- DROP TYPE user_role;
