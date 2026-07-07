-- SPEC-REGULA-VALIDATION-001 M0: Rollback validation evidence schema.
-- Migration 0112 Rollback: drop 3 tables. CHECK constraints (not native enum)
-- make this a clean DROP TABLE — no enum value cleanup needed (plan.md §2 M0 Risks).
--
-- IMPORTANT: this rollback destroys validation evidence. Use only before a
-- release reaches sign-off. Once a release is signed off, the evidence must
-- be retained for 7-year FDA Part 11 retention — do NOT run this rollback.

BEGIN;

DROP TABLE IF EXISTS validation_signoff;
DROP TABLE IF EXISTS change_control;
DROP TABLE IF EXISTS validation_evidence;

COMMIT;
