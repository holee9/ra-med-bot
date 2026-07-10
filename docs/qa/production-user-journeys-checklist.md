# Production User Journeys — E2E QA Checklist (#202, BLOCK-5)

> 수동/자동 QA 체크리스트 for 프로덕션급 사용자 여정. Issue #202 (Frontend QA E2E)의 "핵심 화면 수동 QA 체크리스트 작성" AC.
> 작성일: 2026-07-11 | 근거: production-deployment-gap BLOCK-5 + #202

이 체크리스트는 Playwright E2E 자동화의 선행 명세다. 각 여정은 (1) 수동 QA 단계 + (2) 자동화 가능한 selector/trigger로 구성된다. 기존 E2E(`tests/e2e/rag-citation.spec.ts`, `export-hub.spec.ts`, `expert-review.spec.ts`, `consultation.spec.ts`)가 조각을 커버하나, **여정 전체를 한 흐름으로 검증하는 시나리오가 부족** — 본 체크리스트가 그 갭을 정의한다.

---

## Journey 1: Q&A → Citation → Export (핵심 가치 흐름)

**목표**: 사용자가 규제 질문 → RAG 답변 + 인용 → 인용된 답변 export까지 한 흐름으로 완수.

### 수동 QA 단계
1. `/chat` 진입 → composer에 규제 질문 입력 (예: "FDA 510(k) submission 요건").
2. 스트리밍 답변 렌더링 → 답변 텍스트에 `<sup>` 인용 마커 + citation 블록 표시.
3. citation 블록: source title + corpus name + page reference 표시.
4. citation 클릭 → DocViewer/소스 뷰로 deep-link 이동 (anchor 점프).
5. ExportButton → export 포맷 선택(Markdown/DOCX/PDF) → 다운로드/내보내기.
6. export된 산출물에 인용 메타 + 규제 출처 포함.

### 자동화 selector/trigger (기존 패턴)
- composer: `[data-testid="chat-composer"]`
- citation: `[data-testid="citation-block"]`, `[data-testid="citation-source-title"]`
- test trigger: `__test:citation_response__` (결정적 2-citation 응답)
- export: ExportButton + `__test:export_response__` (export-hub 패턴, `sampleCitations` fixture)
- **갭**: 두 trigger를 한 흐름으로 연결하는 journey spec (`qa-citation-export-journey.spec.ts` — 후속 구현, #202).

### 수용 기준
- [ ] 질문 → 답변 → 인용 → export가 중단 없이 한 흐름.
- [ ] export 산출물에 인용 출처 포함 (Charter [지양-2] citation 강제).
- [ ] 인용 없는 답변은 export 게이트/비활성화 (negative path).

---

## Journey 2: Workflow → Expert Sign-off (규제 통제 흐름)

**목표**: 워크플로우(510(k)/감사대응/적응증영향) 실행 → draft 생성 → Expert Review Gate → sign-off → export.

### 수동 QA 단계
1. `/workflows/{type}` 진입 → 입력 제출 → 202 + SSE 스트리밍(`/events`).
2. section-by-section draft 스트리밍 렌더링 (run_start → step_start → step_delta → step_complete → run_complete).
3. draft `_mock` 플래그 부재 (Phase 2 전환 후 real gx10).
4. Expert Review Gate: review_required=true → export 차단 (review 전).
5. RA-owner sign-off (review_status: pending→approved) → `workflow.approve` audit.
6. sign-off 후 export 허용 → 산출물 다운로드.

### 자동화 selector/trigger
- 워크플로우 실행: `POST /api/ra/workflows/{type}` (202) + `/events` SSE (Phase 2 M4).
- review gate: `workflow_runs.review_required` + `review_status` (lib/workflows/_shared/review-gate.ts).
- audit: `workflow.approve` / `workflow.expert_flagged` / `workflow.export_blocked`.
- **갭**: 워크플로우 실행→sign-off→export 전 여정 E2E spec (workflow → sign-off journey).

### 수용 기준
- [ ] Expert Review Gate 없이 export 차단 (Charter [지양-2] 가짜 신뢰 방지).
- [ ] sign-off 후에만 export (Part 11 §11.10 서명 요건).
- [ ] audit에 review/approve/export 이벤트 기록.

---

## Journey 3: Impact Wizard (적응증 변경 영향)

**목표**: 적응증 변경 → 4-layer impact wizard → 신호등 + retest matrix + RA Inbox 티켓.

### 수동 QA 단계
1. `/impact` 진입 → 4-step wizard (제품/카테고리/상세/시장) 입력.
2. Layer 1 retest matrix(7×5=35셀) 결정론 표시.
3. Layer 2 gx10 LLM 카테고리 분류 + confidence.
4. Layer 3 confidence < 80% → RA Inbox 티켓 자동 생성.
5. Layer 4 ra-llm-wiki RAG 유사 사례 3건 (citation 강제).
6. 결과 페이지: 신호등(녹/황/적) + matrix + LLM 분류 + 유사 사례 + TicketCTA.

### 자동화 selector/trigger
- wizard: `app/(app)/impact/page.tsx` + ImpactWizard 컴포넌트 (SPEC-V3-IMPACT-UI-001).
- 신호등: `--color-signal-*` semantic tokens.
- 티켓: RA Inbox direct DB INSERT (Layer 3).
- **갭**: impact wizard 전 여정 E2E spec (4-step → 결과 → 티켓).

### 수용 기준
- [ ] 4-step 입력 → 신호등 + matrix + 유사 사례 표시.
- [ ] confidence < 80% → 티켓 생성.
- [ ] citation 강제 (Layer 4, [지양-2]).

---

## Journey 4: Hybrid RA 연동 (#202 원본)

**목표**: hybrid-ra-saas ↔ Regula 사용자 여정 (프론트엔드 기준).

### 수동 QA 단계
1. IFU parse result 수신 확인 (hybrid-ra-saas → Regula).
2. knowledge sync 완료/실패 상태 확인 (Phase 1 knowledge_sources).
3. RAG 답변 provenance 확인 (인용 출처).
4. audit/export 이벤트 확인.
5. auth/tenant 만료 또는 권한 오류 UX.

### 수용 기준 (#202)
- [ ] hybrid-ra-saas 백엔드 수정 없이 프론트엔드 여정만 검증.
- [ ] E2E 체크리스트 재현 가능.
- [ ] 사용자 문서와 화면 상태 일치.

---

## 자동화 우선순위 (후속 Playwright specs)
1. `qa-citation-export-journey.spec.ts` (Journey 1) — 가장 높은 가치(핵심 Q&A 가치).
2. `workflow-signoff-journey.spec.ts` (Journey 2) — 규제 통제.
3. `impact-wizard-journey.spec.ts` (Journey 3) — impact wizard.
4. hybrid-ra-saas 여정 (Journey 4) — hybrid-ra-saas 백엔드 의존.

각 spec은 기존 env-guard(`requiresAuthState`/`requiresLiveServer`) + test trigger 패턴을 준수 → CI webServer 기동 시 실행, 미기동 시 skip.

---

## 스크린샷/문서 최신화
- 각 여정 완료 후 스크린샷 캡처 → `docs/qa/screenshots/` (후속).
- 사용자 가이드와 실제 화면 흐름 일치화 (여정 변경 시 문서 업데이트).

---

Version: 1.0.0 | Author: orchestrator (Phase 5 BLOCK-5, #202) | Refs: production-deployment-gap BLOCK-5, #202, SPEC-V3-IMPACT-UI-001, SPEC-REGULA-WORKFLOWS-LLM-002
