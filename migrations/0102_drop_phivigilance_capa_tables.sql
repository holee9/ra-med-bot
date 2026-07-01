-- 0102_drop_phivigilance_capa_tables.sql
-- SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): Regula does NOT handle patient
-- information. Drop the vigilance (adverse event / reportability / vigilance
-- report) and CAPA (complaint / capa_records / root_causes / links /
-- effectiveness_checks) tables plus the CI events adverse_event coupling.
--
-- Pre-flight (MUST be 0 — corpus confirmed empty 2026-07-01):
--   SELECT COUNT(*) FROM adverse_events;            -- 0
--   SELECT COUNT(*) FROM reportability_assessments; -- 0
--   SELECT COUNT(*) FROM vigilance_reports;         -- 0
--   SELECT COUNT(*) FROM complaints;                -- 0
--   SELECT COUNT(*) FROM capa_records;              -- 0
--   SELECT COUNT(*) FROM capa_root_causes;          -- 0
--   SELECT COUNT(*) FROM capa_links;                -- 0
--   SELECT COUNT(*) FROM capa_effectiveness_checks; -- 0
--
-- Out of scope (per SPEC §1.5): audit_action enum values
-- (vigilance_*, complaint.*, capa.*, capa.close_blocked_vigilance_missing) and
-- workflow_type 'complaint' are RETAINED. Postgres enum value removal is
-- invasive (requires type rebuild) and unused values are harmless.

-- ===========================================================================
-- 1. CI events — drop the vigilance coupling (column + partial index).
--    ci_event_type 'adverse_event' value removal handled in step 2 (type rebuild).
-- ===========================================================================

DROP INDEX IF EXISTS idx_ci_events_vigilance;
ALTER TABLE ci_events DROP COLUMN IF EXISTS vigilance_ref;

-- ===========================================================================
-- 2. ci_event_type — remove 'adverse_event' by rebuilding the enum type.
--    Postgres has no direct DROP VALUE; recreate the type with the two
--    remaining values and reattach the column.
-- ===========================================================================

ALTER TABLE ci_events ALTER COLUMN type TYPE text USING type::text;
DROP TYPE IF EXISTS ci_event_type;

CREATE TYPE ci_event_type AS ENUM ('milestone', 'deviation');

-- Migrate any legacy 'adverse_event' rows to 'deviation' (defensive; table
-- should be empty), then restore the typed column.
UPDATE ci_events SET type = 'deviation' WHERE type = 'adverse_event';
ALTER TABLE ci_events
  ALTER COLUMN type TYPE ci_event_type USING type::ci_event_type;

-- ===========================================================================
-- 3. CAPA tables (5) — complaint closed-loop domain.
--    Drop in FK-dependency order: leaves first (root_causes, links,
--    effectiveness_checks), then capa_records, then complaints.
-- ===========================================================================

DROP TABLE IF EXISTS capa_effectiveness_checks CASCADE;
DROP TABLE IF EXISTS capa_links CASCADE;
DROP TABLE IF EXISTS capa_root_causes CASCADE;
DROP TABLE IF EXISTS capa_records CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;

-- CAPA-specific enums (no longer referenced by any table).
DROP TYPE IF EXISTS complaint_reportability_status CASCADE;
DROP TYPE IF EXISTS capa_type CASCADE;
DROP TYPE IF EXISTS capa_status CASCADE;
DROP TYPE IF EXISTS capa_effectiveness_status CASCADE;

-- ===========================================================================
-- 4. Vigilance tables (3) — adverse event / reportability / vigilance report.
--    Drop in FK-dependency order: vigilance_reports + reportability_assessments
--    (both reference adverse_events), then adverse_events.
-- ===========================================================================

DROP TABLE IF EXISTS vigilance_reports CASCADE;
DROP TABLE IF EXISTS reportability_assessments CASCADE;
DROP TABLE IF EXISTS adverse_events CASCADE;
