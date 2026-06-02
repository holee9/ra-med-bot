-- Migration: 0029_predicate_workflow_type
-- SPEC-REGULA-PREDICATE-001 M1 — Predicate Comparison workflow kind.
-- REQ-PRE-010: extend workflow_type enum with 'predicate_comparison'.
--
-- ISOLATION (TR6): ALTER TYPE ... ADD VALUE must run in its OWN migration.
-- PostgreSQL cannot use a newly added enum value within the same transaction
-- that adds it. The partial index that filters on this value lives in the
-- separate migration 0030_predicate_index.sql, which therefore runs after
-- this migration has committed.
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'predicate_comparison';
