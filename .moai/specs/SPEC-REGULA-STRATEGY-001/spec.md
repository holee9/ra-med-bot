---
id: SPEC-REGULA-STRATEGY-001
version: 1.0.0
status: draft
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 40
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-STRATEGY-001 — 멀티 관할권 규제 전략 생성기 (Killer Feature)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #40 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

현재 Regula는 "어떤 규제가 어떻게 적용되는가"에 답한다. 그러나 RA(Regulatory Affairs) 책임자가 실제로 가장 필요로 하는 것은 단순한 질의응답이 아니라 전략 합성(strategy synthesis)이다. 즉 "이 기기(예: 임플란트형 심장 모니터, AI 지원 ECG)에 대해 FDA, EU MDR, MFDS, PMDA에서 어떤 경로로 어떤 순서로 진행해야 하는가? 총 소요 기간, 필요 임상 데이터, 주요 리스크는 무엇인가?"에 대한 통합 답변이다.

이 기능은 Regula를 경쟁사와 차별화하는 킬러 기능(killer feature)이다. 단일 RAG 질의로는 해결할 수 없으며, RAG + 5개 corpus + predicate DB + 규제 분류 체계 + 임상 요건 매트릭스를 결합해야 가능하다.

전략 합성은 기기 규제 분류 분석, 관할권별 최적 규제 경로 추천, 임상 데이터 갭 분석, 그리고 전략 보고서 생성으로 구성된다. 또한 보고서 생성 이후에도 RA 책임자가 후속 질의(follow-up)를 통해 시나리오를 탐색할 수 있어야 한다.

본 기능은 기존 chat 컴포넌트, predicate search engine, CER builder, 5 corpus retriever, workflow framework를 통합하는 상위 레벨 워크플로우다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA: 21 CFR Part 807 (510(k)), Part 814 (PMA), De Novo classification (513(f)(2)), Exempt 분류
- EU MDR: Regulation (EU) 2017/745 Annex VIII (Rules 1-22), Article 61 (Clinical evaluation)
- MFDS: 의료기기법 등급분류(1~4등급), GMP 인증 및 품목 허가
- PMDA: 의료기기 클래스 I~IV 분류 (PMD Act)
- NMPA: 의료기기 등급 분류 (1~3등급)
- AI/ML SaMD: FDA 2019 AI/ML SaMD Action Plan, EU MDR Article 61 적용

### 1.3 본 SPEC의 범위 (In Scope)

- A. 기기 규제 분류 분석: FDA/EU MDR/MFDS/PMDA/NMPA 5개 관할권 분류 + AI/ML SaMD 해당 여부 판정
- B. 규제 경로 추천: 관할권별 최적 경로 추천 및 선택 근거(predicate availability, classification basis, clinical data sufficiency) 제시, 병렬 진행 가능 여부 분석
- C. 임상 데이터 갭 분석: 보유 데이터 vs 요구 데이터 비교, 공용 가능 데이터 식별, 추가 수집 필요 데이터 유형/규모 산출
- D. 전략 보고서 생성: 관할권별 타임라인 예측(±30% 불확실성 표시), 마일스톤/의사결정 포인트, 리스크 매트릭스, 우선순위 경로 제안, citation 명시
- E. 대화형 세션: 보고서 생성 후 follow-up 질의 지원, 각 턴마다 citation 유지

### 1.4 Out of Scope

- 실제 외부 기관 제출 (SPEC-REGULA-EXTERNAL-001 소관)
- 특허/IP 분석
- 보험/수가(reimbursement) 전략
- 외부 고객 대상 API 제공

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-STRATEGY-001 | WHEN a user submits a device description with current clinical/technical data summary THE SYSTEM SHALL return classification analysis for all 5 jurisdictions (FDA/EU MDR/MFDS/PMDA/NMPA). | High |
| REQ-STRATEGY-002 | WHEN classification analysis runs THE SYSTEM SHALL determine whether the device qualifies as AI/ML SaMD and apply the corresponding regulatory path branch. | High |
| REQ-STRATEGY-003 | WHEN a jurisdiction is analyzed THE SYSTEM SHALL recommend the optimal regulatory path (FDA: 510(k)/De Novo/PMA/Exempt; EU: Self-cert/Notified Body; MFDS: GMP+품목허가). | High |
| REQ-STRATEGY-004 | WHEN a path is recommended THE SYSTEM SHALL provide selection rationale citing predicate availability, classification basis, and clinical data sufficiency. | High |
| REQ-STRATEGY-005 | WHEN strategy synthesis runs THE SYSTEM SHALL analyze whether multiple jurisdiction submissions can proceed in parallel. | Medium |
| REQ-STRATEGY-006 | WHEN clinical gap analysis runs THE SYSTEM SHALL compare currently held data against each jurisdiction's required data and produce a gap list. | High |
| REQ-STRATEGY-007 | WHEN clinical gap analysis runs THE SYSTEM SHALL identify reusable data across jurisdictions (e.g., FDA 510(k) clinical data reuse for EU MDR PMCF). | Medium |
| REQ-STRATEGY-008 | WHEN a strategy report is generated THE SYSTEM SHALL include per-jurisdiction timeline predictions with ±30% uncertainty indicators. | High |
| REQ-STRATEGY-009 | WHEN a strategy report is generated THE SYSTEM SHALL include a risk matrix (High/Medium/Low × each jurisdiction). | High |
| REQ-STRATEGY-010 | WHEN a strategy report is generated THE SYSTEM SHALL propose a priority path (fast market entry vs broad coverage). | Medium |
| REQ-STRATEGY-011 | WHEN a strategy report is generated THE SYSTEM SHALL support export to DOCX and PDF formats. | High |
| REQ-STRATEGY-012 | IF the synthesis confidence score is below 0.8 THEN THE SYSTEM SHALL flag the report as requiring expert review. | High |
| REQ-STRATEGY-013 | WHEN a user submits a follow-up question after report generation THE SYSTEM SHALL respond using the existing chat component while preserving the strategy session context. | High |
| REQ-STRATEGY-014 | WHEN any answer or report section is produced THE SYSTEM SHALL maintain citations referencing classification basis and guidance documents. | High |
| REQ-STRATEGY-015 | WHEN retrieval is performed THE SYSTEM SHALL query FDA, EU MDR, MFDS, and PMDA corpora in parallel using per-corpus retrievers. | High |
| REQ-STRATEGY-016 | WHEN a strategy session completes THE SYSTEM SHALL persist the session to the workflow_runs table. | High |
| REQ-STRATEGY-017 | WHEN structured output is rendered THE SYSTEM SHALL emit Phase C SSE blocks (ComparisonTable, Checklist, Timeline, Callout). | Medium |
| REQ-STRATEGY-018 | IF a corpus retriever fails or times out THEN THE SYSTEM SHALL surface the failure and continue with available jurisdiction results rather than aborting the whole session. | High |
| REQ-STRATEGY-019 | WHEN a strategy session is created THE SYSTEM SHALL record an audit log entry with session metadata and confidence distribution. | High |
| REQ-STRATEGY-020 | WHILE a user lacks the required role for strategy generation THE SYSTEM SHALL deny access and return an authorization error. | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 기기 설명 입력 시 5개 관할권 분류 분석이 반환된다. | Test |
| AC-02 | 각 관할권별 최적 규제 경로가 citation과 함께 추천된다. | Test |
| AC-03 | 임상 데이터 갭 분석 섹션이 생성되며 재활용 가능 항목과 추가 필요 항목을 구분한다. | Test / Review |
| AC-04 | 전략 보고서가 DOCX 및 PDF로 export된다. | Test |
| AC-05 | 신뢰도 < 0.8인 경우 expert review 필요 표시가 나타난다. | Test |
| AC-06 | 보고서 생성 후 follow-up 대화 세션이 기존 chat 컴포넌트로 동작하며 citation을 유지한다. | Test / Review |
| AC-07 | promptfoo eval 시나리오 Class II wearable, Class III implant, AI/ML SaMD 각 1건 이상 통과한다. | Test |
| AC-08 | corpus retriever 실패 시에도 부분 결과가 보존되고 실패가 명시된다. | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `app/(workflows)/strategy/page.tsx` — 전략 생성기 진입 UI
- `app/api/strategy/route.ts` — 전략 세션 생성 API (SSE)
- `lib/strategy/synthesis.ts` — multi-jurisdiction synthesis (Sonnet, 긴 컨텍스트)
- `lib/strategy/classification-analyzer.ts` — 5 관할권 분류 분석
- `lib/strategy/path-recommender.ts` — 규제 경로 추천 엔진
- `lib/strategy/clinical-gap-analyzer.ts` — 임상 데이터 갭 분석
- `lib/strategy/report-builder.ts` — DOCX/PDF 보고서 생성
- `lib/strategy/retrievers.ts` — per-corpus 병렬 retriever (FDA/EU MDR/MFDS/PMDA)

### 4.2 DB Schema

- `workflow_runs` (기존 테이블 재활용): 전략 세션 저장. 컬럼 추가 검토 — `workflow_type='strategy'`, `confidence_score`, `expert_review_required`
- `audit_logs` (기존): 전략 세션 metadata 기록

### 4.3 API Endpoints

- `POST /api/strategy` — 전략 세션 생성 (입력: device description + clinical/technical data summary), SSE 스트림 응답
- `POST /api/strategy/[id]/followup` — follow-up 대화 질의
- `GET /api/strategy/[id]/export?format=docx|pdf` — 보고서 export

### 4.4 의존성

- #22 Predicate Search Engine (FDA 510(k) 경로 근거)
- #23 CER Builder (EU MDR 경로 근거)
- SPEC-REGULA-BREADTH-001 (5 corpus retriever)
- SPEC-REGULA-WORKFLOWS-001 (workflow framework)
- #39 WORKFLOWS-LLM-002 (workflow executor infra)
- Sonnet 모델 (multi-jurisdiction synthesis, 긴 컨텍스트)
