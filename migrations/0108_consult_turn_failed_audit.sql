-- SPEC-V3-CONSULT-001 — RA Power Chat (v3 Phase C-5)
-- Migration 0108: consult.turn.failed audit_action enum value
--
-- Adds the `consult.turn.failed` audit_action for REQ-CONS-010 (21 CFR Part 11
-- §11.10(e) debugging audit). When a CONSULT turn times out or hits a runtime
-- error, the turn row IS persisted (with error string) so the RA member sees
-- feedback in the session — and a `consult.turn.failed` audit row is written
-- in the SAME transaction (AC-CONS-05).

BEGIN;

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'consult.turn.failed';

COMMIT;
