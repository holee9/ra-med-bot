# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-26) — #239 Phase 1·2·3 완료 (PR #269·#270·#271), Phase 4 인프라 이관

**main HEAD: `b544479`** (PR #271 squash). 오픈 PR 0건. 회귀 **4315 passed** | 8 skipped.

### ✅ PR #269 — #239 Phase 2 (kg/pms/cc) wiring (`b42f05e`) — 회귀 4299
### ✅ PR #270 — #239 Phase 2 최종 (cyberdevice/mg/trace) wiring (`73e5882`) — Phase 2 완전 종료, 회귀 4315
### ✅ PR #271 — #239 Phase 3 lib GUC wiring (`b544479`) — 14 lib 파일 withTenantScope, 회귀 4315

### 🎯 다음 세션 시작 지점 (2026-06-26 갱신) — Phase 4 (DB 인프라, 회귀 최대)
- **main HEAD: `b544479`**. 회귀 **4315 passed** | 8 skipped. migration 0083, audit 194. RLS 여전히 **INERT**.
- **★ Phase 4 근본 복잡도 (직검)**:
  1. **앱 DB role = `postgres` (superuser)** → BYPASSRLS → **FORCE RLS 적용해도 superuser는 RLS 우회**. migration 0084 단독으로 enforce 안 됨.
  2. **실제 enforce 조건**: 앱 전용 DB role 생성(BYPASSRLS=false non-superuser) + GRANT + **DATABASE_URL 환경 변경**(개발/운영) + migration 0084 FORCE RLS.
  3. **M-1 chicken-and-egg (Phase-4 blocker)**: auth.ts session callback의 `org_members` 조회 — 새 role로 RLS 적용 시 orgId 모르면 빈 결과 → **모든 사용자 로그인 불가**. 해결: 별도 service-role bypass client 또는 org_members RLS 예외 정책.
  4. **M-2**: sources/source_sections regulatory catalog(org_id IS NULL) RLS 정책 허용 확인.
- **★ Phase 4 작업 단위 (인프라)**: DB role 프로비저닝(DBA) → DATABASE_URL 마이그레이션 → M-1 해결(auth.ts) → migration 0084 FORCE RLS → 카나리(전 도메인 GUC 0행 단언). **단일 코드 세션 불가, DB 인프라 세션 필요**.
- **Phase 3 까지 완료 상태**: 전 7 도메인 route wiring + 14 lib 파일 GUC wiring. RLS INERT 상태서 회귀 0. Phase 4 flip만 남음(인프라 의존).
- **남은 OPEN priority/high**: #62·#51·#50·#49·#43·#42·#40·#39·#37·#36·#202·#1.
- **DEFER**: #264·#65·#244·#245·#249·#57·#236·#238.
- **★ tier1 착수 절차 (L-001 + L-007/008/009)**:
  1. main 기반 브랜치 + 이슈 코멘트 + Gate 0.
  2. 베이스라인 카운트 runtime 직검.
  3. 구현 위임 → 매 phase 게이트 직검. **★ test mock 갱신 명시적 지시**(PR #270/#271 교훈).
  4. sync Phase 0.55 expert-security + evaluator 병렬. **★ 리뷰 불일치 시 오케스트레이터 직검**(route mutation + RLS 상태 + 기존 패턴).
  5. 게이트 직검: typecheck + lint(full) + test(FULL) + build.
  6. staged 범위 직검(L-009) + PR → CI → squash merge. (repo CI pending에도 admin 머지 허용)
  7. "완료" 보고 직검(L-007) — main HEAD 기준.

### 핵심 교훈 (본 세션 — L-007 7회 누적)
- **에이전트 게이트 self-report 오탐**: PR #269 11 failures(test mock 누락) → PR #270/#271 사전 지시로 0. **오케스트레이터 `pnpm test` FULL 직검이 진실원**.
- **보안 리뷰 불일치 직검**: evaluator 과잉(audit scope-밖 CRITICAL) → 직검(read-only route + RLS INERT)으로 정오탐. expert-security PASS 채택.
- **라우트/lib 수 직검**: traceability 7→4(BFF 오탐). pms 4→3.
- **Phase 4 근본 직검**: superuser BYPASSRLS → FORCE RLS만으론 enforce 안 됨. DB role 변경 + M-1 chicken-and-egg가 진짜 작업.

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-25: PR #269·#270·#271 (#239 Phase 2·3). #266 RLHF 복구·#267 Phase 1·#268 rlhf.
- 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59·#47.
