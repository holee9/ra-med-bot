# tasks.md — SPEC-REGULA-CHANGE-CONTROL-001

> 구현 에이전트(regula-backend/frontend)를 위한 phase별 체크리스트.
> 모든 태스크는 해당 REQ-ID / AC-ID를 매핑한다.
> **L-007**: expert review gate / citation 강제 / export 제외 게이트는
> 오케스트레이터가 직접 실행 결과를 검증해야 한다 (구현 에이전트 self-report 금지).

## 기준 정보 (회귀 테스트 count 단언용)

| 항목 | 현재 값 | 변경 후 값 | 마이그레이션 |
|------|--------|-----------|------------|
| `workflow_type` enum 값 수 | 12 | 13 (+`change_control_assessment`) | 0071 |
| `audit_action` enum 값 수 | 107 | 112 (+5) | 0071 |
| `PermissionAction` union 값 수 | 43 | 46 (+3) | 0071 (코드) |
| 마이그레이션 시퀀스 | 0070 | 0071 | — |

---

## Phase 0: Migration & Schema (REQ-001, REQ-012)

- [ ] T0.1 `migrations/0071_change_control.sql` 작성
  - `ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'change_control_assessment'` (REQ-001)
  - `ALTER TYPE audit_action ADD VALUE` x 5 (REQ-012):
    - `change.assessment_created`
    - `change.verdict_produced`
    - `change.verdict_citation_rejected` (REQ-006)
    - `change.assessment_reviewed` (REQ-009)
    - `change.report_exported` (REQ-007)
  - 신규 테이블 (SPEC §4.2):
    - `change_assessments`: id, org_id, project_id, workflow_run_id, change_type (enum), description, impact_scope, status ('provisional'|'reviewed'|'final'), model_version, prompt_version, template_version, created_by, created_at, updated_at
    - `change_verdicts`: id, assessment_id, jurisdiction, verdict ('new_submission_required'|'change_notification'|'internal_record_only'|'not_applicable'), rationale, created_at
    - `change_verdict_citations`: id, verdict_id, source_section_id, excerpt (NOT NULL — citation 강제, REQ-006)
    - `change_risk_links`: id, assessment_id, risk_item_id (REFERENCES risk_items.id — #46 연계, REQ-008)
  - RLS: org_id 기준 (기존 패턴 참조)
  - 인덱스: assessment_id, project_id, org_id
- [ ] T0.2 `lib/db/schema.ts` 에 신규 테이블 4개 pgTable 정의 + pgEnum 2개 (`changeTypeEnum`, `changeVerdictEnum`) 추가
- [ ] T0.3 `lib/db/schema.ts` `workflowTypeEnum` 배열에 `'change_control_assessment'` 추가 (주석에 SPEC-REGULA-CHANGE-CONTROL-001 / 0071 참조)
- [ ] T0.4 `lib/auth/permissions.ts` `PermissionAction` union 에 3개 추가 (REQ-012 RBAC):
  - `change.assess` (minRole: 'ra-lead', scope: 'org') — 변경 평가 생성은 판단을 동반하므로 ra-lead
  - `change.view` (minRole: 'ra-member', scope: 'org')
  - `change.export` (minRole: 'ra-lead', scope: 'org') — DHF 첨부용 export
- [ ] T0.5 회귀: `enum 카운트 워크플로 유형 12→13, 감사 작업 107→112, 권한 43→46` 단언 테스트 통과

---

## Phase 1: Backend — lib/change-control 모듈

### 1-A. 분류 & 관할권 평가 (REQ-003, REQ-004, REQ-005)

- [ ] T1.1 `lib/change-control/types.ts` — ChangeType, ChangeVerdict, Jurisdiction, ChangeAssessment, ChangeVerdictResult 타입 정의 (CLASSIFY `types.ts` 패턴 참조)
- [ ] T1.2 `lib/change-control/classify.ts` — 변경 유형 분류 (design/material/manufacturing_process/software/labeling/intended_use, REQ-003). LLM 프롬프트 + 파서 (CLASSIFY `engine.ts` / `prompt.ts` 패턴 재사용)
- [ ] T1.3 `lib/change-control/jurisdictions/fda.ts` — 21 CFR 807.81(a)(3) 평가 로직 (REQ-005)
- [ ] T1.4 `lib/change-control/jurisdictions/eu-mdr.ts` — Article 120(3), MDCG 2020-3 (REQ-005)
- [ ] T1.5 `lib/change-control/jurisdictions/mfds.ts` — 의료기기법 제12조 (REQ-005)
- [ ] T1.6 `lib/change-control/jurisdictions/nmpa.ts` — 중국 변경 등록 (REQ-005)
- [ ] T1.7 `lib/change-control/jurisdictions/pmda.ts` — 일본 일부변경 승인 (REQ-005)
- [ ] T1.8 관할권 라우터 — 프로젝트 `target_markets` 기반으로 평가할 관할권 필터링 (기존 `project.target_markets` 컬럼 재사용)

### 1-B. Citation 강제 (REQ-006) — **오케스트레이터 게이트**

- [ ] T1.9 `lib/change-control/verdict.ts` — `validateVerdictCitations(verdict, retrievedSources)` 구현
  - CLASSIFY `validate.ts` 의 `validateCitations` 패턴 직접 참조 (식별자 매칭 + 검증 실패 시 strip)
  - **REQ-006 강제**: citation 이 하나도 없는 verdict → reject (pending 상태로 강등, rationale="citation required")
  - `change_verdict_citations.excerpt` NOT NULL 제약으로 DB 레벨 방어선
- [ ] **[ORCHESTRATOR GATE]** 구현 완료 후 오케스트레이터가 직접 citation 없는 verdict 케이스로 reject 경로 단언 (L-007)

### 1-C. Version Metadata (REQ-010)

- [ ] T1.10 `lib/change-control/version-metadata.ts` — model/prompt/template version 기록
  - `change_assessments.model_version`, `prompt_version`, `template_version` 컬럼 사용
  - rollback 지원: 버전 메타데이터로 과거 실행 재현 가능
  - 워크플로우 완료 시 audit_logs 메타데이터에 version 정보 포함 (REQ-010)

### 1-D. ISO 14971 위험 연계 (REQ-008)

- [ ] T1.11 `lib/change-control/risk-linkage.ts` — `linkAssessmentToRiskItem(assessmentId, riskItemId)` 구현
  - `change_risk_links` 테이블에 레코드 삽입
  - #46 `risk_items` 테이블 참조 (이미 구현됨 — `lib/risk/`, schema 1513행)
  - 위험 재평가 권장 안내: 변경 평가 결과에 따라 영향받는 risk_items 목록 반환

### 1-E. Audit (REQ-012)

- [ ] T1.12 모든 상태 전이 시 `writeAudit` 호출 (기존 `lib/audit.ts` 재사용)
  - 평가 생성: `change.assessment_created` (actor, inputs 메타데이터)
  - verdict 생성: `change.verdict_produced`
  - citation 거부: `change.verdict_citation_rejected`
  - 전문가 검토: `change.assessment_reviewed`
  - export: `change.report_exported`

---

## Phase 2: Backend — API 라우트

- [ ] T2.1 `app/api/change-control/route.ts` — `POST` 평가 생성 (REQ-001, REQ-002, REQ-003, REQ-004, REQ-005)
  - `withPermission('change.assess', ...)` 래핑
  - 구조화 입력 검증 (change_type, description, impact_scope) — Zod 스키마
  - workflow 실행 → 관할권별 verdict 생성 → citation 검증 → DB 저장 → audit
- [ ] T2.2 `app/api/change-control/[assessmentId]/route.ts` — `GET` verdict + citation + risk link 조회 (REQ-004)
  - `withPermission('change.view', ...)`, org_id RLS 스코프 (IDOR 방어)
- [ ] T2.3 `app/api/change-control/[assessmentId]/export/route.ts` — `POST` PDF 보고서 (REQ-007)
  - `withPermission('change.export', ...)`
  - **REQ-011 게이트**: status='provisional' 인 경우 403 (PMS `close/route.ts` 패턴 직접 참조)
  - status='reviewed' 또는 'final' 만 export 허용
- [ ] T2.4 `app/api/change-control/[assessmentId]/review/route.ts` — `POST` 전문가 검토 확정 (REQ-009)
  - `withPermission('change.assess', ...)` (ra-lead)
  - status 'provisional' → 'reviewed' 전이
  - expert_reviews 테이블 재사용 또는 change_assessments.status 로컬 전이

---

## Phase 3: Backend — Workflow 통합

- [ ] T3.1 `lib/workflows/change-control-assessment.ts` — Workflows runtime 정의 (SPEC §4.1)
  - 기존 `lib/workflows/types.ts` WorkflowDefinition 인터페이스 준수
- [ ] T3.2 `lib/workflows/registry.ts` WORKFLOW_REGISTRY 에 등록
- [ ] T3.3 `lib/workflows/_shared/` 공통 유틸 재사용 (audit, RBAC, version 메타데이터)

---

## Phase 4: Frontend

- [ ] T4.1 `app/(app)/change-control/page.tsx` — 변경 입력 폼 (REQ-002, AC-01)
  - change_type 셀렉트 (6종, REQ-003), description, impact_scope 입력
  - 프로젝트 선택 → target_markets 기반 관할권 표시
- [ ] T4.2 `app/(app)/change-control/[assessmentId]/page.tsx` — 평가 결과 (AC-02, AC-03, AC-06, AC-07)
  - 관할권별 verdict + citation 목록
  - **REQ-011**: provisional verdict 시 provisional 배지 + export 버튼 비활성화
  - ISO 14971 risk link 목록 (AC-06)
  - model/prompt/template version 표시 (AC-08)
- [ ] T4.3 PDF export 버튼 → `POST /api/change-control/{id}/export` (AC-05)
- [ ] T4.4 전문가 검토 확정 버튼 (ra-lead 전용, REQ-009)
- [ ] T4.5 i18n: `lib/i18n/` 메시지 카탈로그에 change-control 네임스페이스 추가 (ko/en)
- [ ] T4.6 a11y: WCAG 2.1 AA — 폼 라벨, 키보드 내비게이션, 스크린리더 호환

---

## Phase 5: Expert Review Gate & Export Gating — **오케스트레이터 직접 검증**

- [ ] **[ORCHESTRATOR GATE]** T5.1 REQ-009: AI verdict는 전문가 검토 전 final 처리 불가 단언
  - status='provisional' 상태에서 export 시도 → 403 확인
  - `change.report_exported` audit 대신 `change.verdict_citation_rejected` 또는 별도 거부 audit 확인
- [ ] **[ORCHESTRATOR GATE]** T5.2 REQ-011: provisional verdict export 제외 단언
- [ ] **[ORCHESTRATOR GATE]** T5.3 REQ-006: citation 없는 verdict reject 단언 (T1.9 연동)
- [ ] T5.4 PMS `close/route.ts` 패턴과 일관성 확인 (BLOCKING_REVIEW_STATUSES 패턴)

---

## Phase 6: Tests

- [ ] T6.1 `lib/change-control/__tests__/classify.test.ts` — 6종 유형 분류 (AC-02)
- [ ] T6.2 `lib/change-control/__tests__/verdict.test.ts` — 관할권별 verdict 생성 (AC-03) + citation 강제 reject (AC-04)
- [ ] T6.3 `lib/change-control/__tests__/risk-linkage.test.ts` — #46 연계 (AC-06)
- [ ] T6.4 API 라우트 통합 테스트: 생성/조회/export/review (AC-01, AC-03, AC-05, AC-07)
- [ ] T6.5 audit_logs 기록 단언 (AC-08) — actor, timestamp, inputs, version metadata
- [ ] T6.6 IDOR 방어: 타 조직 assessment 접근 시 404 (org_id RLS)
- [ ] T6.7 회귀: enum/permission/audit count 단언 (Phase 0 기준 정보)

---

## AC 매핑 요약

| AC | 태스크 | 검증 방법 |
|----|--------|----------|
| AC-01 | T4.1, T6.4 | Review (폼 입력) |
| AC-02 | T1.2, T6.1 | Test (6종 분류) |
| AC-03 | T1.3-T1.8, T6.2, T6.4 | Test (4단계 verdict) |
| AC-04 | T1.9, T5.3, T6.2 | Test (citation 거부) |
| AC-05 | T2.3, T4.3, T6.4 | Test (PDF export) |
| AC-06 | T1.11, T6.3 | Test (#46 연계) |
| AC-07 | T2.3, T4.2, T5.1, T5.2, T6.4 | Test (provisional 게이트) |
| AC-08 | T1.10, T1.12, T6.5 | Test (audit + version) |

---

## 의존성 연계 확인 (Read 증거 기반)

- **#46 ISO 14971 Risk**: `lib/risk/` 디렉토리 + `risk_items` 테이블 (schema 1513행) 이미 구현됨. `change_risk_links.risk_item_id` 가 `risk_items.id` 참조. **재사용 가능, 이슈 등록 불필요**.
- **#36 Review Ops (expert review gate)**: `lib/ai/expert-review-queue.ts` + `expert_reviews` 테이블 + `expertReviewStatusEnum` (schema 84행) 이미 구현됨. PMS `close/route.ts` 가 서버 사이드 게이팅 패턴 제공. **재사용 가능**.
- **CLASSIFY `validateCitations`** (`lib/classify/validate.ts`): citation 강제 패턴의 직접 참조 모델. 식별자 매칭 + 검증 실패 시 pending 강등 로직 재사용.
- **PMS export gating** (`app/api/pms/[projectId]/documents/[documentId]/close/route.ts`): provisional 상태 export 차단 패턴의 직접 참조 모델.
