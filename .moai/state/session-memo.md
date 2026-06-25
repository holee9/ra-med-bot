# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-24~25) — 6-PR 순차 파이프라인 완료 (#255 → #241/#240 → #69 → #71 → #67 → #72)

**main HEAD: `8a27fdf`** (#72 머지 후). 오픈 PR 0건. main 클린.

### ✅ PR-1 #255 — CER cer_persisted audit (PR #257). audit 146→147. 3754 passed.
### ✅ PR-2 #241/#240 — Traceability 보안 그룹 (PR #258). audit 147→148. 3759 passed. **L-008**(lint:hex).
### ✅ PR-3 #69 — CLINICAL-INVESTIGATION tier1 (PR #259). audit 148→156, 권한 58→61. expert-security 5건 fix. 3869 passed.
### ✅ PR-4 #71 — MODEL-GOVERNANCE tier1 (PR #260). audit 156→164, 권한 61→64. expert-security 5건 fix + C3 migration 누락. 3938 passed. **L-009**(full test+git add).
### ✅ PR-5 #67 — CYBERDEVICE tier1 (PR #261). audit 164→174, 권한 64→66. expert-security 5건 fix(C-1/H-1/H-2/REQ-013/M-1). 4025 passed.
### ✅ PR-6 #72 — CORPUS-LICENSE tier1 (PR #262). audit 174→183, 권한 66→68. **expert-security+evaluator 일치 BLOCK-MERGE 4건 fix**(C-1 new-source gate / C-2 Inngest gate / C-3 per-corpus retrievers orgId threading / C-4 export notice+검증+auditExportBlocked) + H-4. 4105 passed.

### 🎯 다음 세션 시작 지점 (2026-06-25 갱신)
- **회귀 누적**: 3749(직전) → **4105 passed** (+356: 6 PR). migration 0080, audit 183, 권한 68(runtime).
- **★ 미구현 high SPEC 4종(#69/#71/#67/#72) 전부 머지 완료** — 2026-06-22 batch의 미구현 high 세트 소진.
- **남은 OPEN priority/high** (Wave 3/system, 본 세션 범위 외): #62 STANDARDS · #51 PROJECT-MEMORY · #50 KNOWLEDGE-PROMO · #49 VALIDATION · #48 SOURCE-GOVERNANCE · #43 BATCH · #42 CROSSMARKET · #40 STRATEGY · #39 WORKFLOWS-LLM-002 · #202(hybrid E2E, 외부 의존).
- **follow-up (본 세션 DEFER)**: #65(eSubmit, #69 의존)·#56(RLHF, #71 의존)·#48(source-gov, #72 연계)·#244(PMCF Eval UI)·#245(PMS E2E)·#249(LABELING eSubmit)·#57(QMS)·#239(RLS WITH CHECK project-wide, 7 SPEC 누적)·seed/delta-sync license gate(@MX:TODO)·native FK on cyber linked_*(uuid-vs-text PK 통일).
- **tier1 착수 절차 (L-001 + L-007/008/009 + dead-code 교훈)**:
  1. main 기반 `feat/issue-{N}` → 이슈 코멘트 + Gate 0 정합성.
  2. **베이스라인 카운트 runtime 직견** — 에이전트 보고 매번 틀림.
  3. 구현 위임(regula-backend) → 매 phase 게이트 직견.
  4. ★**sync Phase 0.55 expert-security + evaluator 병렬** — expert-security 우선(evaluator 오탐 多).
  5. **게이트 직견**: `pnpm typecheck && pnpm lint(biome+lint:hex) && pnpm test(FULL) && pnpm build`.
  6. **커밋 전 staged 범위 직견**(migrations/ 누락 주의) + PR → CI → squash merge.
- **블로커(외부)**: hybrid-ra-saas 배포(#202 등) — T3610 로컬 실제 프로덕션.

### 핵심 교훈 (본 세션 6 PR)
- **L-007**: 카운트·게이트·결함 보고 전부 직검. evaluator 오탐(function 존재=충족) → expert-security 정오탐.
- **L-008**: `pnpm lint`(lint:hex 포함). 코드 줄 trailing 주석 `#NNN` 금지.
- **L-009**: full `pnpm test`(타깃만 아님) + 커밋 전 staged 범위 직검(migrations/ 누락 방지).
- **★ dead-code 결함 클래스 (4회 반복: #69/#71/#67/#72)**: import됐으나 호출부 없는 function이 AC 충족으로 위장, 또는 gate가 '일부' 경로에만 wiring. 리뷰/구현 시 **(a) 호출부 grep, (b) 핵심 production 경로(ingest/search/export) 모두 wiring** 확인 필수. @MX:TODO로 핵심 REQ 회피 금지.

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-24: 3-PR(#255·#241/240·#69) + #71·#67·#72. tier1 CC/LABELING/CAPA 머지.
- 2026-06-23: tier0 KNOWLEDGE-GAP #35 · tier1 CLASSIFY #59 · TRACEABILITY #47. 26개 SPEC batch.
