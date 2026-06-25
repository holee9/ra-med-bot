# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-26) — #239 RLS Enforce 코드 작업 종료 (Phase 1·2·3·4-prep + runbook, PR #269~#273)

**main HEAD: `d86ac83`**. 오픈 PR 0건. 회귀 **4345 passed** | 8 skipped (+56, 7 PR). **#239 CLOSED**.

### ✅ 본 세션 PR 누적
- **PR #269** — Phase 2 (kg/pms/cc) wiring (`b42f05e`) — 회귀 4299
- **PR #270** — Phase 2 최종 (cyberdevice/mg/trace) wiring (`73e5882`) — Phase 2 완전 종료, 4315
- **PR #271** — Phase 3 lib GUC wiring 14파일 (`b544479`) — 4315
- **PR #272** — Phase 4 M-1 service-role bypass client auth.ts (`c41dd7c`) — 4315
- **PR #273** — Phase 4 FORCE RLS(0084) + regula_app role(0085) + runbook (`d86ac83`) — 4345, migration 0084/0085

### 🎯 다음 세션 시작 지점 (2026-06-26 갱신) — RLS 운영 enforce (인프라)
- **main HEAD: `d86ac83`**. 회귀 **4345 passed**. migration 0085(최신), audit 194.
- **★ RLS 실제 enforce = 운영 인프라** (`docs/phase-4-rls-enforce-runbook.md`):
  1. ops: `ALTER ROLE regula_app WITH PASSWORD '<secrets>';` (migration 0085 placeholder)
  2. env: `DATABASE_URL`(regula_app, BYPASSRLS=false, RLS-subject) + `SERVICE_DATABASE_URL`(superuser, auth.ts bypass) **이중 설정**
  3. apply migration 0084(FORCE RLS) + 0085(app role)
  4. 카나리: GUC set→자기 org만 / GUC unset→0 rows fail-closed (vitest 명세 runbook)
  5. Rollback: `NO FORCE ROW LEVEL SECURITY` (가역)
- **Known limits (runbook §8)**: M-2 sources/source_sections catalog(org_id IS NULL) 정책 점검 · weekly-digest cron cross-org enum serviceDb bypass · audit_logs RLS 대상 20개外(영향 없음).
- **★ 코드는 전부 완료** (route 7도메인 + lib 14파일 + auth.ts service client + FORCE RLS/app role migration + runbook). RLS INERT 대기 상태. 운영 env 전환 한 번에 enforce.
- **남은 OPEN priority/high**: #62·#51·#50·#49·#43·#42·#40·#39·#37·#36·#202·#1.
- **DEFER**: #264·#65·#244·#245·#249·#57·#236·#238.
- **★ tier1 착수 절차 (L-001 + L-007/008/009 — 본 세션 9회 직검 강화)**:
  1. main 기반 브랜치 + 이슈 코멘트 + Gate 0.
  2. 베이스라인 카운트 runtime 직검.
  3. 구현 위임(regula-backend) → 매 phase 게이트 직검. **★ test mock 갱신 명시적 지시**(PR #270/#271 교훈).
  4. sync Phase 0.55 expert-security + evaluator 병렬. **★ 리뷰 불일치 시 오케스트레이터 직검**(route mutation + RLS 상태 + 기존 패턴).
  5. 게이트 직검: typecheck + lint(full) + test(FULL) + build.
  6. staged 범위 직검(L-009, migrations/ 누락 방지) + PR → CI → squash merge (repo CI pending에도 admin 머지 허용).
  7. "완료" 보고 직검(L-007) — main HEAD 기준.

### 핵심 교훈 (본 세션 — L-007 9회 누적 직검)
- **에이전트 게이트 self-report 오탐**: PR #269 11 failures(test mock 누락) → PR #270/#271/#272 사전 지시로 0. **오케스트레이터 `pnpm test` FULL 직검이 진실원**.
- **보안 리뷰 불일치 직검**: evaluator 과잉(audit scope-밖 CRITICAL) → 직검(read-only route + RLS INERT) 정오탐. expert-security 채택.
- **라우트/lib/테이블 수 직검**: traceability 7→4·pms 4→3·FORCE RLS 대상 20개 정밀 매칭.
- **Phase 4 근본 직검**: superuser BYPASSRLS → FORCE RLS 단독 무력. **DB role 변경(regula_app) + M-1 service client가 진짜 작업**. 본 세션 코드 완료, 운영 env 전환만 잔류.
- **password 보안 직검**: migration 0085 real password 0 (placeholder + ALTER ROLE 의무화).

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-25: PR #269·#270 (#239 Phase 2). #266 RLHF 복구·#267 Phase 1·#268 rlhf.
- 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59·#47.
