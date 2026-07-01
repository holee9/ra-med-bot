# Session Memo — 2026-07-01 (Phase D 코드 완결 + sync 점검/fix + 문서/이슈 정리)

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약. 다음 세션이 가장 먼저 읽을 파일.

## 현재 상태 (main 안정)
- main HEAD `685fea8` (#313/#314 머지 + sync 점검/fix + README/structure 갱신)
- 회귀 **4815 passed** | 21 skipped | 0 failed · typecheck/lint exit 0 · migration 최신 `0101`
- 운영 앱 DB(`regula_test`) + 격리 DB(`regula_e2e_test`) 모두 migration 0101 적용
- OPEN PR 0건 · OPEN 이슈 priority/high 9 + medium 8(#312 + #317 M-2) · #313/#314 CLOSED

## 본 세션 완료 — 3단계 + 문서/이슈 정리
### 1) #313 orphan sources 정리 cron (PR #315 MERGED)
- 일일 03:00 UTC Inngest cron. all-sections-superseded source → approvalStatus='sunset'.
- retriever gate(`!== 'approved'`)로 RAG 영구 제외 (3 retriever live 확증). migration 0101 enum 2종.

### 2) #314 insertSourceSections shared helper (PR #316 MERGED, pure refactor)
- sync.ts(h) ↔ delta-sync orchestrator(7c) source_sections batch insert 통합.
- **이슈 프레이밍 정정**: upload-processed.ts insertChunks는 별개 테이블(document_chunks, migration 0015/0017 실존) → helper 합류 불가.

### 3) sync 점검/fix (main_direct 커밋)
- **expert-security PASS-WITH-CONDITIONS** (CRITICAL/HIGH 0). Part 11 · RAG live exclusion · refactor 동등성 · migration 안전성 PASS.
- **M-1 fix** (`8a49ccd`): Zod `approvalStatusSchema`에 `sunset` 누락(SQL enum drift) 추가.
- **M-2 발견**: sources/source_sections RLS 미활성(migration 0084 20개 테이블에서 누락 직검). pre-existing, 본 PR 비회귀 → **#317 신규 이슈 등록** + #239 참조 코멘트.

### 문서/이슈 정리 (룰대로)
- **README.md**: 2026-07-01 Phase D 완결 섹션(대시보드 최상단) + 최신 main 상태 갱신.
- **.moai/project/structure.md**: knowledge-sources / source-sections-upsert / inngest/knowledge-sources 도메인 추가.
- **CHANGELOG / implementation-status / proposals/phase-d-2b**: sync에서 갱신(#313/#314/M-1, orphan cleanup RESOLVED).
- **이슈 코멘트**: #307(Phase D 완결) · #312(다음 안내) · #313/#314(완료 요약+M-1) · #239(M-2 참조). **#317 신규**(M-2 RLS).

## 🎯 다음 세션 시작점 (권장 순서)
1. **#312 운영 연동** (Phase D 완결, 사용자 가치 최대) — **비-코드**: `.env.local` 실제 `OPENAI_API_KEY` + 규제 repo. 사이트 RAG 작동 최종 확인.
2. **#317 M-2 RLS** (sources/source_sections RLS 활성화, defense-in-depth) — 회귀 매우 높음(RAG 핵심), 별도 세션 + 실DB 카나리.
3. priority/high 풀사이클: **#49** VALIDATION · **#36** REVIEW-OPS · **#37** SUBMISSION-LIFECYCLE — SPEC 설계 선행.
4. LLM 계열(회귀 높음, 별도 세션 + expert-security 필수): **#39** WORKFLOWS-LLM · **#40** STRATEGY · **#42** CROSSMARKET · **#43** BATCH.
5. 후속(Phase 3 의존): upload-processed.ts `document_chunks` 실구현.

## 환경 주의사항 (직검 정정)
- **DB**: `regula-test-db`(pg16, 운영 앱 DB localhost:5432/regula_test) + `honcho-postgres-1`(pg15, 5433, 별도 honcho — regula 무관).
- **격리 테스트 DB**: `regula_e2e_test`(운영 미영향, 유지).
- **배포**: 로컬 Next.js(:3000) + Cloudflare Tunnel. **next dev 구동 중 → `pnpm build` 금지 (L-012)**.
- **운영 DB 코퍼스 빈 상태** → #312 연동 후 사이트 RAG 작동.
- **git_workflow**: `main_direct` (PR 없이 main 직접 push).

## 직검 교훈 누적 ([[lessons]])
- L-007(게이트/결함 직검) · L-009(staged 범위) · L-010(migration 실DB) · L-012(next dev build 금지) · L-013(정적+CI mock+self-report 맹점).
- **본 세션 추가 패턴**: (a) #314 에이전트 "document_chunks 부재" 오탐 직검(schema.ts 없음 ≠ 테이블 부재, migration이 진실원). (b) sync 점검으로 SQL enum↔Zod schema drift(M-1) + RLS 누락(M-2) 포착 — **enum/RLS 추가 시 migration + Drizzle schema.ts + Zod schema + FORCE RLS 대상 전수 동기화** 누락 주의.

## 이전 세션 히스토리
- **2026-07-01(이전)**: Phase D 완결(D-1·D-2a·D-2b, PR #308~#311) + E2E. 회귀 4814.
- **2026-06-29~30**: A-C 정체성 교정(PR #305) + Phase D-1·D-2a·D-2b.
