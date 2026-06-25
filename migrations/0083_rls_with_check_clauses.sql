-- 0083_rls_with_check_clauses.sql
-- SPEC-REGULA-RLS-ENFORCE-001 (Issue #239) — Phase 1
--
-- RLS policies project-wide 에 WITH CHECK 추가.
-- 이전까지 USING 만 있어 INSERT/UPDATE 가 게이트되지 않았던 20개 정책에
-- USING 과 동일 조건의 WITH CHECK 를 부여한다.
--
-- @MX:NOTE: RLS 는 여전히 INERT (service-role DB client 가 RLS 를 bypass).
--   실제 enforce 전환은 Phase 3 (migration 0084 FORCE ROW LEVEL SECURITY) 에서.
--   본 migration 은 정책 형상(Shape)만 완성 — 런타임 동작 변화 없음.
--
-- 대상 (직검 2026-06-25, runtime grep):
--   0015(4) · 0066(1) · 0067(1) · 0068(3) · 0077(4) · 0078(4) · 0080(2) · 0082(1) = 20개

-- ============================================================
-- 0015_docingest_rls — organization_id 기반 (org_id 아님)
-- ============================================================
ALTER POLICY "tenant_isolation_documents" ON organization_documents
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_chunks" ON document_chunks
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_access_policies" ON document_access_policies
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_ingest_jobs" ON ingest_jobs
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0066_knowledge_gap
-- ============================================================
ALTER POLICY "tenant_isolation_unanswered_queue" ON unanswered_queue
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0067_classify
-- ============================================================
ALTER POLICY "tenant_isolation_device_classifications" ON device_classifications
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0068_traceability
-- ============================================================
ALTER POLICY "tenant_isolation_evidence_nodes" ON evidence_nodes
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_evidence_edges" ON evidence_edges
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_stale_flags" ON stale_flags
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0077_model_governance
-- ============================================================
ALTER POLICY prompt_registry_org_isolation ON prompt_registry
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY model_pin_org_isolation ON model_pin
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY change_request_org_isolation ON change_request
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY approved_combination_org_isolation ON approved_combination
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0078_cyberdevice
-- ============================================================
ALTER POLICY "tenant_isolation_threat_model" ON threat_model
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_sbom" ON sbom
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_cve_impact" ON cve_impact
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_cyber_evidence_bundle" ON cyber_evidence_bundle
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0080_corpus_license
-- ============================================================
ALTER POLICY "tenant_isolation_source_license" ON source_license
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER POLICY "tenant_isolation_entitlement" ON entitlement
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 0082_rlhf — answer_feedback.org_id 직접 컬럼 없음.
-- messages → conversations → projects → org_members 4-way join 의 EXISTS 서브쿼리를
-- USING 과 WITH CHECK 동일 조건으로 부여 (기존 USING 보존).
-- ============================================================
ALTER POLICY answer_feedback_org_isolation ON answer_feedback
  USING (
    EXISTS (
      SELECT 1
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN projects p ON p.id = c.project_id
      JOIN org_members om ON om.org_id = p.organization_id
      WHERE m.id = answer_feedback.message_id
        AND om.user_id = answer_feedback.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN projects p ON p.id = c.project_id
      JOIN org_members om ON om.org_id = p.organization_id
      WHERE m.id = answer_feedback.message_id
        AND om.user_id = answer_feedback.user_id
    )
  );
