---
id: SPEC-REGULA-WORKFLOWS-LLM-002
version: 1.0.0
status: draft
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 39
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-PREDICATE-001
  - SPEC-REGULA-CER-001
  - SPEC-REGULA-PCCP-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/rag
---

# SPEC-REGULA-WORKFLOWS-LLM-002 — 워크플로우 LLM 실제 구현 (510(k)·감사대응·적응증영향 executor)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #39 기반. SPEC-REGULA-WORKFLOWS-001(stub)의 mock executor를 실제 LLM 구현으로 승격. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula의 핵심 가치 제안은 "규제 문서 초안을 AI로 자동 생성한다"이다. 그러나 현재 `lib/workflows/*/executor.ts`의 세 개 executor(`submission-drafter`, `audit-response`, `indication-impact`)는 전체가 mock 구현으로, `_mock: true` 플래그가 붙은 고정 응답을 반환한다. 이로 인해 Predicate Search(#22), CER Builder(#23), PCCP Builder(#24)의 산출물이 실제 문서 생성으로 이어지지 못하고 데모 수준에 머물러 있다.

#33 Release Hardening은 워크플로우 실제 LLM 구현을 명시적으로 "범위 외"로 연기하면서 본 SPEC(SPEC-REGULA-WORKFLOWS-LLM-002)을 후속 작업으로 지정했다. SPEC-REGULA-WORKFLOWS-001은 executor 인터페이스 계약과 SSE streaming 계약을 정의한 stub SPEC이며, 본 SPEC은 그 계약을 유지한 채 실제 LLM 호출을 채워 넣는다.

510(k) Submission Drafter는 FDA 510(k) eCopy 구조(커버레터, 목차, 기기 설명, 용도, 기술 특성, 성능 데이터)에 따라 Predicate 데이터를 입력받아 section-by-section streaming draft를 생성해야 한다. Audit Response Drafter는 FDA Form 483 / Warning Letter / EU MDR notified body 지적 사항에 대해 regulatory basis + corrective action + timeline 3-part 구조의 대응 초안을 생성한다. Indication Impact Analyzer는 적응증 변경 입력에 대해 substantial equivalence 재평가, EU MDR classification 변경, 임상 데이터 추가 필요 여부의 규제 영향 체인을 분석한다.

세 executor 공통으로 citation 강제(규제 원문 + predicate/CER 데이터 인용)와 expert review gate(review 없이 export 차단)가 의료기기 규제 안전성의 핵심 통제이다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 510(k) Program Guidance (2014) 및 eCopy Program Guidance (2023): eCopy 구조·형식 준수
- 21 CFR 807 Subpart E: Premarket Notification 510(k) 요구사항
- FDA Form 483 / Warning Letter 대응 프로세스 (21 CFR 820 QSR)
- EU MDR (2017/745) Article 52, Annex II/III: 적합성 평가 및 기술 문서
- 21 CFR Part 11: 전자 기록·서명, audit trail 무결성

### 1.3 본 SPEC의 범위 (In Scope)

- 세 executor의 mock 제거 및 실제 Sonnet 기반 streaming LLM 구현
- FDA 510(k) eCopy 섹션 구조 기반 draft 생성
- 감사 지적 사항별 3-part 대응 초안 생성 (hybrid retrieval: 사내 SOP + 규제 corpus)
- 적응증 영향 체인 분석 (3개 판단 축)
- 공통 인프라: SSE streaming chain, audit_logs 이벤트, citation enforcement
- promptfoo eval 시나리오 6건 이상 (각 executor × 2)

### 1.4 Out of Scope

- EU eCTD / FDA eSTAR 실제 mTLS 제출 (SPEC-REGULA-EXTERNAL-001)
- 제출 포털 자동 업로드
- 실시간 FDA CDRH 피드백 통합
- 새로운 워크플로우 타입 추가 (PMS/CAPA 등은 별도 SPEC)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-WFLLM-001 | WHEN 사용자가 510(k) Submission Drafter를 실행하면 THE SYSTEM SHALL Predicate Search 결과를 입력으로 받아 FDA eCopy 6개 섹션의 실제 LLM draft를 생성한다 | High |
| REQ-WFLLM-002 | WHILE draft가 생성되는 동안 THE SYSTEM SHALL 기존 SSE 계약에 따라 section-by-section streaming으로 응답을 전송한다 | High |
| REQ-WFLLM-003 | WHEN audit-response executor가 지적 사항을 입력받으면 THE SYSTEM SHALL regulatory basis + corrective action + timeline 3-part 구조의 대응 초안을 생성한다 | High |
| REQ-WFLLM-004 | WHEN audit-response가 컨텍스트를 수집하면 THE SYSTEM SHALL 사내 SOP corpus와 관련 규제 corpus를 동시에 hybrid retrieval로 검색한다 | High |
| REQ-WFLLM-005 | WHEN indication-impact executor가 적응증 변경을 입력받으면 THE SYSTEM SHALL 510(k) substantial equivalence 재평가, EU MDR classification 변경, 임상 데이터 추가 필요 여부를 각각 판단한다 | High |
| REQ-WFLLM-006 | THE SYSTEM SHALL 모든 draft 섹션의 citation coverage가 80% 이상이 되도록 규제 출처 인용을 강제한다 | High |
| REQ-WFLLM-007 | IF draft에 expert review가 완료되지 않았다면 THEN THE SYSTEM SHALL export를 차단한다 | High |
| REQ-WFLLM-008 | WHEN executor가 LLM을 호출하면 THE SYSTEM SHALL `workflow.llm_call`, `workflow.draft_version`, `workflow.expert_flagged` 이벤트를 audit_logs에 기록한다 | High |
| REQ-WFLLM-009 | THE SYSTEM SHALL 세 executor의 응답에서 `_mock: true` 플래그를 제거한다 | High |
| REQ-WFLLM-010 | IF LLM 호출이 실패하거나 timeout/rate limit에 도달하면 THEN THE SYSTEM SHALL 명확한 오류를 반환하고 부분 draft를 저장한다 | High |
| REQ-WFLLM-011 | THE SYSTEM SHALL 510(k) draft가 FDA 2023 eCopy guidance 형식을 준수하는지 검증한다 | Medium |
| REQ-WFLLM-012 | WHEN 세 executor 구현이 완료되면 THE SYSTEM SHALL `/workflows` UI의 Beta 배지를 제거한다 | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | `lib/workflows/submission-drafter/executor.ts`에 `_mock: true` 없음 | grep + unit test |
| AC-02 | `lib/workflows/audit-response/executor.ts`에 `_mock: true` 없음 | grep + unit test |
| AC-03 | `lib/workflows/indication-impact/executor.ts`에 `_mock: true` 없음 | grep + unit test |
| AC-04 | 각 executor가 streaming SSE로 실제 LLM 응답 반환 | integration test (SSE 수신 검증) |
| AC-05 | 모든 draft 섹션 citation coverage ≥ 80% | promptfoo eval assertion |
| AC-06 | expert review 없이 export 시도 시 차단됨 | E2E negative test |
| AC-07 | `pnpm eval:ci` 워크플로우 시나리오 80% 이상 통과 | CI eval run |
| AC-08 | promptfoo 시나리오 6건 이상 (executor × 2) 존재 | eval config 검토 |

---

## §4 Technical Approach

### 4.1 파일 구조

```
lib/workflows/
  submission-drafter/executor.ts   # FDA 510(k) eCopy 섹션 streaming draft
  audit-response/executor.ts        # 3-part 대응 초안 + hybrid retrieval
  indication-impact/executor.ts     # 적응증 영향 체인 3축 분석
  _shared/
    streaming-chain.ts              # Sonnet streaming chain 공통 구성
    citation-enforcer.ts            # citation coverage 검증
    review-gate.ts                  # expert review export 차단
evals/workflows/                    # promptfoo 시나리오 6건+
```

### 4.2 DB Schema

기존 `workflows`, `workflow_runs`, `audit_logs` 테이블 재사용. `workflow_runs`에 `draft_version`, `citation_coverage`, `review_status`(pending|approved|rejected) 컬럼이 없다면 추가. `_mock` 관련 메타데이터 컬럼 제거 또는 deprecate.

### 4.3 API Endpoints

기존 SSE 계약 유지:
- `POST /api/workflows/[type]/run` — executor 실행, SSE streaming 응답
- `GET /api/workflows/runs/[id]` — draft 버전·citation·review 상태 조회
- `POST /api/workflows/runs/[id]/export` — review_status=approved일 때만 허용

### 4.4 의존성

- #22 Predicate Search Engine (510k drafter input)
- #23 CER Builder (audit-response context)
- #24 PCCP Builder (indication impact context)
- SPEC-REGULA-WORKFLOWS-001 (executor interface contract)
- #33 Release Hardening (mock → beta 플래그 제거 후 진행)
- Anthropic Sonnet (streaming LLM), pgvector hybrid retrieval
