-- SPEC-V3-IMPACT-001 M10: Rollback impact audit actions.
-- Migration 0110 Rollback:
--
-- NOTE: PostgreSQL does not support dropping enum values.
-- This rollback file is for documentation only.
-- If rollback is needed, the values must remain in the enum
-- but will not be used by the application code.

-- No-op - enum values cannot be dropped in PostgreSQL
-- See: https://www.postgresql.org/docs/current/sql-altertype.html#SQL-ALTERTYPE-ENUM
