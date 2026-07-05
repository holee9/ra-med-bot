-- Rollback for 0108_consult_turn_failed_audit.sql
-- NOTE: ALTER TYPE ... ADD VALUE is irreversible in PostgreSQL. The enum value
--       `consult.turn.failed` remains in audit_action after rollback — harmless if unused.
BEGIN;
-- No-op (enum value cannot be removed without rebuild).
COMMIT;
