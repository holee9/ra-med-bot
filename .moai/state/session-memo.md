# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-25) — #239 Phase 2 완전 종료 (PR #269·#270) + Phase 3 스코프 파악

**main HEAD: `73e5882`** (PR #270 squash). 오픈 PR 0건. 회귀 **4315 passed** | 8 skipped.

### ✅ PR #269 — #239 Phase 2 나머지 3도메인 (kg/pms/cc) wiring (`b42f05e`)
- 본 세션 전반. 10 라우트. 회귀 4299. (상세는 이전 섹션)

### ✅ PR #270 — #239 Phase 2 최종 3도메인 (cyberdevice/mg/trace) wiring (`73e5882`)
- **전 7개 org-scoped 도메인 withTenantScope wiring 종료**. 16 files (11 routes wired + 5 mg no-op + coverage gate + 4 test).
- cyberdevice 6·model-governance/change-request 1·traceability 4. 5개 mg 라우트는 DB op가 lib 위임(route 변경 없음).
- coverage gate `stripLineComments` 헬퍼 추가(주석 prose false-positive 차단) + WIRED 7개 + PENDING 비움.
- sync 0.55: expert-security PASS + evaluator BLOCK-MERGE(3 audit scope-밖 CRITICAL) → **직검으로 evaluator 과잉 판정**(3개 모두 read-only route, atomicity 대상 아님, RLS INERT, PR #269 동일 패턴) → expert-security 채택 머지.
- 회귀 4315 passed (베이스라인 4299 → +16).

### 🎯 다음 세션 시작 지점 (2026-06-25 갱신) — Phase 3 (회귀 매우 높음)
- **main HEAD: `73e5882`**. 회귀 **4315 passed** | 8 skipped. migration 0083, audit 194. RLS 여전히 **INERT**.
- **★ Phase 3 아키텍처 결정 (직검)**: 개발 DB role=`postgres`(superuser) → rolbypassrls=true → **Option A (FORCE ROW LEVEL SECURITY)** 확정. 운영 service-role이 별도 role이면 Option B 가능.
- **★ Phase 3 prerequisites (직검 정량화)**:
  1. **lib GUC wiring 16파일 / 17 db op** (회귀 리스크 최대): model-governance(rlhf-gate·rollback·change-workflow 6ops)·source-governance(review-workflow 3·delta-sync-hook)·ai(consult·retrievers)·cyberdevice/risk-linkage·capa/intake·clinical-investigation/linkage·corpus-license/entitlement·digest·knowledge-gap/clustering. 각 lib 함수가 route의 tx를 전달받거나 독자 withTenantScope 호출.
  2. **audit write GUC 보장**: read-only route(matrix/export/diff)의 scope 밖 audit도 Phase 3 시 GUC 필요 (audit_logs RLS 정책 존재 migration 0001).
  3. **FORCE RLS migration 0084** + 카나리(전 도메인 GUC 미설정 0행 단언).
- **남은 OPEN priority/high**: #62·#51·#50·#49·#43·#42·#40·#39·#37·#36·#202·#1.
- **DEFER**: #264·#65·#244·#245·#249·#57·#236·#238.
- **★ tier1 착수 절차 (L-001 + L-007/008/009)**:
  1. main 기반 브랜치 + 이슈 코멘트 + Gate 0.
  2. 베이스라인 카운트 runtime 직검.
  3. 구현 위임 → 매 phase 게이트 직검. **★ test mock 갱신을 에이전트에게 명시적 지시**(PR #270 교훈).
  4. sync Phase 0.55 expert-security + evaluator 병렬. **★ 리뷰 불일치 시 오케스트레이터 직검**(route mutation 여부 + RLS 상태 + 기존 패턴)으로 판정.
  5. 게이트 직검: typecheck + lint(full) + test(FULL) + build.
  6. staged 범위 직검(L-009) + PR → CI → squash merge. (repo는 CI pending에도 admin 머지 허용)
  7. "완료" 보고 직검(L-007) — main HEAD 기준.

### 핵심 교훈 (본 세션 — L-007 6회 누적)
- **에이전트 게이트 self-report 오탐**: PR #269에선 11 failures(test mock 누락), PR #270에선 사전 지시로 0 failures. **오케스트레이터 `pnpm test` FULL 직검이 진실원**.
- **보안 리뷰 불일치**: evaluator가 audit scope-밖을 CRITICAL로 과잉 판정. 직검(read-only route + RLS INERT + 기존 패턴)으로 정오탐. 관대/엄격 양 리뷰 모두 직검으로 교차 검증.
- **라우트 수 직검**: traceability `-path '*traceability*'` 추정 7 → 정확 4 (BFF 경로 오탐 포함).

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-25(이전): PR #269 (#239 Phase 2 kg/pms/cc). #266 RLHF 복구·#267 RLS Phase 1·#268 rlhf wiring.
- 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59·#47.
