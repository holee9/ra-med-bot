-- @MX:ANCHOR audit_logs append-only enforcement — 21 CFR Part 11 §11.10(c).
-- @MX:REASON FDA mandates that electronic records used to capture regulatory
-- decisions are immutable. UPDATE/DELETE/TRUNCATE on audit_logs is therefore
-- blocked at the database layer, not just in application code. Trigger
-- enforcement survives privilege escalation and superuser bugs.
-- @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-046, REQ-FND-046a, REQ-FND-047, REQ-FND-047a)
--
-- 7-year retention policy is enforced by ops (cold-archive cron after year 5,
-- physical row deletion forbidden inside the retention window). See
-- DEVELOPMENT.md "Audit Log Retention" for the runtime contract.

-- 21 CFR Part 11 §11.10(c) append-only enforcement
-- 7-year retention policy (FDA expectation)

CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (21 CFR Part 11). Operation: %', TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

-- Row-level: block UPDATE and DELETE
CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION tg_audit_logs_block_mutation();

-- Statement-level: block TRUNCATE
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION tg_audit_logs_block_mutation();

-- Defense in depth: revoke mutation privileges from the application role.
-- The placeholder `regula_app` role must exist before this migration runs.
-- See DEVELOPMENT.md "Database Roles" for the bootstrap script that creates
-- it (CREATE ROLE regula_app LOGIN ...; GRANT CONNECT ON DATABASE ...).
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES ON audit_logs FROM regula_app;
GRANT INSERT, SELECT ON audit_logs TO regula_app;
