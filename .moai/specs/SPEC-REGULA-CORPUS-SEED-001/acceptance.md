# Acceptance Criteria — SPEC-REGULA-CORPUS-SEED-001

> 작성일: 2026-07-10 | 매핑: #312 AC 4건 + M0-M4 + EARS REQ-KB-###

## 1. #312 E2E AC (핵심 — 실DB 직검, L-013 방어)

### AC-1: 공개 repo 연결 후 sync 성공 → 코퍼스 채워짐

**Given**: 실DB(pgvector, 포트 5433)가 실행 중이고, 유효한 `ra-lead` 세션(`session.user.organizationId` + `id`; `knowledgesources.manage` 권한, Task M1-0)이 설정되어 있으며, 운영자가 `GITHUB_PAT`(repo:read)를 확보하여 POST body `auth_token`으로 전달할 수 있고, MD-process repo(`https://github.com/holee9/MD-process.git`)가 연결 가능하다.

**When**: 운영자가 `POST /api/ra/knowledge-sources` 로 MD-process를 knowledge_source로 등록한 후, `POST /api/ra/knowledge-sources/{id}/sync` 로 동기화를 트리거한다.

**Then**:
- `syncStatus` 전이가 `idle → syncing → synced` 로 관측된다 (직검 `SELECT sync_status FROM knowledge_sources`).
- `lastSyncedAt` 이 현재 시각으로 갱신된다.
- `SELECT COUNT(*) FROM sources WHERE source_repo = 'MD-process'` 결과가 동기화 전보다 증가한다 (파일 수만큼 sources 행 생성; MAX_FILES=500 cap 내).
- `SELECT COUNT(*) FROM source_sections` 결과가 증가한다 (chunk 수만큼).
- `corpus_sync_runs` 테이블에 status=`synced` 행이 추가된다 (직검).

**매핑**: REQ-KB-001, REQ-KB-002, REQ-KB-003, REQ-KB-030 / Milestone M1

---

### AC-2: RAG 검색에서 해당 repo 인용 반환

**Given**: AC-1이 완료되어 MD-process에서 ingest된 도메인 콘텐츠(FDA 510(k), EU MDR, MFDS, ISO13485, SOP 등) 가 `source_sections` 에 gx10 embedding과 함께 존재한다. 단, ingest 직후 source 행들은 `approvalStatus='pending_review'`(sync.ts:543) 상태이며, `composeRetrievalGates`(lib/source-governance/retrieval-gate.ts) 가 `approvalStatus !== 'approved'`를 검색에서 영구 제외한다.

**When**: RA-owner가 `POST /api/source-governance/approve`(REQ-SOURCE-GOV-015)로 MD-process 출처 source 들을 `approved`로 전환한 후, 사용자가 RAG Q&A에 해당 도메인 질의를 보낸다 (예: "FDA 510(k) submission 요건은?").

**Then**:
- 응답에 MD-process에서 유래한 source 인용(source_host/owner/repo/path 메타) 이 포함된다.
- 인용된 source의 `approvalStatus='approved'` 임을 직검(`SELECT approval_status FROM sources WHERE source_repo='MD-process'`)하고, `source.approved` audit 행이 기록됨을 확인한다.
- 검색 엔진이 승인된 source의 chunk를 반환함을 런타임 증거(응답 payload 또는 로그)로 확인한다.

**매핑**: REQ-KB-006, REQ-KB-009, REQ-KB-031 / Milestone M1

---

### AC-3: 실패 시 syncStatus='failed' + audit

**Given**: 실DB가 실행 중이고, MD-process knowledge_source가 등록되어 있다.

**When**: 의도적으로 실패를 유발한다 (예: 잘못된 branch 이름, 또는 일시적 네트워크 차단, 또는 auth_token 무효화).

**Then**:
- `syncStatus` 가 `failed` 로 갱신된다 (직검).
- `audit_logs` 테이블에 `action='knowledge_source.synced'`, `resource_type='knowledgeSource'`, `meta_json.status='failed'` 인 행이 동일 트랜잭션에 기록된다 (직검 — UPDATE와 audit 행이 원자적).
- `corpus_sync_runs` 행이 status=`failed` + `error_message` 와 함께 기록된다.

**매핑**: REQ-KB-004, NFR-KB-AUD-001, NFR-KB-AUD-002 / Milestone M1

---

### AC-4: re-sync 시 supersession (기존 chunk superseded)

**Given**: AC-1이 완료되어 MD-process의 특정 파일에 대해 `source_sections` 행들이 존재한다.

**When**: 동일 knowledge_source에 대해 re-sync를 트리거한다.

**Then**:
- 새 `corpus_sync_runs` 행이 생성된다 (새 ingestionRunId).
- 기존 chunk 들에 대해 `applyOutdateOperations` 이 적용되어 outdated 상태로 전이된다 (직검 — `resolveExistingChunkIds` + outdate 결과, `chunksOutdated > 0`).
- 동일 파일의 새 chunk 가 삽입된다 (`chunksAdded > 0`).
- `sources` 행은 재사용된다 (동일 provenance key: orgId + host/owner/repo/path).

**매핑**: REQ-KB-005 / Milestone M1

---

## 2. M0 — 문서 수정 AC

### AC-5: `docs/architecture/knowledge-base.md` 단일 진실 원천 생성

**Given**: `docs/architecture/knowledge-base.md` 가 존재하지 않는다 (또는 KB에 대한 단일 SoT가 부재하다).

**When**: M0 작업을 완료한다.

**Then**:
- `docs/architecture/knowledge-base.md` 가 생성되고, 다음을 포함한다:
  - "지식베이스 = 3개 git repo (ra-project, MD-process, ra-llm-wiki)" 선언.
  - 데이터 소싱(repo → knowledge_sources) vs 검색 도메인(FDA/EU MDR/...) 분리 섹션 (spec.md §5 선언과 동일).
  - repo별 접근 방식(GitHub: GITHUB_PAT + knowledge_sources git sync; Gitea: adapter + GITEA_TOKEN).
  - auth-token 평문 저장 현황 주의(NFR-KB-SEC-002) + diskstation SSRF 현황(NFR-KB-SEC-003).
- 직검: 파일 존재 + 섹션 헤더 포함.

**매핑**: REQ-KB-010, REQ-KB-011 / Milestone M0

---

### AC-6: production-deployment-gap BLOCK-1 정정

**Given**: `docs/proposals/production-deployment-gap-2026-07-10.md` BLOCK-1 이 "6개 코퍼스 seed" / "FDA 510(k) · EU MDR · MFDS · PMDA · internal SOP" 프레이밍을 포함한다.

**When**: M0 작업을 완료한다.

**Then**:
- BLOCK-1이 "3개 git repo 연동 (ra-project, MD-process, ra-llm-wiki)" 프레이밍으로 정정된다.
- "FDA/EU MDR/MFDS/NMPA/PMDA/SOP" 가 검색 도메인으로 재기술된다.
- `knowledge-base.md` 를 참조하도록 링크가 추가된다.
- 직검: 수정된 BLOCK-1 텍스트가 "3개" / "repo" 키워드를 포함하고, "6개 코퍼스 seed" 가 제거되었다.

**매핑**: REQ-KB-012 / Milestone M0

---

### AC-7: seed scripts 헤더 정정 + product.md

**Given**: `scripts/seed-corpus.ts` L1-8, `scripts/seed-fda-corpus.ts` L1-9 가 `Requires: OPENAI_API_KEY` stale heuristic 을 포함하고, `.moai/project/product.md` L63/L90 이 "6개 corpus" 프레이밍을 포함한다.

**When**: M0/M3 작업을 완료한다.

**Then**:
- 두 seed script 헤더가 "test fixture 전용, 운영 코퍼스는 git 연동(`knowledge-base.md` 참조)" 을 명시한다.
- stale `OPENAI_API_KEY` heuristic 이 gx10 embed 경로 안내로 대체된다 (M3).
- `product.md` L63/L90 이 데이터 소싱(3 repo)과 검색 도메인을 분리 기술한다.
- 직검: 각 파일의 수정된 행 확인.

**매핑**: REQ-KB-013, REQ-KB-014, REQ-KB-021 / Milestone M0 (헤더/product), M3 (OPENAI_API_KEY)

---

## 3. M2 — ra-project + ra-llm-wiki AC

### AC-8: ra-project repo 동기화

**Given**: AC-1(MD-process) 이 완료되어 파이프라인이 검증되었다.

**When**: ra-project(`https://github.com/holee9/ra-project.git`) 를 knowledge_source로 등록 후 동기화한다.

**Then**:
- AC-1과 동일한 검증(코퍼스 채워짐, 상태 전이, audit)이 통과한다.
- 154 md 파일이 ingest된다 (MAX_FILES=500 cap 내).

**매핑**: REQ-KB-007 / Milestone M2

---

### AC-9: ra-llm-wiki adapter 경로 운영 절차 문서화

**Given**: ra-llm-wiki Gitea adapter(`scripts/ingest-gitea-wiki.ts`) 가 존재하고, `GITEA_TOKEN`/`GITEA_URL`/`GITEA_WIKI_REPO` 환경 설정이 가능하다.

**When**: M2 작업을 완료한다.

**Then**:
- `knowledge-base.md` 에 ra-llm-wiki ingest 절차(adapter 사용, 환경 변수, 트리거 명령) 가 문서화된다.
- D1-A 결정(유지) 근거가 명시된다.
- 직검: 문서 섹션 존재. (주: M2는 adapter 실행 그 자체보다 운영 절차 문서화가 주된 범위 — adapter는 이미 hardening됨)

**매핑**: REQ-KB-008 / Milestone M2

---

## 4. M3 — gx10 cleanup AC

### AC-10: stale OPENAI_API_KEY heuristic 제거

**Given**: `scripts/seed-corpus.ts` 와 `scripts/seed-fda-corpus.ts` 에 `Requires: DATABASE_URL, OPENAI_API_KEY in environment` 주석이 존재한다.

**When**: M3 작업을 완료한다.

**Then**:
- 두 스크립트의 헤더에서 `OPENAI_API_KEY` 요구 명시가 제거되거나, gx10 embed 경로 안내로 대체된다.
- `seed-corpus.ts` 의 runtime 경로는 이미 `embedChunks` → gx10 을 사용하므로 코드 변경 불필요 (헤더만).
- `seed-fda-corpus.ts` 의 `import { openai } from '@ai-sdk/openai'` + 직접 `embed()` 호출은 test fixture 허용 범위로 주석 명시 (runtime ingestion 아님).
- 직검: 두 파일 헤더에 `OPENAI_API_KEY` 가 필수 요구로 표기되지 않음.

**매핑**: REQ-KB-020, REQ-KB-021 / Milestone M3

---

## 5. M4 — 게이트 AC (L-013 방어)

### AC-11: 품질 게이트 통과

**Given**: M0-M3 코드/문서 변경이 완료되었다.

**When**: M4 게이트를 실행한다.

**Then**:
- `pnpm typecheck` — 0 errors (직검 출력).
- `pnpm lint` (lint:hex 포함 full) — 0 errors, 코드 줄 `#NNN` 금지 (L-008).
- `pnpm test` (full, 타깃만 아님) — 0 failures (L-009).
- `pnpm ci:*` 전 단계 — 0 failures (L-015: 일부 green ≠ 전체 green, 로컬 직검).
- 커밋 범위가 staged 범위와 일치 (L-009).

**매핑**: NFR-KB-TRC-001 / Milestone M4

---

### AC-12: 실DB E2E 직검 (L-013 핵심 방어)

**Given**: AC-1 ~ AC-4 가 mock 기반이 아닌 실DB(pgvector)에서 실행 가능하다.

**When**: M4 검증을 완료한다.

**Then**:
- AC-1 ~ AC-4 의 모든 `SELECT COUNT(*)` / 상태 전이 / audit / supersession 검증이 실DB에서 직검된다.
- mock-only 또는 self-report 로 본 SPEC 완료를 선언하지 않는다 (REQ-KB-032).
- 직검 증거(DB 쿼리 출력, RAG 응답 payload, audit_rows) 가 커밋 메시지 또는 PR 본문에 첨부된다.

**매핑**: REQ-KB-030, REQ-KB-031, REQ-KB-032 / Milestone M1 (실행), M4 (검증)

---

## 6. 엣지 케이스

### EC-1: MD-process 549파일 > MAX_FILES=500

- **시나리오**: 단일 동기화에서 500파일 cap 도달.
- **기대**: 500파일만 ingest되고, 나머지 49파일은 건너뛰어지며 경고 로그가 기록된다 (sync.ts L374-379).
- **처리**: NFR-KB-PERF-001 로 문서화. 본 SPEC은 MAX_FILES 변경을 포함하지 않는다(EXCL). 별도 검토.

### EC-2: 단일 파일 추출/임베딩 실패

- **시나리오**: MD-process의 한 파일이 손상되었거나 미지원 형식.
- **기대**: 해당 파일은 `stats.errors` 에 기록되고, 전체 동기화는 계속된다 (per-file try/catch, sync.ts L318-326).
- **검증**: AC-1 에서 `errors` 배열이 비어있지 않더라도 `syncStatus='synced'` 가 유지됨을 확인.

### EC-3: 모든 파일 실패

- **시나리오**: MD-process의 전체 파일 ingest 실패 (예: 권한 문제).
- **기대**: all-files-failed guard(sync.ts L330-332) 가 발동하여 `syncStatus='failed'` 로 전이.
- **검증**: AC-3 경로로 흡수.

### EC-4: auth_token 없이 공개 repo 동기화

- **시나리오**: MD-process가 공개 repo라 auth_token 없이 동기화.
- **기대**: `cloneRepo` 의 `if (authToken && gitUrl.startsWith('https://'))` 분기(sync.ts L188) 가 우회되어 비인증 clone 시도. 공개 repo이므로 성공.
- **검증**: M1에서 `GITHUB_PAT` 없이도 동작하는지 직검 (공개이므로 예상 성공). 단, rate limit 회피를 위해 PAT 사용을 권장.

### EC-5: re-sync 중 콘텐츠 변화 없음

- **시나리오**: MD-process 내용 변화 없이 re-sync.
- **기대**: 동일 chunk_hash 로 재삽입 시도 + 기존 chunk supersession. `chunksAdded > 0` (재삽입), `chunksOutdated > 0` (이전 chunk).

---

## 7. Definition of Done

- [ ] AC-1 ~ AC-4 (#312 E2E, 실DB 직검) 통과
- [ ] AC-5 ~ AC-7 (M0 문서 수정) 통과
- [ ] AC-8 ~ AC-9 (M2 ra-project + Gitea 문서화) 통과
- [ ] AC-10 (M3 gx10 cleanup) 통과
- [ ] AC-11 (M4 품질 게이트) 통과
- [ ] AC-12 (M4 실DB 직검 증거) 통과
- [ ] 모든 EARS REQ-KB-### (REQ-KB-001..014, 020..021, 030..032) 가 하나 이상의 AC에 매핑됨
- [ ] 검색 도메인 참조(`lib/ai/retrievers/*`, `lib/classification/*`) 미수정 확인
- [ ] `syncKnowledgeSource` / `ingestDocuments` 시그니처 불변 확인 (비파괴)
- [ ] 커밋 메시지가 `SPEC-REGULA-CORPUS-SEED-001` + `#312` 참조
- [ ] `docs/architecture/knowledge-base.md` 가 단일 진실 원천으로 확립

---

## 8. 품질 게이트 기준

| 게이트 | 기준 | 근거 |
|--------|------|------|
| typecheck | 0 errors | ci 엄수 |
| lint (full, lint:hex 포함) | 0 errors, 줄 `#NNN` 금지 | L-008 |
| test (full) | 0 failures, staged 범위 직검 | L-009 |
| ci:* (전 단계) | 0 failures, 로컬 직검 | L-015 |
| 실DB E2E | AC-1..4 직검, mock-only 기각 | L-013 |
| SSRF guard | 약화 금지 (isInternalHost 불변) | NFR-KB-SEC-003 |
| auth-token | 평문 저장 현황 기록, 암호화는 별도 이슈 | NFR-KB-SEC-002 |
