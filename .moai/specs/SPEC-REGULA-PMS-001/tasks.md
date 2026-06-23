# Tasks — SPEC-REGULA-PMS-001

> EU MDR 출시 후 임상 감시 (PMS 보고서 & PMCF 계획 생성기)
> Issue #53 · Phase 1 분석·작업분해 (구현 코드 없음 — run.md Phase 1 implementation guard 준수)
> Created: 2026-06-23 by manager-strategy

---

## 작업 분해 원칙

- **기준점 패턴**: `lib/classify/` (PR #237), `lib/traceability/` (PR #242), `lib/vigilance/` (reportability-engine), `lib/workflows/cer/steps.ts`
- **컨벤션 일관성**: `lib/db/schema.ts` 단일 파일 유지 (SPEC §4.1의 `lib/db/schema/pms.ts` 분할은 기존 컨벤션 위반 → scope discipline)
- **교훈 반영**: L-006 (executor 재실행 regression), citation 환각 방지 (validateCitations 재사용), IDOR negative test, audit 트랜잭션 래핑, RLS org-isolation
- **scope discipline**: §1.4 Out-of-Scope (EUDAMED, 규제기관 제출, 미국 PMS, CAPA) 엄격 준수

---

## Phase 매핑

| Phase | Tasks | 목적 |
|-------|-------|------|
| Phase 0 — Migration | TASK-001 | DB 스키마 기반 (enum + 테이블 + RLS) |
| Phase 1 — Backend Executors | TASK-002 ~ TASK-006 | compliance-check 공유 모듈 + 3개 executor + inputs 계층 |
| Phase 2 — API Routes | TASK-007 | 5개 라우트 + RBAC + audit 트랜잭션 + expert review gating |
| Phase 3 — UI | TASK-008, TASK-009 | 워크벤치 UI + registry 통합 |
| Phase 4 — Integration/E2E | TASK-010 | AC-01~08 검증 + executor 재실행 regression |

---

## TASK 목록

| ID | Description | Requirement | Dependencies | Planned Files | Status |
|----|-------------|-------------|--------------|---------------|--------|
| TASK-001 | DB migration 0069_pms.sql + schema.ts 동기화 (workflow_type 3개 추가, audit_action N개 추가, pms_inputs/pms_documents 테이블, RLS) | REQ-PMS-001 | (none) | `migrations/0069_pms.sql`, `lib/db/schema.ts` | pending |
| TASK-002 | PMS compliance-check 공유 모듈 (EU MDR Article 83-86 자동 컴플라이언스 체크) | REQ-PMS-007 | TASK-001 | `lib/workflows/_shared/compliance-check.ts`, `lib/workflows/_shared/__tests__/compliance-check.test.ts` | pending |
| TASK-003 | PMS inputs 데이터 계층 (complaint/vigilance 데이터 입력 + 파일 업로드 + 형식 검증) | REQ-PMS-005, REQ-PMS-006, REQ-PMS-012 | TASK-001 | `lib/pms/inputs.ts`, `lib/pms/__tests__/inputs.test.ts` | pending |
| TASK-004 | pms-report executor (MDCG 2022-21 섹션 구조 + CER 자동 연계 + citation 강제) | REQ-PMS-002, REQ-PMS-004, REQ-PMS-008 | TASK-001, TASK-002 | `lib/workflows/pms-report/executor.ts`, `lib/workflows/pms-report/sections.ts`, `lib/workflows/pms-report/validate.ts`, `lib/workflows/pms-report/__tests__/executor.test.ts` | pending |
| TASK-005 | pmcf-plan executor (Annex XIV Part B 체크리스트 + AI 작성 지원) | REQ-PMS-003 | TASK-001, TASK-002 | `lib/workflows/pmcf-plan/executor.ts`, `lib/workflows/pmcf-plan/checklist.ts`, `lib/workflows/pmcf-plan/__tests__/executor.test.ts` | pending |
| TASK-006 | pmcf-evaluation executor (PMCF 계획 대비 수집 임상 데이터 평가 초안) | REQ-PMS-011 | TASK-004, TASK-005 | `lib/workflows/pmcf-evaluation/executor.ts`, `lib/workflows/pmcf-evaluation/__tests__/executor.test.ts` | pending |
| TASK-007 | API 라우트 5종 + RBAC withPermission + audit 트랜잭션 래핑 + expert review export/close gating | REQ-PMS-009, REQ-PMS-010 | TASK-003 ~ TASK-006 | `app/api/workflows/pms-report/run/route.ts`, `app/api/workflows/pmcf-plan/run/route.ts`, `app/api/workflows/pmcf-evaluation/run/route.ts`, `app/api/pms/inputs/route.ts`, `app/api/pms/[projectId]/compliance/route.ts`, 각 `__tests__/route.test.ts` | pending |
| TASK-008 | PMS 워크벤치 UI (2단계 위자드 + PMCF 계획 빌더 + 컴플라이언스 패널 + inputs 업로더) | 모든 REQ UI 표면 | TASK-007 | `app/(app)/pms/page.tsx`, `app/(app)/pms/[projectId]/page.tsx`, `app/(app)/pms/_components/PmsWizard.tsx`, `app/(app)/pms/_components/PmcfPlanBuilder.tsx`, `app/(app)/pms/_components/CompliancePanel.tsx`, `app/(app)/pms/_components/PmsInputsUploader.tsx` | pending |
| TASK-009 | workflow registry + 사이드바 내비게이션 통합 (3개 신규 워크플로우 등록) | (registry SSoT 유지) | TASK-008 | `lib/workflows/registry.ts` | pending |
| TASK-010 | 통합/E2E 테스트 + executor 재실행 regression (AC-01~08 전체 검증) | AC-01 ~ AC-08 | TASK-001 ~ TASK-009 | `tests/integration/pms-cer-linkage.test.ts`, `tests/integration/pms-executor-replay.test.ts`, `tests/e2e/pms-workflow.spec.ts` | pending |

---

## Planned Files 총합 (Drift Guard 기준)

```
migrations/
  0069_pms.sql                                              # TASK-001

lib/db/
  schema.ts                                                 # TASK-001 (enum + 테이블 추가)

lib/pms/
  inputs.ts                                                 # TASK-003
  __tests__/inputs.test.ts                                  # TASK-003

lib/workflows/
  _shared/compliance-check.ts                               # TASK-002
  _shared/__tests__/compliance-check.test.ts                # TASK-002
  pms-report/executor.ts                                    # TASK-004
  pms-report/sections.ts                                    # TASK-004
  pms-report/validate.ts                                    # TASK-004
  pms-report/__tests__/executor.test.ts                     # TASK-004
  pmcf-plan/executor.ts                                     # TASK-005
  pmcf-plan/checklist.ts                                    # TASK-005
  pmcf-plan/__tests__/executor.test.ts                      # TASK-005
  pmcf-evaluation/executor.ts                               # TASK-006
  pmcf-evaluation/__tests__/executor.test.ts                # TASK-006
  registry.ts                                               # TASK-009 (3개 엔트리 추가)

app/api/
  workflows/pms-report/run/route.ts                         # TASK-007
  workflows/pms-report/run/__tests__/route.test.ts          # TASK-007
  workflows/pmcf-plan/run/route.ts                          # TASK-007
  workflows/pmcf-plan/run/__tests__/route.test.ts           # TASK-007
  workflows/pmcf-evaluation/run/route.ts                    # TASK-007
  workflows/pmcf-evaluation/run/__tests__/route.test.ts     # TASK-007
  pms/inputs/route.ts                                       # TASK-007
  pms/inputs/__tests__/route.test.ts                        # TASK-007
  pms/[projectId]/compliance/route.ts                       # TASK-007
  pms/[projectId]/compliance/__tests__/route.test.ts        # TASK-007

app/(app)/pms/
  page.tsx                                                  # TASK-008
  [projectId]/page.tsx                                      # TASK-008
  _components/PmsWizard.tsx                                 # TASK-008
  _components/PmcfPlanBuilder.tsx                           # TASK-008
  _components/CompliancePanel.tsx                           # TASK-008
  _components/PmsInputsUploader.tsx                         # TASK-008

tests/
  integration/pms-cer-linkage.test.ts                       # TASK-010
  integration/pms-executor-replay.test.ts                   # TASK-010
  e2e/pms-workflow.spec.ts                                  # TASK-010
```

---

## 의존성 그래프

```
TASK-001 (migration)
  ├── TASK-002 (compliance-check)
  ├── TASK-003 (inputs)
  ├── TASK-004 (pms-report) ← TASK-002
  │     └── TASK-006 (pmcf-evaluation) ← TASK-005
  └── TASK-005 (pmcf-plan) ← TASK-002
        └── TASK-006

TASK-003 ~ TASK-006
  └── TASK-007 (API routes)
        └── TASK-008 (UI)
              └── TASK-009 (registry)

TASK-001 ~ TASK-009
  └── TASK-010 (integration/E2E)
```

순환 참조 없음. 위상 정렬: 001 → {002,003} → {004,005} → 006 → 007 → 008 → 009 → 010.

---

## MVP 범위 vs 이월 (Deferred)

### MVP (TASK-001 ~ TASK-009)
- REQ-PMS-001 ~ REQ-PMS-010, REQ-PMS-012 전체
- REQ-PMS-011 (PMCF 평가, Medium) — 구조적 완전성을 위해 MVP 포함

### Out-of-Scope (SPEC §1.4 — 후속 이슈/별도 SPEC)
- EUDAMED API 실시간 연동 → 별도 SPEC
- 규제기관 직접 제출 → SPEC-REGULA-ESUBMIT-001 확장
- 미국 PMS (21 CFR 822) → 별도 SPEC
- CAPA 폐루프 관리 → SPEC-REGULA-CAPA-001

### YAGNI 배제 (과잉 추상화 금지)
- PMS 문서 버전 관리 시스템 (SPEC에 명시 없음)
- 다국어 PMSR 자동 번역
- PMS 갱신 주기 자동 알림
- vigilance reportability-engine의 재사용 검토는 TASK-002/003에서 수행 (중복 구현 금지)

---

## 교훈 반영 체크리스트 (3회 연속 머지 차단 결함 클래스 방지)

- [ ] **L-006**: TASK-010의 `pms-executor-replay.test.ts`는 실제 RAG 파이프라인 호출 regression 포함 (mock-only 회피)
- [ ] **citation 환각**: TASK-004의 `pms-report/validate.ts`는 `lib/classify/validate.ts`의 `validateCitations` 패턴 재사용
- [ ] **IDOR**: TASK-007 모든 라우트는 cross-org 소유권 검증 + 타 org 404 negative test
- [ ] **audit 무결성**: TASK-007 mutation + audit_log는 `db.transaction` 내 원자적 실행 (`writeAudit(params, tx)` 옵션 사용)
- [ ] **RLS**: TASK-001의 pms_inputs/pms_documents 테이블은 org_id + RLS + `app.current_org_id` GUC (0067/0068 패턴)
- [ ] **expert review gating**: TASK-007 export/close는 `workflow_runs.reviewRequired` + 기존 `with-workflow-review.ts` 패턴 재사용

---

## enum 확장 현황 (회귀 테스트 count 단언 대비)

| Enum | 현재 count | PMS 추가값 | 추가 후 count |
|------|-----------|-----------|--------------|
| `workflow_type` | 10 | `pms_report`, `pmcf_plan`, `pmcf_evaluation` | 13 |
| `audit_action` | 118 | `pms.report_created`, `pms.compliance_checked`, `pms.report_exported`, `pms.input_uploaded`, `pmcf.plan_created`, `pmcf.evaluation_drafted`, `pms.cer_linked` (7개 제안) | 125 |

> count는 TASK-001 구현 시 확정. 회귀 테스트가 count를 단언하므로 migration과 schema.ts가 동기화되어야 함.

---

## 다음 단계

본 tasks.md는 Phase 1(분석·작업분해) 산출물임. 구현 착수 전:
1. 사용자 본 tasks.md 승인
2. TASK-001부터 순차적 DDD/TDD 사이클 진행 (의존성 그래프 준수)
3. 각 task 완료 시 본 파일의 Status 열을 `pending` → `done`으로 업데이트
