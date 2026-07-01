# Session Memo — 2026-07-01 종료 (Phase D 완결 + E2E)

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약. 다음 세션이 가장 먼저 읽을 파일.

## 현재 상태 (main 안정)
- main HEAD `9087157` (Phase D 완결: D-1 데이터 · D-2a API · D-2b ingestion + UI 전부 main)
- 회귀 **4814 passed** | 21 skipped | 0 failed · typecheck/lint exit 0 · migration 최신 `0100_audit_action_lockstep.sql`
- OPEN PR 0건 · OPEN 이슈 priority/high 9 + medium 7 + follow-up **#312~#314**

## Phase D (#307) 결과 — 본 세션 완결
- D-1 데이터 모델(PR #308/#309) · D-2a route/audit/sync/cron(#310) · D-2b ingestion + 설정 UI(#311) 전부 main 머지
- **E2E 파이프라인 실동작 검증**(격리 DB `regula_e2e_test`, #312 코멘트): clone → scan → extract → chunk → embed 전 단계 도달 + per-file 격리 + failed/syncing 상태 전이 + corpus_sync_runs + RCE 방어 보존 전부 확인
- **유일 블로커(비-코드)**: `.env.local` `OPENAI_API_KEY` = dev-placeholder → OpenAI 401. 실제 유효 key 필요.

## 🎯 다음 세션 시작점 (권장 순서)
1. **#312 운영 연동**(Phase D 완결, 사용자 가치 최대) — `.env.local`에 실제 `OPENAI_API_KEY` 설정 + 규제 repo 연결 → 코퍼스 채움 + 사이트 RAG 작동 최종 확인. E2E script는 일회성이라 삭제했으나 #312 코멘트에 재작성 가이드(격리 DB + `syncKnowledgeSource` 직접 호출 패턴) 있음.
2. 회귀 낮은 follow-up: **#313** orphan cron · **#314** insertChunks 추출
3. priority/high 풀사이클: **#49** VALIDATION(IQ/OQ/PQ) · **#36** REVIEW-OPS · **#37** SUBMISSION-LIFECYCLE — SPEC 문서 기반 manager-strategy 설계 선행
4. LLM 계열(회귀 높음, 별도 세션 + sync 0.55 expert-security 필수): **#39** WORKFLOWS-LLM · **#40** STRATEGY · **#42** CROSSMARKET · **#43** BATCH

## 환경 주의사항 (직검 정정, 중요)
- **DB 컨테이너 2개**: `regula-test-db`(pg16, 운영 앱 DB = `.env.local DATABASE_URL` localhost:5432/regula_test) + `honcho-postgres-1`(pg15, 5433, **별도 honcho 서비스 — regula 무관**). 과거 메모 "5433 regula"는 오탐(정정됨).
- **격리 테스트 DB**: `regula_e2e_test`(regula_test 스키마 복제로 생성, 운영 미영향, 유지). 재검증용 — DATABASE_URL에서 `regula_test`→`regula_e2e_test` override로 사용. `docker exec regula-test-db psql -U postgres -d regula_e2e_test`.
- **배포**: 로컬 Next.js + Cloudflare Tunnel(regula.abyz-lab.work). Vercel/Cloudflare CI는 secrets 미설정 → 스킵, 실배포 없음.
- **운영 DB 코퍼스 빈 상태**(seed 제거, 사용자 의도) → #312 연동(실제 repo + key) 후 사이트 RAG 작동 개시.

## 미해결/주의 (다음 세션에 알 것)
- **ingestDocuments**: 파이프라인 완성(main, PR #311). 실제 코퍼스 채움은 #312 환경(key+repo) 후. `lib/ingest` 재사용(composable), migration 불필요(컬럼 사전 존재), cloneRepo RCE 방어 원형 보존. 설계: `docs/proposals/phase-d-2b-ingestion-plan-2026-06-30.md`.
- **헬퍼 lock-step 단언**: D-2a(#310)에서 `toEqual`(순서) → `Set`(집합) 변경(schema/type 선언 순서 idx 147 `reranking_applied` 상이는 본질 아님). 추후 순서 의존 복구 필요 시 schema/audit 재정렬(scope 확장).
- **L-013 재확인(본 세션 결정적)**: 세션 메모 "4777 green" 오탐 → 직검 시 lint FAIL 20 + test 2 failed 포착 → 2 PR(#310/#311) 게이트 회복. mock 아닌 **실제 ingestion 실행**으로 파이프라인 검증 필수(정적 테스트 + CI mock + self-report 3중 맹점).

## 직검 교훈 누적 ([[lessons]])
- L-007(게이트/카운트/결함 직검) · L-009(staged 범위 직검) · L-010(migration 실DB) · L-012(next dev 중 build 금지) · L-013(정적+CI mock+self-report 맹점) — 본 세션 D-2 전 구간 재확인.
- 본 세션 결정적 패턴: **회귀 높은 ingestion/RAG 변경은 격리 DB + 실제 파이프라인 실행(외부 clone/embed 호출)으로 검증** — CI mock 통과가 실동작 보장 아님(L-013 확장).

## 이전 세션 히스토리
- **2026-06-29~30**: A-C 정체성 교정(PR #305) + Phase D-1 데이터 모델(#308/#309) + D-2a WIP 시작.
- **2026-06-27~28**: 자율 순차 8종(#264 sub2/3 · #244 · #245 · #238 · #249 · #296 · #300) MERGED, 회귀 4772, migration 0098. ★ #296 실DB 구문 에러 → #71 런타임 500 해소, #300 dead-code 폐쇄(L-007/010).
- **2026-06-27**: #264 sub 1/3(PR #293) + #284/#280 fix-up + #283 test debt + #158 백엔드 7개.
- **2026-06-26**: #239 RLS Phase 1~4 + Knowledge/RAG #50/#51/#62 + DB fix-up #279/#281.
