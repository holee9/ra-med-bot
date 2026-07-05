-- Rollback for 0107_create_consult_tables.sql
-- NOTE: ALTER TYPE ... ADD VALUE is irreversible in PostgreSQL. The 3 enum
--       values (consult.session.create / consult.turn.create / consult.session.delete)
--       remain in audit_action after rollback — harmless if unused.
BEGIN;

DROP POLICY IF EXISTS consult_turns_org_isolation ON consult_turns;
DROP POLICY IF EXISTS consult_sessions_org_isolation ON consult_sessions;

DROP TABLE IF EXISTS consult_turns;
DROP TABLE IF EXISTS consult_sessions;

COMMIT;
