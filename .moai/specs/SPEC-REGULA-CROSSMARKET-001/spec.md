---
id: SPEC-REGULA-CROSSMARKET-001
version: 1.0.0
status: draft
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 42
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-STRATEGY-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-CROSSMARKET-001 — 멀티 관할권 갭 분석기 (기존 허가 → 신규 시장 진출 요건)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #42 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

의료기기 RA 업무에서 멀티-관할권 진출은 매우 일반적인 시나리오다. 그러나 현재 Regula는 각 관할권에 대해 독립적으로만 답변할 뿐, "이미 A 시장에서 허가를 받았을 때, B 시장 진출에 추가로 필요한 것은 무엇인가"를 분석하지 못한다.

RA 팀이 실제로 마주하는 질문은 다음과 같다. "FDA 510(k) 클리어런스를 받았다. EU CE mark를 위해 추가로 무엇이 필요한가?", "MFDS 허가가 있다. 미국 진출 시 510(k)가 필요한가, De Novo인가?", "EU MDR CER을 작성했다. PMDA 승인에 이 임상 데이터를 재활용할 수 있는가?"

이 갭 분석은 현재 수동으로 4~6주가 소요된다. 본 SPEC은 기존 허가 현황을 입력받아 목표 관할권 진출에 필요한 추가 요건과 재활용 가능 항목을 자동으로 분석하여 갭 분석 보고서를 생성한다.

본 기능은 전략 생성기(#40)의 상위 레벨 통합에서 활용되며, 5 corpus retriever, predicate search, CER builder, submission lifecycle 데이터를 결합한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA: 510(k)/PMA 클리어런스 데이터, 21 CFR Part 807/814
- EU MDR: Regulation (EU) 2017/745, CE marking, CER (Clinical Evaluation Report), PMCF
- MFDS: 의료기기법 품목허가
- PMDA: PMD Act 승인, bridging study 요건
- NMPA: 의료기기 등록
- 데이터 공용: 관할권 간 임상 데이터 재활용 범위, 기술문서 공용 섹션

### 1.3 본 SPEC의 범위 (In Scope)

- A. 기존 허가 인식: 사용자 입력 또는 프로젝트 정보에서 보유 허가 현황 파악 (FDA 510(k)/PMA, EU MDR CE, MFDS 품목허가, PMDA 승인, NMPA 등록)
- B. 갭 분석 엔진: 기존 허가 → 목표 관할권 갭 분석 (추가 임상 데이터, 현지화 요건, 현지 대리인/법인, 기술문서 추가 항목, 규제 경로 차이) 및 재활용 가능 항목 식별
- C. 갭 우선순위 및 경로 최적화: 갭 항목별 난이도/기간 예측, 의존성 고려한 해소 순서 제안
- D. 갭 분석 보고서: Markdown + DOCX export, 관할권별 갭 요약 테이블, 재활용 항목 하이라이트, 항목별 citation

### 1.4 Out of Scope

- 실제 외부 기관 제출 대행
- 현지 법인 설립 컨설팅
- 관세/수입 인증 (CE marking 이외 국가별 수입 허가)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CROSSMARKET-001 | WHEN a user inputs current approval status THE SYSTEM SHALL recognize the held approvals (FDA 510(k)/PMA, EU MDR CE, MFDS 품목허가, PMDA 승인, NMPA 등록). | High |
| REQ-CROSSMARKET-002 | WHERE project information is available THE SYSTEM SHALL auto-detect held approvals from the project context. | Medium |
| REQ-CROSSMARKET-003 | WHEN a user specifies a target jurisdiction THE SYSTEM SHALL perform a gap analysis from the held approvals to the target jurisdiction. | High |
| REQ-CROSSMARKET-004 | WHEN gap analysis runs THE SYSTEM SHALL categorize gap items by type (additional clinical data, localization, local representative/entity, additional technical documentation, regulatory path differences). | High |
| REQ-CROSSMARKET-005 | WHEN gap analysis runs THE SYSTEM SHALL identify reusable items including shared clinical data scope and shared technical documentation sections. | High |
| REQ-CROSSMARKET-006 | WHEN gap items are produced THE SYSTEM SHALL estimate difficulty (High/Medium/Low) and duration for each gap item. | Medium |
| REQ-CROSSMARKET-007 | WHEN gap items are produced THE SYSTEM SHALL propose an optimal resolution order considering dependencies between items. | Medium |
| REQ-CROSSMARKET-008 | WHEN a gap analysis report is generated THE SYSTEM SHALL produce a per-jurisdiction gap summary table (item, current state, required state, gap type). | High |
| REQ-CROSSMARKET-009 | WHEN a gap analysis report is generated THE SYSTEM SHALL highlight reusable items distinctly from additionally required items. | High |
| REQ-CROSSMARKET-010 | WHEN any gap item is reported THE SYSTEM SHALL include a regulatory basis citation with a source link. | High |
| REQ-CROSSMARKET-011 | WHEN a gap analysis report is generated THE SYSTEM SHALL support export to Markdown and DOCX formats. | High |
| REQ-CROSSMARKET-012 | IF a high-risk gap is detected THEN THE SYSTEM SHALL automatically flag it for expert review. | High |
| REQ-CROSSMARKET-013 | WHEN retrieval is performed THE SYSTEM SHALL query the 5-corpus retrievers to source jurisdiction-specific requirements. | High |
| REQ-CROSSMARKET-014 | WHEN a gap analysis session completes THE SYSTEM SHALL record an audit log entry with session metadata. | High |
| REQ-CROSSMARKET-015 | WHILE a user lacks the required role for gap analysis THE SYSTEM SHALL deny access and return an authorization error. | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 기존 허가 현황 + 목표 관할권 입력 시 갭 분석 보고서가 생성된다. | Test |
| AC-02 | 재활용 가능 항목과 추가 필요 항목이 명확히 구분된다. | Test / Review |
| AC-03 | 각 갭 항목에 규제 근거 citation(출처 링크)이 포함된다. | Test |
| AC-04 | DOCX 보고서가 export된다. | Test |
| AC-05 | 고위험 갭이 자동으로 expert review 플래그된다. | Test |
| AC-06 | promptfoo eval 시나리오 FDA→EU MDR, MFDS→FDA, EU MDR→PMDA 3가지가 통과한다. | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `app/(workflows)/crossmarket/page.tsx` — 갭 분석기 진입 UI
- `app/api/crossmarket/route.ts` — 갭 분석 세션 API (SSE)
- `lib/crossmarket/approval-recognizer.ts` — 기존 허가 인식
- `lib/crossmarket/gap-engine.ts` — 갭 분석 엔진
- `lib/crossmarket/path-optimizer.ts` — 갭 우선순위 및 경로 최적화
- `lib/crossmarket/report-builder.ts` — Markdown/DOCX 보고서 생성

### 4.2 DB Schema

- `crossmarket_analyses` (신규): 갭 분석 세션 결과 저장 (held_approvals, target_jurisdiction, gap_items JSON, confidence_score, expert_review_required)
- `audit_logs` (기존): 세션 metadata 기록

### 4.3 API Endpoints

- `POST /api/crossmarket` — 갭 분석 세션 생성 (입력: held approvals + target jurisdiction), SSE 응답
- `GET /api/crossmarket/[id]/export?format=md|docx` — 보고서 export

### 4.4 의존성

- SPEC-REGULA-BREADTH-001 (5 corpus retrieval)
- #22 Predicate Search (FDA 경로 근거)
- #23 CER Builder (EU MDR 경로 근거)
- #40 Regulatory Strategy Generator (전략 레벨 통합)
- #37 Submission Lifecycle (기존 허가 데이터)
