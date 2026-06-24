# Session Memo

> 세션 연결용. 상세 작업 맥락은 auto-memory `project-state.md`(~/.claude/projects/.../memory/)가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-24~25) — 5-PR 순차 파이프라인 완료 (#255 → #241/#240 → #69 → #71 → #67)

**main HEAD: `aa7bad0`** (#67 머지 후). 오픈 PR 0건. main 클린.

### ✅ PR-1 #255 — CER cer_persisted audit (PR #257, `8956d2e`, #255 CLOSED)
migration 0074, cer_persisted Part 11 분리 + review-fix 통합. audit 146→147. 3754 passed.

### ✅ PR-2 #241/#240 — Traceability 보안 그룹 (PR #258, `e25d556`, #241·#240 CLOSED)
migration 0075, export 마스킹 + matrix_viewed. audit 147→148. 3759 passed. **L-008 캡처**(lint:hex).

### ✅ PR-3 #69 — CLINICAL-INVESTIGATION tier1 (PR #259, `5a675cb`, #69 CLOSED)
migration 0076, 5 테이블+API 9+Frontend. AC-01~08. audit 148→156, 권한 58→61. **expert-security 5건 fix**(C-1 cross-org signoff / H-1 citation→authoritative / H-2 linkage tx / H-3 denial audit fail-closed / H-4 target IDOR). 3869 passed.

### ✅ PR-4 #71 — MODEL-GOVERNANCE tier1 (PR #260, `06b6850`, #71 CLOSED)
migration 0077, 4 테이블(prompt_registry immutable/approved_combination single-active)+lib 12+API 6. AC-01~07. audit 156→164, 권한 61→64. **expert-security fix**(C2 runtime model 바인딩 / H1 rollback DESC / H2 async eval / M2 SHA-256 / M3 rejected audit 커밋 tx / M1 lifecycle 테스트) + **C3 migration 커밋 누락 수정**. 3938 passed. **L-009 캡처**(full pnpm test + git add 범위).

### ✅ PR-5 #67 — CYBERDEVICE tier1 (PR #261, `aa7bad0`, #67 CLOSED)
migration 0078+0079, 4 테이블(threat_model/sbom/cve_impact/cyber_evidence_bundle)+lib 13+API 6. AC-01~07. audit 164→174(+9 cyber·+1 reassess_triggered), 권한 64→66. **expert-security 5건 fix**(C-1 evidence linked_* org 검증 / H-1 linkCveImpactToRiskItem live / H-2 reassess_triggered audit / REQ-013 access_denied 7 sites / M-1 SBOM component cap). 4025 passed.
DEFER → 외부 CVE/KEV API(NVD/CISA)·복잡 SBOM 포맷·#65 eSubmit·admin UI·LLM threat modeling·change-control enqueue(#54).
★ **dead-code 패턴 3회 반복**(#69 citation / #71 recordEvalResult / #67 linkCveImpactToRiskItem+assertCyberResourceAccess) — function 존재≠충족, **호출부 직검** 필수.

### 🎯 다음 세션 시작 지점 (2026-06-25 갱신)
- **회귀 누적**: 3749(직전) → **4025 passed** (+276: 5 PR). migration 0079, audit 174, 권한 66(runtime).
- **READY 미구현 high SPEC**: **CORPUS-LICENSE #72** (마지막 1종 남음).
- **follow-up**: #65(eSubmit, #69 의존)·#56(RLHF, #71 의존)·#48(source-gov, #71 의존)·#244(PMCF Eval UI)·#245(PMS E2E)·#249(LABELING eSubmit)·#57(QMS)·#239(RLS WITH CHECK project-wide)·native FK on cyber linked_*(uuid-vs-text PK 통일 SPEC).
- **tier1 착수 절차 (L-001 + L-007/008/009 + 본 세션 5-PR 패턴)**:
  1. main 기반 `feat/issue-{N}` → 이슈 코멘트 + Gate 0 정합성.
  2. **베이스라인 카운트 runtime 직검** — 에이전트 보고 매번 틀림.
  3. 구현 위임(regula-backend) → 매 phase 게이트 직검.
  4. ★**sync Phase 0.55 expert-security + evaluator 병렬** — expert-security 우선(evaluator 오탐 多, function 존재=충족 착각). **dead-code 패턴**: 리뷰 시 "function이 route에서 실제 호출되는가" grep 확인.
  5. **게이트 직검 체크리스트**: `pnpm typecheck && pnpm lint(biome+lint:hex) && pnpm test(FULL) && pnpm build`.
  6. **커밋 전 staged 범위 직검**(`git status` — migrations/ 누락 주의) + `Fixes #{N}` PR → CI watch → squash merge.
- **블로커(외부)**: hybrid-ra-saas 배포(#202 등) — T3610 로컬 실제 프로덕션.

### 핵심 교훈 (본 세션 5 PR)
- **L-007**: 베이스라인 카운트·게이트·결함 보고 전부 직검. evaluator 오탐(function 존재=충족) → expert-security 정오탐.
- **L-008**: `pnpm lint`(lint:hex 포함). 코드 줄 trailing 주석 `#NNN` 금지.
- **L-009**: full `pnpm test`(타깃만 아님) + 커밋 전 staged 범위 직검(migrations/ 누락 방지).
- **★ dead-code 결함 클래스**: import됐으나 호출부 없는 function이 AC 충족으로 위장 (#69/#71/#67 반복) — 리뷰 시 호출부 grep 필수.

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-24: 3-PR(#255·#241/240·#69) + #71. tier1 CC/LABELING/CAPA 머지.
- 2026-06-23: tier0 KNOWLEDGE-GAP #35 · tier1 CLASSIFY #59 · TRACEABILITY #47. 26개 SPEC batch.
