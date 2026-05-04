-- REQ-TENANT-001: Department attribute for secondary RBAC axis (SPEC-REGULA-TENANT-001)
-- Adds user_department pgEnum and nullable department column to users table.
CREATE TYPE user_department AS ENUM ('RA', 'Dev', 'Exec', 'External');
ALTER TABLE users ADD COLUMN department user_department;
