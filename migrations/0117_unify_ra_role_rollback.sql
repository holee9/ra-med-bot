-- Rollback for 0117_unify_ra_role.sql (#547).
-- Maps the unified 'ra' back to the split roles. The seniority split cannot be
-- reconstructed from data — every 'ra' maps to 'ra-member' (the safe floor).
-- qa-lead had no live users at unification time.

BEGIN;

ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE document_access_policies ALTER COLUMN role DROP DEFAULT;
ALTER TABLE document_access_policies ALTER COLUMN role TYPE text USING role::text;

DROP TYPE user_role;
CREATE TYPE user_role AS ENUM ('admin', 'qa-lead', 'ra-lead', 'ra-member', 'viewer', 'auditor');

UPDATE users SET role = 'ra-member' WHERE role = 'ra';
UPDATE document_access_policies SET role = 'ra-member' WHERE role = 'ra';
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'ra-member';
ALTER TABLE document_access_policies ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE document_access_policies ALTER COLUMN role SET DEFAULT 'ra-member';

COMMIT;
