-- 0084_force_rls.sql
-- SPEC-REGULA-RLS-ENFORCE-001 (Issue #239) — Phase 4 (migration piece)
--
-- 20개 org-scoped 테이블에 FORCE ROW LEVEL SECURITY 를 부여한다.
-- FORCE 를 부여하면 테이블 소유자(owner) 도 RLS 정책의 대상이 된다.
-- 일반적인 ENABLE ROW LEVEL SECURITY 는 소유자를 RLS 에서 제외하지만,
-- FORCE 는 그 예외를 제거한다.
--
-- @MX:WARN 본 migration 만으로는 RLS 가 런타임에 enforce 되지 않는다.
--   이유: (1) superuser 는 항상 RLS 를 bypass (BYPASSRLS); (2) BYPASSRLS 속성을
--   가진 role 도 bypass. 현재 앱 DB role = postgres (superuser) 이므로
--   FORCE 적용 직후에도 모든 쿼리가 정책을 우회한다.
--   실제 enforce 는 migration 0085 로 생성되는 non-superuser role
--   `regula_app` (NOBYPASSRLS) 로 DATABASE_URL 을 전환한 후에야 발생한다.
--   적용 순서: 0084 (본 파일) → 0085 (app role) → ops 가 DATABASE_URL 전환.
--   superuser role 로 본 migration 을 미리 적용하는 것은 no-op 이며 무해하다.
--
-- @MX:NOTE 대상 19개 테이블은 migration 0083 (WITH CHECK clauses) 과 동일.
--   0015(3) · 0066(1) · 0067(1) · 0068(3) · 0077(4) · 0078(4) · 0080(2) · 0082(1) = 19.
--   NOTE (SPEC-REGULA-MIGRATION-001 D11): ingest_jobs (0015의 4번째) 는 0017 §3에서
--   DROP 되어 제외. 직검 2026-06-26 + 2026-07-09: 아래 ALTER TABLE 목록이 0083 의
--   ALTER POLICY 대상과 정확히 일치하는지 대조 완료.
--
-- @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 Phase 4
-- @MX:REASON RLS 는 21 CFR Part 11 §11.10(c) 감사 추적성과 tenant isolation의
--   이중 안전망. superuser 버그나 privilege escalation 시에도 org-scope 가
--   유지되어야 규제 위반이 발생하지 않는다.

-- ============================================================
-- 0015_docingest_rls — organization_id 기반 (org_id 아님)
-- ============================================================
ALTER TABLE organization_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
ALTER TABLE document_access_policies FORCE ROW LEVEL SECURITY;
-- ingest_jobs omitted: dropped by migration 0017 §3 (SPEC-REGULA-MIGRATION-001 D11).

-- ============================================================
-- 0066_knowledge_gap
-- ============================================================
ALTER TABLE unanswered_queue FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 0067_classify
-- ============================================================
ALTER TABLE device_classifications FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 0068_traceability
-- ============================================================
ALTER TABLE evidence_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence_edges FORCE ROW LEVEL SECURITY;
ALTER TABLE stale_flags FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 0077_lifecycle
-- ============================================================
ALTER TABLE prompt_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE model_pin FORCE ROW LEVEL SECURITY;
ALTER TABLE change_request FORCE ROW LEVEL SECURITY;
ALTER TABLE approved_combination FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 0078_cyberdevice
-- ============================================================
ALTER TABLE threat_model FORCE ROW LEVEL SECURITY;
ALTER TABLE sbom FORCE ROW LEVEL SECURITY;
ALTER TABLE cve_impact FORCE ROW LEVEL SECURITY;
ALTER TABLE cyber_evidence_bundle FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 0080_corpus_license
-- ============================================================
ALTER TABLE source_license FORCE ROW LEVEL SECURITY;
ALTER TABLE entitlement FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 0082_rlhf
-- ============================================================
ALTER TABLE answer_feedback FORCE ROW LEVEL SECURITY;
