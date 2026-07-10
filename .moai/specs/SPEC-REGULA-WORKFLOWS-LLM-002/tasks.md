# Tasks & Milestones — SPEC-REGULA-WORKFLOWS-LLM-002

> 작성일: 2026-07-10 | LLM: gx10 Ollama gpt-oss:120b (SPEC-LLM-MIGRATION-BC, `getLlmModel`)
> 순서: M0(공통 인프라) → M1-M3(3 executor 병렬 가능) → M4(제거/배지) → M5(eval/게이트). 시간 추정 금지(L-007).

## Milestone 개요

| Milestone | 이름 | Priority | 선행 | 핵심 산출물 |
|-----------|------|----------|------|------------|
| M0 | 공통 인프라 (streaming-chain + citation-enforcer + review-gate + migration) | High | 없음 | `_shared/`, migration(draft_version/citation_coverage) |
| M1 | submission-drafter 실구현 (FDA 510(k) eCopy 6섹션) | High | M0 | executor.ts gx10 streaming |
| M2 | audit-response 실구현 (3-part + hybrid retrieval) | High | M0 | executor.ts gx10 |
| M3 | indication-impact 실구현 (3축 판단) | High | M0 | executor.ts gx10 |
| M4 | `_mock` 제거 + Beta 배지 제거 | High | M1-M3 | grep 0건, `/workflows` UI |
| M5 | promptfoo eval 6건+ + 게이트 | High | M1-M4 | evals/workflows/, typecheck/lint/test/ci |

---

## M0 — 공통 인프라

### Task M0-1: `_shared/streaming-chain.ts` — gx10 streaming 공통
- `getLlmModel()`(gx10 gpt-oss:120b) 기반 `streamText` 래퍼. 기존 SSE 계약(SPEC-WORKFLOWS-001) 준수. section-by-section chunk emit.
- 참조: `lib/domains/consult/run-consult.ts`, `lib/domains/triage/run-triage.ts` (gx10 streaming 패턴).
- **매핑**: REQ-WFLLM-002 / AC-04

### Task M0-2: `_shared/citation-enforcer.ts`
- draft 섹션별 citation coverage ≥ 80% 검증 (consult H-3 패턴 재사용: countSentences + `<sup>` 인용 비율). 미달 시 `citation_coverage_low` audit.
- **매핑**: REQ-WFLLM-006 / AC-05

### Task M0-3: `_shared/review-gate.ts`
- review_status ≠ approved 시 export 차단. `workflow_runs.reviewRequired`(기존, schema.ts:1409) 활용. `workflow.expert_flagged` audit.
- **매핑**: REQ-WFLLM-007/008 / AC-06

### Task M0-4: migration (draft_version, citation_coverage) — 실DB 검증(L-010)
- `workflow_runs` 에 `draft_version`(int), `citation_coverage`(numeric) 컬럼 추가 (직검: 현재 부재). migration 파일 + schema.ts + 실DB 적용.
- **매핑**: §4.2 / AC-09

---

## M1 — submission-drafter 실구현 (FDA 510(k) eCopy)
> 6 steps: device_classification / predicate_search / substantial_equivalence / performance_summary / labeling_review / submission_assembly. 현재 전부 synthetic.

### Task M1-1: 각 step gx10 실구현
- `executeStep` 를 `streaming-chain` + predicate search 결과(#22) 입력 + FDA eCopy 구조 프롬프트로 전환. structured output(Zod) per step. citation 강제.
- `_mock:true` 제거, `@MX:TODO` 제거.
- **매핑**: REQ-WFLLM-001/009/011 / AC-01

### Task M1-2: 단위/통합 테스트
- step별 단위(gx10 mock 또는 gx10 가용 시 실 호출) + SSE 통합. citation coverage assertion.
- **매핑**: AC-01/04/05

---

## M2 — audit-response 실구현 (3-part + hybrid retrieval)

### Task M2-1: 3-part 대응 초안 gx10 구현
- observation 입력 → regulatory basis + corrective action + timeline. 사내 SOP corpus(`ra-llm-wiki`) + 규제 corpus(`MD-process`) hybrid retrieval (per `docs/architecture/knowledge-base.md`). citation 강제.
- **매핑**: REQ-WFLLM-003/004/009 / AC-02

### Task M2-2: 테스트 — M1-2 패턴 준용.
- **매핑**: AC-02/04/05

---

## M3 — indication-impact 실구현 (3축 판단)

### Task M3-1: 3축 영향 체인 gx10 구현
- indication 변경 → 510(k) SE 재평가 / EU MDR classification 변경 / 임상 데이터 추가 필요. 각 판단 citation 포함.
- **매핑**: REQ-WFLLM-005/009 / AC-03

### Task M3-2: 테스트 — M1-2 패턴 준용.
- **매핑**: AC-03/04/05

---

## M4 — `_mock` 제거 + Beta 배지

### Task M4-1: `_mock:true` 전 제거 (grep 직검)
- 3 executor summary aggregation의 `_mock` 플래그 + `@MX:NOTE _mock flag` 주석 제거. grep `'_mock'` lib/workflows/ 0건.
- **매핑**: REQ-WFLLM-009 / AC-01..03

### Task M4-2: `/workflows` UI Beta 배지 제거
- **매핑**: REQ-WFLLM-012

---

## M5 — promptfoo eval + 게이트

### Task M5-1: `evals/workflows/` 시나리오 6건+ (executor × 2)
- gx10 기반 eval. citation coverage / 구조 준수 / 3-part / 3축 판단 assertion.
- **매핑**: REQ-WFLLM-006/011 / AC-07/08

### Task M5-2: 게이트 (L-008/009/010/013/015)
- typecheck 0 · lint(lint:hex) 0 · full `pnpm test` 0 failures · ci:* 0 failures · migration 실DB · `_mock` grep 0 · OpenAI/Anthropic runtime 0.
- **매핑**: AC-09

---

## 위험 추적

| 위험 | Milestone | 완화 | 상태 |
|------|-----------|------|------|
| gx10 streamText 안정성(timeout) | M0-1 | Promise.race 전체 타임아웃(run-triage 패턴) + 부분 draft 저장(REQ-WFLLM-010) | Open |
| citation coverage gx10 달성 | M0-2 | 재시도 + 미달 시 거부; consult H-3 패턴 | Open |
| LLM 호출 비용/지연(3 executor × 다중 step) | M1-M3 | gx10 온프레미스(과금 0); streaming으로 지연 분산 | Mitigated by gx10 |
| migration 실DB | M0-4 | L-010 실DB 적용 직검 | Open |

## 커밋 전략 (참고 — orchestrator/manager-git 관장)
- M0: `feat(workflows): _shared gx10 streaming-chain + citation-enforcer + review-gate + migration`
- M1-M3: `feat(workflows): {executor} synthetic → gx10 실구현`
- M4: `refactor(workflows): _mock 제거 + Beta 배지`
- M5: `test(workflows): promptfoo eval 6건+ + 게이트`
