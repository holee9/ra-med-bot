# Acceptance Criteria — SPEC-REGULA-WORKFLOWS-LLM-002

> 작성일: 2026-07-10 | 매핑: #39 + REQ-WFLLM-001..012 | LLM: gx10 Ollama gpt-oss:120b (SPEC-LLM-MIGRATION-BC)
> 검증: 단위 + 통합(SSE) + promptfoo eval + E2E(negative). mock-only 기각 (L-013).

## 1. Mock 제거 (AC-01..03)

### AC-01: submission-drafter `_mock: true` 제거 + 실제 gx10 호출
**Given**: `lib/workflows/submission-drafter/executor.ts` 가 Beta scaffold(synthetic output + `_mock:true`)다.
**When**: M1 구현 완료.
**Then**:
- `executeStep` 가 `getLlmModel()`(gx10 gpt-oss:120b) 경유 실제 LLM 호출로 각 step 출력 생성.
- `_mock: true` 플래그 제거 (grep 직검 0건).
- `review_required: true` 유지 (Expert Review Gate, REQ-WFLLM-007).
**매핑**: REQ-WFLLM-001/002/009 / Milestone M1

### AC-02: audit-response `_mock: true` 제거 + 3-part 구조 + hybrid retrieval
**Given**: `lib/workflows/audit-response/executor.ts` 가 synthetic.
**When**: M2 구현 완료.
**Then**: executeStep가 gx10 호출로 regulatory basis + corrective action + timeline 3-part 대응 초안 생성. 사내 SOP + 규제 corpus hybrid retrieval. `_mock:true` 제거.
**매핑**: REQ-WFLLM-003/004/009 / M2

### AC-03: indication-impact `_mock: true` 제거 + 3축 판단
**Given**: `lib/workflows/indication-impact/executor.ts` 가 synthetic.
**When**: M3 구현 완료.
**Then**: executeStep가 gx10 호출로 510(k) SE 재평가 / EU MDR classification 변경 / 임상 데이터 추가 필요 3축 판단 (각 citation 포함). `_mock:true` 제거.
**매핑**: REQ-WFLLM-005/009 / M3

## 2. Streaming + Citation + Review Gate (AC-04..06)

### AC-04: SSE streaming 실제 LLM 응답
**Given**: executor가 gx10 LLM 호출.
**When**: `POST /api/workflows/[type]/run` 호출.
**Then**: 기존 SSE 계약(SPEC-REGULA-WORKFLOWS-001) 준수 section-by-section streaming 응답. 통합 테스트가 SSE 이벤트 수신 검증 (mock 아님 — 실제 gx10 streamText).
**매핑**: REQ-WFLLM-002 / M0(streaming-chain), M1-M3

### AC-05: citation coverage ≥ 80%
**Given**: 각 draft 섹션 생성.
**When**: citation-enforcer 검증.
**Then**: 모든 draft 섹션의 citation coverage ≥ 80% (규제 원문 + predicate/CER 데이터 인용). 미달 시 `citation_coverage_low` audit + 재시도/거부.
**매핑**: REQ-WFLLM-006 / M0(citation-enforcer)

### AC-06: expert review 없이 export 차단
**Given**: draft 생성 완료, review_status ≠ approved.
**When**: `POST /api/workflows/runs/[id]/export` 호출.
**Then**: export 차단 (403) + `workflow.expert_flagged` audit. review_status=approved일 때만 허용. E2E negative test.
**매핑**: REQ-WFLLM-007/008 / M0(review-gate)

## 3. Eval + UI (AC-07..08)

### AC-07: promptfoo eval 80%+ 통과
**Given**: evals/workflows/ 시나리오 6건+ (executor × 2).
**When**: `pnpm eval:ci` 실행.
**Then**: 워크플로우 시나리오 80%+ 통과. gx10 기반 (실제 LLM 평가).
**매핑**: REQ-WFLLM-006/011 / M5

### AC-08: promptfoo 시나리오 6건+ 존재
**Given**: eval config.
**When**: 검토.
**Then**: `evals/workflows/` 에 submission-drafter/audit-response/indication-impact 각 ≥2건 시나리오 존재.
**매핑**: REQ-WFLLM-006 / M5

## 4. 품질 게이트 (AC-09)

### AC-09: 게이트 통과 (L-008/009/013/015)
**Given**: M0-M5 완료.
**When**: 게이트 실행.
**Then**: typecheck 0 · lint(lint:hex) 0 · full `pnpm test` 0 failures · ci:* 전 단계 0 failures (로컬 직검) · migration 실DB 적용(L-010). `_mock` 잔존 grep 0건.
**매핑**: 전 REQ / M5

## 5. 엣지 케이스
- **EC-1 LLM 실패/timeout**: REQ-WFLLM-010 — 명확한 오류 + 부분 draft 저장 + audit.
- **EC-2 citation coverage 미달**: 재시도 → 실패 시 `citation_coverage_low` audit + draft 거부.
- **EC-3 gx10 미도달**: 로컬/gx10 가용 시에만 실 LLM (테스트는 gx10 가용 가정; CI는 mock/LLM-eval 분리).

## 6. Definition of Done
- [ ] AC-01..09 통과 · [ ] `_mock:true` 전 제거(grep 0) · [ ] gx10 단일(OpenAI/Anthropic runtime 0) · [ ] migration 실DB · [ ] SPEC-WORKFLOWS-001 SSE 계약 불변 · [ ] Expert Review Gate 불변 · [ ] promptfoo 6건+ 80%+.
