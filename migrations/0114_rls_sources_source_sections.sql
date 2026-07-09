-- 0114_rls_sources_source_sections.sql
-- SPEC-REGULA-RLS-SOURCES-001 (Issue #317) — sources/source_sections RLS 활성화
--
-- AC4 (0084 omission root cause):
--   migration 0083 (WITH CHECK) / 0084 (FORCE)는 19개 테이블에 적용되었다.
--   sources (0000_init.sql:89) + source_sections (0000_init.sql:126)는 0000에서
--   CREATE TABLE만 생성되고 RLS policy가 전혀 없었다 → 0083/0084가 붙일 대상이
--   없어 scope gap이 발생한 것이다. 이는 "20-table 목록에서 빠뜨렸다"가 아니라
--   "policy 자체가 없어 WITH CHECK/FORCE를 부착할 수 없었다"는 구조적 누락이다.
--   (참고: 0084 대상은 실제 19개 — ingest_jobs는 0017 §3에서 DROP됨.)
--   본 migration이 #239 (SPEC-REGULA-RLS-ENFORCE-001) project-wide RLS의 마지막
--   누락 도메인(sources/source_sections, RAG corpus)을 메운다.
--
-- @MX:SPEC SPEC-REGULA-RLS-SOURCES-001
-- @MX:REASON RLS는 21 CFR Part 11 §11.10(c) 감사 추적성과 tenant isolation의
--   이중 안전망이다. sources/source_sections에 RLS policy가 없으면 GUC
--   app.current_org_id가 inert가 되어, query-layer org filter(eq(orgId))가
--   누락될 때 cross-org 데이터 노출로 이어진다. 본 활성화로 fail-closed
--   defense-in-depth를 확보한다.
--
-- @MX:NOTE 현재 앱 DB role = postgres superuser → RLS는 런타임에 bypass(BYPASSRLS)
--   된다. 따라서 본 migration 적용 자체는 no-op에 가깝다(superuser). 실제
--   enforce는 ops가 DATABASE_URL을 regula_app(NOBYPASSRLS, migration 0085 생성)으로
--   전환한 후에야 발생한다. 카나리 검증(rls-sources-real-db.test.ts)은
--   SET ROLE regula_app으로 이 동작을 증명한다.
--
-- NULL 정책: strict org-match (fail-closed). 실DB 직검 결과 sources는 전량
--   org-scoped(organization_id non-NULL, NULL 0행)이며 knowledge_sources.organization_id
--   가 NOT NULL이라 ingestion은 아키텍처적으로 항상 org-scoped다. 따라서 NULL
--   organization_id는 bug이며 차단한다(IS NULL OR disjunction 배제).
--
-- source_sections: organization_id 컬럼이 없다 → 부모 sources에 대한 EXISTS
--   subquery로 org 소유권을 판정한다(Option A). sources.id는 PK, source_sections.
--   source_id는 FK이므로 PK-to-PK join으로 hot retrieval 경로 성능 저하 없음.

-- ============================================================
-- §1 sources — ENABLE + FORCE + org-isolation policy (strict org-match)
-- ============================================================
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources FORCE ROW LEVEL SECURITY;

-- PostgreSQL has no CREATE POLICY IF NOT EXISTS; DROP guard for idempotent re-apply.
-- NULLIF(..., '') normalizes an empty/unset GUC to NULL before the ::uuid cast:
--   GUC=valid-uuid ⇒ match;  GUC="" or unset ⇒ NULL ⇒ organization_id = NULL ⇒ false (fail-closed).
-- Without NULLIF, a "" GUC raises `invalid input syntax for type uuid` instead of
-- filtering to 0 rows. This is strictly more defensive than the sibling 0099 policy.
DROP POLICY IF EXISTS sources_org_isolated ON sources;
CREATE POLICY sources_org_isolated ON sources
  FOR ALL
  TO regula_app
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- ============================================================
-- §2 source_sections — Option A subquery policy (부모 sources EXISTS)
-- ============================================================
ALTER TABLE source_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_sections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS source_sections_org_isolated ON source_sections;
CREATE POLICY source_sections_org_isolated ON source_sections
  FOR ALL
  TO regula_app
  USING (
    EXISTS (
      SELECT 1 FROM sources s
      WHERE s.id = source_sections.source_id
        AND s.organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sources s
      WHERE s.id = source_sections.source_id
        AND s.organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
