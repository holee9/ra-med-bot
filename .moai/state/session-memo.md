# Session Memo — 2026-07-01 진행 (#313 + #314 MERGED)

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약. 다음 세션이 가장 먼저 읽을 파일.

## 현재 상태 (main 안정)
- main HEAD `f39016c` (#314 insertSourceSections shared helper squash 머지)
- 회귀 **4815 passed** | 21 skipped | 0 failed · typecheck/lint exit 0 · migration 최신 `0101_source_orphan_sunset.sql` (#313)
- 운영 앱 DB(`regula_test`) + 격리 DB(`regula_e2e_test`) 모두 migration 0101 적용 완료
- OPEN PR 0건 · OPEN 이슈 priority/high 9 + medium 7 + follow-up **#312만** (#313/#314 CLOSED)

## 본 세션 완료 — #313 + #314 (순차 2종 MERGED)
- **#313 orphan sources 정리 cron** (PR #315): 일일 03:00 UTC Inngest cron. all-sections-superseded source → approvalStatus='sunset' + sunsetDate. retriever gate(`!== 'approved'`)가 sunset 포함 모든 비-approved 제외 (3 retriever live 호출 확증). migration 0101 enum 2종(sunset + source.orphan_sunsetted).
- **#314 insertSourceSections shared helper** (PR #316): sync.ts(h) ↔ delta-sync orchestrator(7c) source_sections batch insert verbatim 중복 → 공유 helper 추출. **이슈 프레이밍 정정**: upload-processed.ts insertChunks는 별개 테이블(document_chunks, migration 0015/0017 실존)이라 helper 합류 불가 — stub 주석 정정(에이전트 "document_chunks 부재" 주장 틀림, 직검 정정). pure refactor, 회귀 0.
- 두 PR 모두 직견(L-007/009/010/013) + CI 전부 pass.

## 🎯 다음 세션 시작점 (권장 순서)
1. **#312 운영 연동** (Phase D 완결, 사용자 가치 최대) — **비-코드**: `.env.local` 실제 `OPENAI_API_KEY` + 규제 repo. 사용자 직접 필요. 사이트 RAG 작동 최종 확인. E2E script 재작성 가이드 #312 코멘트 참조(격리 DB + syncKnowledgeSource 직접 호출).
2. priority/high 풀사이클: **#49** VALIDATION(IQ/OQ/PQ) · **#36** REVIEW-OPS · **#37** SUBMISSION-LIFECYCLE — SPEC 문서 기반 manager-strategy 설계 선행. 단일 세션 1종 권장.
3. LLM 계열(회귀 높음, 별도 세션 + sync 0.55 expert-security 필수): **#39** WORKFLOWS-LLM · **#40** STRATEGY · **#42** CROSSMARKET · **#43** BATCH
4. 후속(Phase 3 의존): upload-processed.ts `document_chunks` 실구현 — DOCINGEST Phase 3(R2 인프라 + sources-row resolver) 후 별도 이슈 (#314 PR 본문 참조).

## 환경 주의사항 (직검 정정, 중요)
- **DB 컨테이너**: `regula-test-db`(pg16, 운영 앱 DB = `.env.local DATABASE_URL` localhost:5432/regula_test) + `honcho-postgres-1`(pg15, 5433, 별도 honcho 서비스 — regula 무관).
- **격리 테스트 DB**: `regula_e2e_test`(regula_test 스키마 복제, 운영 미영향, 유지).
- **배포**: 로컬 Next.js(:3000) + Cloudflare Tunnel. Vercel/Cloudflare CI secrets 미설정 → 스킵. **next dev 구동 중이므로 `pnpm build` 금지 (L-012)**.
- **운영 DB 코퍼스 빈 상태**(seed 제거) → #312 연동 후 사이트 RAG 작동 개시.

## 미해결/주의 (다음 세션에 알 것)
- **capa/cyberdevice count assertions**: enum 218 / type 215 (기존 부채 3개 차이, D-2a Set 단언 관련). #313 둘 다 +1 일관. 추후 enum↔type 동기화 시 별도 작업.
- **#314 프레이밍 정정**: 이슈 본문 "upload/sync 양쪽 재사용"은 sync↔orchestrator에 한해 달성, upload-processed는 별개 테이블(document_chunks)로 제외. #314는 Fixes로 CLOSED.

## 직검 교훈 누적 ([[lessons]])
- L-007(게이트/카운트/결함 직검) · L-009(staged 범위) · L-010(migration 실DB) · L-012(next dev 중 build 금지) · L-013(정적+CI mock+self-report 맹점) — #313/#314 전 구간 재활용. **#314에서 에이전트 "document_chunks 부재" 오탐 직검 정정 (L-007 재확인: schema.ts 없음 ≠ 테이블 부재, migration이 진실원)**.

## 이전 세션 히스토리
- **2026-07-01(이전 종료)**: Phase D 완결(D-1·D-2a·D-2b 전부 main, PR #308~#311) + E2E. 회귀 4814.
- **2026-06-29~30**: A-C 정체성 교정(PR #305) + Phase D-1·D-2a·D-2b.
