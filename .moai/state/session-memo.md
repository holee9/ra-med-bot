# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-25) — PR #269 머지 (#239 Phase 2 나머지 3도메인 wiring)

**main HEAD: `b42f05e`** (PR #269 squash). 오픈 PR 0건. main 클린. 회귀 **4299 passed** | 8 skipped.

### ✅ PR #269 — #239 RLS Phase 2 나머지 3도메인 wiring (`b42f05e`)
- knowledge-gap(3)·pms(3)·change-control(4) = **10 라우트** `withTenantScope` wiring. 14 files (10 routes + coverage gate + 3 test mocks).
- SELECT는 `withTenantScope(orgId, async (dbs) => ...)` + app `eq(orgId)` defense-in-depth; mutation+audit는 `withTenantScope(orgId, async (tx) => { ...writeAudit({...}, tx) })` (C-3/H2 atomicity).
- 정적 게이트 `WIRED_DOMAINS`에 3개 추가 → 잔류 PENDING: cyberdevice·model-governance·traceability.
- sync Phase 0.55: expert-security PASS + evaluator PASS(98.75). 결함 0.
- **★ 직검 (L-007 5회째)**: 구현 에이전트 "gates green" self-report → 오케스트레이터 `pnpm test` FULL 직검으로 **11 failures 포착**(test mock `withTenantScope` export 누락 3개 + change-control H-3 source-grep regex 구식) → 직접 fix → 4299 passed.

### 🎯 다음 세션 시작 지점 (2026-06-25 갱신)
- **main HEAD: `b42f05e`**. 회귀 **4299 passed** | 8 skipped. migration 0083, audit 194, PERMISSIONS 66(객체키)/71(runtime). RLS 여전히 **INERT**.
- **★ #239 Phase 2 잔류 (PENDING)**: cyberdevice(6)·model-governance(6)·traceability(7) = **19 라우트**. 동일 패턴 wiring + 게이트 이동. 도메인별 PR.
- **★ #239 Phase 3 (PENDING) → #239 CLOSE**: `SELECT rolname, rolbypassrls FROM pg_roles` 직검 → `=false`면 migration 0084 `FORCE ROW LEVEL SECURITY` (Option A), `=true`면 이중 클라이언트 (Option B). 카나리(rlhf+3도메인) + GUC 미설정 0행 단언.
- **남은 OPEN priority/high**: #62·#51·#50·#49·#43·#42·#40·#39·#37·#36·#202·#1.
- **DEFER**: #264·#65·#244·#245·#249·#57·#236·#238.
- **non-blocking future**: lib `auditExportBlockedBatch`/`auditStaleBlockedBatch` writeAudit tx 누락(pre-existing, export route는 본 PR로 tx 전달 완료).
- **★ tier1 착수 절차 (L-001 + L-007/008/009)**:
  1. main 기반 `feat/issue-{N}` → 이슈 코멘트 + Gate 0.
  2. 베이스라인 카운트 runtime 직검.
  3. 구현 위임(regula-backend) 또는 직접 → 매 phase 게이트 직검.
  4. sync Phase 0.55 expert-security + evaluator 병렬.
  5. 게이트 직검: typecheck + lint(full) + test(FULL) + build.
  6. **★ staged 범위 직검**(L-009) + PR → CI → squash merge.
  7. **★ "완료" 보고 직검**(L-007) — 에이전트 self-report 불신(본 세션 게이트 green 오탐 → 11 failures 직검). main HEAD 기준.
- **블로커(외부)**: hybrid-ra-saas 배포(#202 등) — T3610.

### 핵심 교훈 (본 세션 — L-007 5회 누적 검증)
- **에이전트 게이트 self-report("green")도 오탐**: 본 세션에선 에이전트가 typecheck/lint/커버리지 게이트만 돌리고 full test를 "오케스트레이터가 함"으로 미룸 → 11개 integration test 실패를 놓침. **오케스트레이터 `pnpm test` FULL 직검이 유일한 진실원**.
- **dead-code/source-grep 결함 클래스**: change-control H-3 테스트가 라우트 소스의 `db.transaction` 문자열을 매칭하다가 `withTenantScope` 교체로 깨짐 — "동작 아닌 문자열 매칭" 테스트는 리팩터 시 반드시 갱신.
- **L-009**: staged 범위 직검이 migrations/ 누락·PR 범위 누락을 막는 유일한 수단 (본 세션 14 files 직검, migration 0 확인).

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-25(이전): 3 PR 머지 — #266 RLHF 복구 · #267 RLS Phase 1(WITH CHECK 20개) · #268 RLS Phase 2 rlhf 도메인.
- 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59·#47.
