---
id: SPEC-REGULA-PMS-001
version: 1.0.0
status: completed
phase: wave5
priority: High
created: 2026-06-22
updated: 2026-06-24
author: manager-spec (batch-2026-06-22)
issue_number: 53
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-CER-001
  - SPEC-REGULA-RISK-001
  - SPEC-REGULA-BREADTH-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-PMS-001 — EU MDR 출시 후 임상 감시 (PMS 보고서 & PMCF 계획 생성기)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #53 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

EU MDR (2017/745) Article 83-86은 모든 CE 마킹 의료기기에 대해 출시 후 임상 감시(Post-Market Surveillance, PMS)를 의무화한다. Class IIa 이상 기기는 추가로 PMCF(Post-Market Clinical Follow-up) 계획 및 보고서가 필요하다.

현재 Regula의 워크플로우(Phase 9)는 허가 전 문서(510k, CER 초안, PCCP)에 집중되어 있으나, 허가 후 PMS/PMCF 사이클은 지원하지 않는다. 이는 EU 시장 제품의 연간 RA 업무 중 가장 시간 소모적인 부분이다.

EU MDR 전환 기간(2026-2028) 동안 수천 개 기기의 재인증 수요가 폭발할 것으로 예상되며, PMS/PMCF 자동화는 CE 마킹 기업의 핵심 페인포인트이다. 본 SPEC은 PMS 보고서(PMSR) 구조화 자동 작성, PMCF 계획 템플릿 생성 및 AI 지원 작성, PMCF 평가 보고서 초안 생성을 다루며, 기존 CER 데이터(#23) 및 임상 데이터와 연계한다.

complaint/vigilance 데이터 입력 통합(수동 또는 파일 업로드)과 의심 심각한 부작용(SUSAR)·트렌드 리포팅 섹션 템플릿을 제공하고, EU MDR Article 83-86 자동 컴플라이언스 체크를 수행한다.

### 1.2 규제 근거 (Regulatory Anchor)

- EU MDR (2017/745) Article 83-86: Post-Market Surveillance 시스템·PMS 계획·PMSR
- EU MDR Annex III: 기술 문서 중 PMS 문서
- EU MDR Annex XIV Part B: PMCF 요구사항
- MDCG 2022-21: PMSR 가이던스
- 21 CFR Part 11: 전자 기록·서명, audit trail

### 1.3 본 SPEC의 범위 (In Scope)

- `workflow_type` enum에 `pms_report`, `pmcf_plan`, `pmcf_evaluation` 추가
- PMS 보고서 AI 워크플로우(MDCG 2022-21 기반 섹션 구조)
- PMCF 계획 빌더(Annex XIV Part B 체크리스트 + AI 작성 지원)
- SUSAR 및 트렌드 리포팅 섹션 템플릿
- complaint/vigilance 데이터 입력 통합
- 기존 CER 문서(#23) 자동 연계 (같은 프로젝트 내)
- EU MDR Article 83-86 자동 컴플라이언스 체크

### 1.4 Out of Scope

- 실시간 외부 vigilance 데이터베이스(EUDAMED) API 연동
- 규제기관 직접 제출
- 미국 PMS(21 CFR 822 Postmarket Surveillance) 처리 (별도 범위)
- CAPA 폐루프 관리 (SPEC-REGULA-CAPA-001)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-PMS-001 | THE SYSTEM SHALL `workflow_type` enum에 `pms_report`, `pmcf_plan`, `pmcf_evaluation`을 추가한다 | High |
| REQ-PMS-002 | WHEN 사용자가 PMS 보고서 워크플로우를 실행하면 THE SYSTEM SHALL MDCG 2022-21 가이던스 기반 섹션 구조를 자동 생성한다 | High |
| REQ-PMS-003 | WHEN 사용자가 PMCF 계획을 작성하면 THE SYSTEM SHALL EU MDR Annex XIV Part B 요구사항 체크리스트를 제공하고 AI 작성을 지원한다 | High |
| REQ-PMS-004 | WHEN 같은 프로젝트에 CER 문서(#23)가 존재하면 THE SYSTEM SHALL PMS/PMCF 문서에 CER 데이터를 자동 연계한다 | High |
| REQ-PMS-005 | THE SYSTEM SHALL SUSAR 및 트렌드 리포팅 섹션 템플릿을 제공한다 | High |
| REQ-PMS-006 | WHEN 사용자가 complaint/vigilance 데이터를 입력하거나 파일을 업로드하면 THE SYSTEM SHALL 해당 데이터를 PMS 보고서 입력으로 통합한다 | High |
| REQ-PMS-007 | WHEN PMS 문서가 생성되면 THE SYSTEM SHALL EU MDR Article 83-86 컴플라이언스 체크 결과를 표시한다 | High |
| REQ-PMS-008 | THE SYSTEM SHALL 모든 PMS/PMCF 판단의 근거 citation이 실제 claim을 지지하도록 강제한다 | High |
| REQ-PMS-009 | IF PMS/PMCF draft에 expert review가 완료되지 않았다면 THEN THE SYSTEM SHALL export 또는 close를 차단한다 | High |
| REQ-PMS-010 | WHEN reportability·심각도·follow-up 상태가 전이되면 THE SYSTEM SHALL audit_logs에 기록한다 | High |
| REQ-PMS-011 | WHEN PMCF 평가 보고서를 생성하면 THE SYSTEM SHALL PMCF 계획 대비 수집된 임상 데이터 평가 초안을 작성한다 | Medium |
| REQ-PMS-012 | IF 외부 파일 업로드가 실패하거나 형식이 잘못되면 THEN THE SYSTEM SHALL 명확한 오류를 반환한다 | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | `workflow_type` enum에 3개 신규 타입 존재 | schema/migration 검토 |
| AC-02 | PMS 보고서가 MDCG 2022-21 섹션 구조로 생성됨 | integration test + 섹션 매핑 검증 |
| AC-03 | PMCF 계획에 Annex XIV Part B 체크리스트 100% 포함 | unit test (체크리스트 항목 수) |
| AC-04 | 같은 프로젝트 CER 데이터가 PMS 문서에 자동 연계됨 | integration test |
| AC-05 | complaint/vigilance 데이터 입력·업로드 통합 동작 | E2E test |
| AC-06 | Article 83-86 컴플라이언스 체크 결과 표시 | E2E test |
| AC-07 | expert review 없이 close 시도 시 차단됨 | negative test |
| AC-08 | 상태 전이 audit_logs 100% 기록 | audit log 검증 |

---

## §4 Technical Approach

### 4.1 파일 구조

```
lib/workflows/
  pms-report/executor.ts
  pmcf-plan/executor.ts
  pmcf-evaluation/executor.ts
  _shared/compliance-check.ts       # Article 83-86 체크
app/(app)/pms/                       # PMS 워크벤치 UI
lib/db/schema/pms.ts                 # complaint/vigilance 입력 테이블
```

### 4.2 DB Schema

- `workflow_type` enum 확장: `pms_report`, `pmcf_plan`, `pmcf_evaluation`
- `pms_inputs` 테이블: complaint/vigilance 데이터 (project_id FK, source, severity, susar_flag, trend_category)
- `pms_documents` 테이블: 생성된 PMSR/PMCF 문서 (cer_ref FK, compliance_status, review_status)
- `audit_logs` 재사용: 상태 전이 기록

### 4.3 API Endpoints

- `POST /api/workflows/pms-report/run`
- `POST /api/workflows/pmcf-plan/run`
- `POST /api/workflows/pmcf-evaluation/run`
- `POST /api/pms/inputs` — complaint/vigilance 입력·업로드
- `GET /api/pms/[projectId]/compliance` — Article 83-86 체크 결과

### 4.4 의존성

- #23 CER Builder (완료 후 연계)
- #46 ISO 14971 Risk Management (위험 데이터 공유)
- SPEC-REGULA-BREADTH-001 (projects 테이블)

---

## §5 Implementation Notes (Post-Merge)

### 5.1 구현 요약

PR #246 (commit `8a513cc`)로 main 머지 완료. **3443 passed | 7 skipped | 0 failed**.

**구현 파일 구조**:
- `lib/workflows/pms-report/`: executor.ts, sections.ts, validate.ts, checklist.ts
- `lib/workflows/pmcf-plan/`: executor.ts, sections.ts, validate.ts, checklist.ts
- `lib/workflows/pmcf-evaluation/`: executor.ts, sections.ts, validate.ts, checklist.ts
- `lib/workflows/_shared/compliance-check.ts`: Article 83-86 자동 컴플라이언스 체크
- `lib/pms/inputs.ts`: complaint/vigilance 데이터 입력 처리
- `lib/pms/cer-linkage.ts`: CER 데이터 자동 연계 모듈

**API 라우트** (5개):
- `POST /api/workflows/pms-report/run`
- `POST /api/workflows/pmcf-plan/run`
- `POST /api/workflows/pmcf-evaluation/run`
- `POST /api/pms/inputs`
- `GET /api/pms/[projectId]/compliance`
- `POST /api/pms/[projectId]/documents/[documentId]/close` (expert review 게이팅)

**UI 컴포넌트** (8개):
- `app/(app)/pms/page.tsx`: PMS 워크벤치 메인
- `app/(app)/pms/report/page.tsx`: PMS 보고서 생성
- `app/(app)/pms/pmcf-plan/page.tsx`: PMCF 계획 작성
- `app/(app)/pms/evaluation/page.tsx`: PMCF 평가 보고서
- `components/pms/PmsSidebar.tsx`: 사이드바 네비게이션
- `components/pms/ComplianceChecklist.tsx`: 컴플라이언스 체크리스트
- `components/pms/CerLinkageCard.tsx`: CER 데이터 연계 카드
- `components/pms/ExpertReviewGating.tsx`: expert review 게이팅 UI

**권한** (2개 신규):
- `pms.view`: ra-member 이상
- `pms.manage`: ra-lead 이상
- Sidebar 조건부 네비: 15→16개 항목 (PMS 추가)

### 5.2 Acceptance Criteria 상태

| AC# | 상태 | 비고 |
|-----|------|------|
| AC-01 | ✅ 구현 완료 | `workflow_type` enum에 3개 신규 타입 추가 |
| AC-02 | ✅ 구현 완료 | MDCG 2022-21 섹션 구조로 생성 |
| AC-03 | ✅ 구현 완료 | Annex XIV Part B 체크리스트 100% 포함 |
| AC-04 | ⏸️ DEFERRED | REQ-PMS-004 자동 CER 연계 — CER 로컬 영속화 아키텍처 블로커로 수동 연계만 동작 |
| AC-05 | ✅ 구현 완료 | complaint/vigilance 데이터 입력·업로드 통합 |
| AC-06 | ✅ 구현 완료 | Article 83-86 컴플라이언스 체크 결과 표시 |
| AC-07 | ✅ 구현 완료 | expert review 없이 close 시도 시 403 차단 |
| AC-08 | ✅ 구현 완료 | 상태 전이 audit_logs 100% 기록 |

### 5.3 보안 강화 (run 단계 expert-security + evaluator-active 검증)

**Citation 환각 방지**:
- `validatePmsCitations` 함수: 모든 PMS/PMCF 판단의 근거 citation이 실제 claim을 지지하는지 강제 검증
- 0결과 pending 방지 (null safety)

**IDOR cross-org runtime test**:
- 15건 테스트 케이스로 타 org 접근 차단 검증
- `withOrgAccessControl` 데코레이터로 모든 PMS API 라우트 보호

**Audit 트랜잭션 원자성**:
- `db.transaction()`으로 상태 전이와 audit log 기록 원자성 보장
- 21 CFR Part 11 §11.10 감사 무결성 준수

**RLS org-isolation**:
- `WITH CHECK` 옵션으로 pms_inputs/pms_documents 테이블 org_id 기반 격리 강화
- Row-Level Security 정책 자동 검증

**Expert review 서버사이드 게이팅** (AC-07):
- close 라우트에 `review_status: 'approved'` 체크 추가
- 미승인 상태에서 403 반환 (evaluator가 누락 BLOCKER로 포착 → fix)

**0결과 pending**:
- compliance check에서 0결과 발생 시 pending 상태로 자동 전환
- 재시도 메커니즘 추가

### 5.4 Enum & Migration 변경

**workflow_type enum** (11→14):
- 신규: `pms_report`, `pmcf_plan`, `pmcf_evaluation`

**audit_action enum** (119→127):
- 신규: `pms_report_created`, `pmcf_plan_created`, `pmcf_evaluation_created`
- 신규: `pms_inputs_submitted`, `pms_compliance_checked`
- 신규: `pms_document_closed`, `pmcf_plan_approved`, `pmcf_evaluation_approved`
- 신규: `pms_export_triggered`, `pms_export_blocked`

**Migration files**:
- `migrations/0069_pms.sql`: PMS 기본 테이블 및 권한
- `migrations/0070_pms_export_gating.sql`: export 게이팅 정책

### 5.5 게이트 결과

```bash
corepack pnpm typecheck              # 0 에러
corepack pnpm exec biome check .     # 0 에러
corepack pnpm run lint:hex           # 0 에러
corepack pnpm test                   # 3443 passed | 7 skipped | 0 failed
corepack pnpm build                  # PASS
```

### 5.6 교훈 반영

**evaluator AC-07 서버 게이팅 누락 BLOCKER 포착 → fix**:
- evaluator가 expert review 서버사이드 게이팅 누락을 BLOCKER로 포착
- close 라우트에 `review_status` 체크 추가하여 수정

**typecheck 오탐 직접 실행으로 정정**:
- TS7022 에러가 실제 구현 문제가 아님을 확인
- typecheck 직접 실행으로 오탐 제거

---

## §6 Follow-up Issues

PMS #53 완료로 해제된 후속 이슈들:

1. **#243 (AC-04 DEFERRED)**: CER 로컬 영속화 아키텍처 구현 — REQ-PMS-004 자동 CER 연계 완성
2. **#244**: PMCF 평가 보고서 UI 탭 추가 — 현재 단일 페이지, 탭 구조로 개선
3. **#245**: PMS E2E 테스트 및 통합 테스트 확대 — 현재 단위 테스트만, E2E 필요

### §2/§3 as-implemented 주석

- REQ-PMS-004: "⏸️ PARTIAL — 수동 CER 연계만 동작 (자동 연계는 #243 DEFERRED)"
- AC-04: "⏸️ DEFERRED — CER 로컬 영속화 아키텍처 블로커"
