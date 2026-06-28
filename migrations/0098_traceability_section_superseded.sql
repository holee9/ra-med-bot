-- SPEC-REGULA-TRACEABILITY-001 — M-2 fix (Issue #300).
-- Adds a Part 11-traceable audit action for EACH source_section supersession,
-- independent of whether an evidence_node exists for the section.
--
-- Background: applyOutdateOperations (#238 / PR #301) fires
-- onSourceSectionSuperseded, which early-returns when no evidence_node exists
-- (no deliverable has cited the section). That left the supersession itself
-- non-auditable at the section level — a Part 11 gap. The delta-sync
-- orchestrator (#300) now emits traceability.section_superseded inside the
-- supersession tx for every newly-superseded section, so the audit trail
-- captures the supersession event regardless of evidence_node existence.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.section_superseded';
