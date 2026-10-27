-- @MX:NOTE [AUTO] #547 — RA role unification (user directive 2026-10-27).
-- ra-lead / ra-member / qa-lead → single 'ra'. PostgreSQL cannot DROP enum
-- values, so the type is recreated. BOTH role columns (users,
-- document_access_policies) are cast to text BEFORE the type drop —
-- DROP TYPE fails while any column still depends on it.
--
-- Rollback: 0117_unify_ra_role_rollback.sql

BEGIN;

-- Step 1: detach both columns from the enum type.
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE document_access_policies ALTER COLUMN role DROP DEFAULT;
ALTER TABLE document_access_policies ALTER COLUMN role TYPE text USING role::text;

-- Step 2: recreate the enum with the unified value set.
DROP TYPE user_role;
CREATE TYPE user_role AS ENUM ('admin', 'ra', 'viewer', 'auditor');

-- Step 3: map legacy values onto 'ra' and re-cast both columns.
UPDATE users SET role = 'ra' WHERE role IN ('ra-lead', 'ra-member', 'qa-lead');
UPDATE document_access_policies SET role = 'ra' WHERE role IN ('ra-lead', 'ra-member', 'qa-lead');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'ra';
ALTER TABLE document_access_policies ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE document_access_policies ALTER COLUMN role SET DEFAULT 'ra';

COMMIT;
