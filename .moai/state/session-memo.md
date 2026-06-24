# Session Memo

> 세션 연결용. 상세 작업 맥락은 auto-memory `project-state.md`(~/.claude/projects/.../memory/)가 1차 진실원 — 항상 로드됨. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-24) — 3-PR 순차 파이프라인 완료 (#255 → #241/#240 → #69)

**main HEAD: `5a675cb`** (#69 머지 후). 오픈 PR 0건. main 클린.

### ✅ PR-1 #255 — CER cer_persisted audit (MERGED PR #257, squash `8956d2e`, #255 CLOSED)
- migration 0074: audit_action enum `cer_persisted` 추가. CER persist-tx audit `cer_created`→`cer_persisted` 전환 (cer_created=개시 1행만, Part 11 provenance 분리, #243 M-1 이관).
- 미커밋 review-fix(cer-persist-roundtrip.test.ts rollback false-positive) 통합 — mock tx staging + in-tx audit 실패 시나리오.
- 카운트 146→147, enterprise-migrations +1. 게이트 직검: 3754 passed.

### ✅ PR-2 #241/#240 — Traceability 보안 그룹 (MERGED PR #258, squash `e25d556`, #241·#240 CLOSED)
- #241 (L2 info disclosure): export 502 응답 detail 제거 + 서버 로깅 + MEDIUM-1 제어문자 살균(`\p{Cc}`, log-injection 방어).
- #240 (L1 audit clarity): `traceability.matrix_viewed` audit action 신규(migration 0075). matrix GET audit dashboard.view→matrix_viewed.
- 카운트 147→148. 게이트 직검: 3759 passed.
- ★**L-008 신규 캡처**: CI `pnpm lint`가 `lint:hex`(no-hex-colors.mjs) 포함 — 로컬을 `pnpm biome check`만 돌려 CI fail(49s) 놓침. 코드 줄 인라인 주석의 `(#240)`가 3자리 hex로 오탐. 교훈: 로컬 게이트는 `pnpm lint`(full) 실행, 코드 줄 trailing 주석에 `#NNN` 금지(주석 전용 줄만 면제).

### ✅ PR-3 #69 — CLINICAL-INVESTIGATION tier1 풀사이클 (MERGED PR #259, squash `5a675cb`, #69 CLOSED)
- migration 0076: 5 테이블 + 4 enum + workflow_type +1(17) + audit +8 ci.*(148→156) + RLS. 모든 테이블 org_id.
- lib/clinical-investigation 11 모듈 + API 9종 + Frontend(page+Workbench+Sidebar nav). AC-01~08 커버.
- 카운트: workflow_type 16→17, audit 148→156, PermissionAction 58→61(runtime 직검), REQUIRED_RECOVERY_TABLES 17→22.
- ★**sync Phase 0.55 expert-security BLOCK-MERGE → 결함 5건 수정 + 런타임 테스트 12개**(C-1 cross-org signoff IDOR / H-1 citation inert→authoritativeCitations / H-2 linkage tx 누수 / H-3 denial audit tx+fail-closed / H-4 target IDOR 검증). evaluator-active는 PASS 오탐(관대함) → expert-security 정오탐으로 덮음 (L-007 재확인).
- 게이트 직검: 3869 passed (+110).
- DEFER → #65(eSubmit 번들), M-1(tier2 프롬프트 인젝션), M-3(ci_events.data PII).

### 🎯 다음 세션 시작 지점 (2026-06-24 갱신)
- **회귀 누적**: 3749(직전) → **3869 passed** (+120: #255 +5 / #241-240 +5 / #69 +110). migration 0076, audit 156, 권한 61.
- **오픈 이슈 READY**: 미구현 high SPEC **CYBERDEVICE #67** · **MODEL-GOVERNANCE #71** · **CORPUS-LICENSE #72**. follow-up: #65(eSubmit, #69 의존) · #244(PMCF Eval UI) · #245(PMS E2E) · #249(LABELING eSubmit) · #57(QMS) · #255 CLOSED.
- **tier1 착수 절차 (L-001 + L-007 + L-008 + 본 세션 패턴)**:
  1. main 기반 `feat/issue-{N}` → 이슈 코멘트 "작업 시작" + Gate 0 정합성.
  2. **베이스라인 카운트 직검**(wf_type/audit/권한/migration) — 에이전트 보고 매번 틀림(#69에선 "33→36" 오보고, 실제 58→61). runtime `Object.keys(PERMISSIONS).length` 직측으로 진실 확인.
  3. 구현(regula-backend/frontend 위임) → 매 phase 게이트 직검.
  4. ★**sync Phase 0.55 expert-security + evaluator 병렬** — expert-security 우선(관대한 evaluator 오탐 多). IDOR·audit tx·citation 강제·org 스코프 결함 클래스 반복.
  5. 게이트 직검 체크리스트: `pnpm typecheck && pnpm lint(biome+lint:hex) && pnpm test && pnpm build`.
  6. `Fixes #{N}` PR → CI watch → squash merge.
- **블로커(외부 의존)**: hybrid-ra-saas 배포(#202 등) — T3610 로컬 실제 프로덕션, 급하지 않음.

### 핵심 교훈 (본 세션 3 PR)
- **L-007**: 베이스라인 카운트·게이트·결함 보고 전부 오케스트레이터 직검. #69에선 PermissionAction 보고가 33→36(오보고) vs 실제 58→61 — runtime 직측으로 포착. evaluator-active도 관대히 PASS 오탐.
- **L-008**: 로컬 게이트는 `pnpm lint`(lint:hex 포함) full 실행. 코드 줄 trailing 주석 `#NNN` 금지.
- **교차 SPEC org_id**: expert_reviews에 org_id 없어 C-1 발생 — join으로 회피. org_id 없는 테이블 재사용 시 사전 확인.

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-24(이전): follow-up 3종(#251·#247·#243) 머지 + review-fix(cer rollback test).
- 2026-06-24: tier1 CHANGE-CONTROL #54 + LABELING #66 + CAPA #68 머지 (3 SPEC).
- 2026-06-23: tier0 KNOWLEDGE-GAP #35 · tier1 CLASSIFY #59 · TRACEABILITY #47 머지. 26개 SPEC batch.
