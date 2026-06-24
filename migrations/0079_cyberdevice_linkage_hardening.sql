-- Migration: Cyberdevice linkage hardening (Issue 67 security defects C-1 + H-2)
-- SPEC: SPEC-REGULA-CYBERDEVICE-001
-- Scope:
--   1. audit_action +1 (cyber.reassess_triggered — REQ-011 durable signal, H-2 fix)
--
-- C-1 (linked_samd_id / linked_dhf_id / linked_submission_id FK):
--   0078 left these columns as bare uuid (no FK). Native FK constraints are
--   blocked by a type mismatch: cyber_evidence_bundle.linked_*_id columns are
--   `uuid` (from 0078), but the referent tables use text PKs:
--     - samd_assessments.id        → text (gen_random_uuid()::text, 0054)
--     - design_history_files.id    → text (gen_random_uuid()::text, 0055)
--     - submission_packages.id     → text (gen_random_uuid()::text, 0056)
--   A direct REFERENCES uuid→text is not permitted by Postgres. Therefore the
--   authoritative guard is in-application org-scoped referent validation
--   (lib/cyberdevice/linkage.ts verifyLinkedReferentExists), exercised on every
--   evidence-bundle insert. A future migration that unifies the PK types can
--   add native FKs at that point (deferred to a dedicated hardening SPEC).

-- -------------------------------------
-- §1 Enum extension (H-2 fix)
-- -------------------------------------

-- cyber.reassess_triggered — REQ-011: CVE/KEV change detected that requires
-- change-control + risk re-evaluation. Written inside the cve-analysis tx so
-- the signal is 21 CFR Part 11 traceable. Full change-control workflow enqueue
-- (#54 wiring) remains @MX:TODO; this audit row is the minimum durable trace.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.reassess_triggered';
