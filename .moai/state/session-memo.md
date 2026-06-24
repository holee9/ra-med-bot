# Session Memo

> 세션 연결용. 상세 작업 맥락은 auto-memory `project-state.md`(~/.claude/projects/.../memory/)가 1차 진실원 — 항상 로드됨. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-24~25) — 4-PR 순차 파이프라인 완료 (#255 → #241/#240 → #69 → #71)

**main HEAD: `06b6850`** (#71 머지 후). 오픈 PR 0건. main 클린.

### ✅ PR-1 #255 — CER cer_persisted audit (MERGED PR #257, `8956d2e`, #255 CLOSED)
migration 0074, cer_persisted Part 11 분리 + 미커밋 review-fix 통합. audit 146→147. 3754 passed.

### ✅ PR-2 #241/#240 — Traceability 보안 그룹 (MERGED PR #258, `e25d556`, #241·#240 CLOSED)
migration 0075, export 에러 마스킹(MEDIUM-1 `\p{Cc}`) + matrix_viewed. audit 147→148. 3759 passed.
★**L-008 캡처**: CI `pnpm lint`가 `lint:hex` 포함 — 로컬 `pnpm biome check`만으로 CI fail(49s). 코드 줄 주석 `(#240)` 3자리 hex 오탐.

### ✅ PR-3 #69 — CLINICAL-INVESTIGATION tier1 풀사이클 (MERGED PR #259, `5a675cb`, #69 CLOSED)
migration 0076, 5 테이블 + API 9종 + Frontend. AC-01~08. audit 148→156, 권한 58→61. **expert-security BLOCK-MERGE 5건 fix**(C-1 cross-org signoff IDOR / H-1 citation inert→authoritative / H-2 linkage tx / H-3 denial audit fail-closed / H-4 target IDOR) + runtime 테스트 12개. 3869 passed.
DEFER → #65(eSubmit)·M-1(tier2 인젝션)·M-3(PII).

### ✅ PR-4 #71 — MODEL-GOVERNANCE tier1 풀사이클 (MERGED PR #260, `06b6850`, #71 CLOSED)
migration 0077, 4 테이블(prompt_registry immutable/approved_combination single-active) + lib 12모듈 + API 6종. AC-01~07. audit 156→164, 권한 61→64. **expert-security BLOCK-MERGE 결함 fix**(C2 runtime model 바인딩 / H1 rollback DESC / H2 async eval 라우트 / M2 RLHF SHA-256 / M3 rejected audit 커밋 tx 분리 / M1 lifecycle 테스트 11개) + **C3 migration 0077 커밋 누락 수정**(오케스트레이터 git add 범위 실수). 3938 passed.
DEFER → #56(RLHF 본체)·#48(source-gov)·admin UI·prompt-binding(tier2)·secondary path wiring·H3(RLS #239).
★**L-009 캡처**: full `pnpm test`(타깃만 아님)로 capa/foundation 카운트 단언 누락 포착 + git add 범위(migrations/) 누락(C3). 커밋 전 staged 범위 + 전체 suite 직검 필수.

### 🎯 다음 세션 시작 지점 (2026-06-25 갱신)
- **회귀 누적**: 3749(직전) → **3938 passed** (+189: 4 PR). migration 0077, audit 164, 권한 64(runtime).
- **READY 미구현 high SPEC**: **CYBERDEVICE #67** · **CORPUS-LICENSE #72** (둘 남음).
- **follow-up**: #65(eSubmit, #69 의존) · #56(RLHF, #71 의존) · #48(source-gov, #71 의존) · #244(PMCF Eval UI) · #245(PMS E2E) · #249(LABELING eSubmit) · #57(QMS) · #239(RLS WITH CHECK project-wide).
- **tier1 착수 절차 (L-001 + L-007 + L-008 + L-009 + 본 세션 4-PR 패턴)**:
  1. main 기반 `feat/issue-{N}` → 이슈 코멘트 + Gate 0 정합성.
  2. **베이스라인 카운트 runtime 직검**(`Object.keys(PERMISSIONS).length`, audit test 단언) — 에이전트 보고 매번 틀림.
  3. 구현 위임(regula-backend) → 매 phase 게이트 직검.
  4. ★**sync Phase 0.55 expert-security + evaluator 병렬** — expert-security 우선(관대한 evaluator 오탐 多). IDOR·audit tx·org 스코프·runtime gate 결함 클래스 반복.
  5. **게이트 직검 체크리스트**: `pnpm typecheck && pnpm lint(biome+lint:hex) && pnpm test(FULL) && pnpm build`.
  6. **커밋 전 staged 범위 직검**(`git status` — migrations/ 등 누락 없게) + `Fixes #{N}` PR → CI watch → squash merge.
- **블로커(외부)**: hybrid-ra-saas 배포(#202 등) — T3610 로컬 실제 프로덕션.

### 핵심 교훝 (본 세션 4 PR)
- **L-007**: 베이스라인 카운트·게이트·결함 보고 전부 직검. #71 권한 61→64(에이전트 보고 견고했으나 full test로 capa/foundation 단언 누락 포착).
- **L-008**: 로컬 게이트 `pnpm lint`(lint:hex 포함). 코드 줄 trailing 주석 `#NNN` 금지.
- **L-009**: full `pnpm test`(타깃만 아님) + 커밋 전 staged 범위 직검(migrations/ 누락 방지).
- **교차 SPEC**: expert_reviews org_id 없음(#69 C-1)·RLS inert project-wide(#239)·audit throw-tx 롤백 결함 클래스 3회 반복(#69 H-3·#71 M3).

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-24: 3-PR 파이프라인(#255·#241/240·#69) + 이어 #71. tier1 CC/LABELING/CAPA 머지.
- 2026-06-23: tier0 KNOWLEDGE-GAP #35 · tier1 CLASSIFY #59 · TRACEABILITY #47 머지. 26개 SPEC batch.
