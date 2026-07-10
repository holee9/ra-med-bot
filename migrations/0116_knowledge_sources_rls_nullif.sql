-- 0116_knowledge_sources_rls_nullif.sql
-- SPEC-REGULA-RLS-ENFORCE-001 (Phase 3 BLOCK-3 canary finding) — harden
-- knowledge_sources RLS policy to fail-closed on empty GUC, matching the
-- sources (0114) NULLIF pattern.
--
-- Finding (L-013, rls-enforce-canary-real-db.test.ts): the 0099 policy used
-- bare `current_setting('app.current_org_id', true)::uuid`. An empty GUC ("")
-- — e.g. a stale pooled connection or a withTenantScope bug — raised
-- `invalid input syntax for type uuid: ""` instead of fail-closing to 0 rows.
-- sources/source_sections (0114) use `NULLIF(current_setting(...), '')::uuid`
-- which is robust (empty/NULL GUC → NULL → false → 0 rows, no error). This
-- aligns knowledge_sources to the same robust pattern.
--
-- @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 (BLOCK-3, runbook §6 canary)
-- @MX:REASON RLS defense-in-depth: a policy that ERRORS on edge-case GUC state
--   is not fail-closed (it surfaces a 500, potentially leaking existence).
--   NULLIF makes the policy evaluate to false (0 rows) on empty/NULL GUC.

DROP POLICY IF EXISTS knowledge_sources_org_isolated ON knowledge_sources;
CREATE POLICY knowledge_sources_org_isolated ON knowledge_sources
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
