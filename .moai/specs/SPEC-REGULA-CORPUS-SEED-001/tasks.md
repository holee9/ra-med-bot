# Tasks & Milestones — SPEC-REGULA-CORPUS-SEED-001

> 작성일: 2026-07-10 | 순서: M0 → M1 → M2 → M3 → M4 (순차, 일부 병렬 가능)
> 시간 추정 금지 (L-007) — Priority + 선행 관계로 순서 표기.

## Milestone 개요

| Milestone | 이름 | Priority | 선행 | 핵심 산출물 |
|-----------|------|----------|------|------------|
| M0 | 문서 수정 — 단일 진실 원천 확립 | High | 없음 | `knowledge-base.md`, gap doc 정정, seed headers, product.md |
| M1 | MD-process E2E (#312 de-risk) | High | M0 | AC-1..4 실DB 직검, MD-process 코퍼스 populated |
| M2 | ra-project + ra-llm-wiki 확장 | Medium | M1 | ra-project 코퍼스, Gitea adapter 운영 절차 문서화 |
| M3 | gx10 embedding cleanup | Medium | M0 | stale OPENAI_API_KEY heuristic 제거 |
| M4 | 게이트 (품질 + 실DB 직검) | High | M1..M3 | typecheck/lint/test/ci:* + 실DB E2E 증거 |

> M3는 M0와 병렬 가능 (seed script 헤더 정정이 M0의 일부이기도 함). M4는 모든 마일스톤 완료 후 최종 검증.

---

## M0 — 문서 수정 (단일 진실 원천 확립)

> 근거: 데이터 소싱 misframing 정정 + `knowledge-base.md` 확립. 이 마일스톤이 SPEC의 "재정의"를 공식화한다.

### Task M0-1: `docs/architecture/knowledge-base.md` 신규 작성 — Priority High

- **파일**: `docs/architecture/knowledge-base.md` (신규)
- **내용**:
  - 섹션 1: "지식베이스 = 3개 git repo" 선언 (ra-project, MD-process, ra-llm-wiki).
  - 섹션 2: 데이터 소싱 vs 검색 도메인 분리 (spec.md §5 선언과 동일).
  - 섹션 3: repo별 접근 방식 — GitHub(ra-project, MD-process): `GITHUB_PAT` + `knowledge_sources` git sync 경로. Gitea(ra-llm-wiki): `ingest-gitea-wiki.ts` adapter + `GITEA_TOKEN` 경로 (D1-A 결정).
  - 섹션 4: auth-token 현황 주의(NFR-KB-SEC-002) + diskstation SSRF 현황(NFR-KB-SEC-003).
  - 섹션 5: 운영 절차(runbook) — 동기화 트리거, 상태 전이, 실패 시 대응.
- **매핑**: REQ-KB-010, REQ-KB-011 / AC-5

### Task M0-2: `production-deployment-gap-2026-07-10.md` BLOCK-1 정정 — Priority High

- **파일**: `docs/proposals/production-deployment-gap-2026-07-10.md` (수정)
- **내용**: BLOCK-1 "6개 코퍼스 seed" / "SPEC ... 6개 코퍼스 seed" 를 "3개 git repo 연동" 으로 정정. FDA/EU MDR/MFDS/NMPA/PMDA/SOP 를 검색 도메인으로 재기술. `knowledge-base.md` 링크 추가.
- **매핑**: REQ-KB-012 / AC-6

### Task M0-3: seed scripts 헤더 정정 — Priority Medium

- **파일**: `scripts/seed-corpus.ts` (헤더 L1-8), `scripts/seed-fda-corpus.ts` (헤더 L1-9)
- **내용**:
  - "test fixture 전용, 운영 DB 사용 금지" 강화 (이미 seed-corpus.ts L2-3에 있음 — 보강).
  - "운영 코퍼스는 `docs/architecture/knowledge-base.md` 기술된 git 연동 경로로만 구축" 안내 추가.
  - stale `Requires: OPENAI_API_KEY` → gx10 embed 경로 안내로 대체 (M3와 중복, M0에서 헤더 라인만).
- **매핑**: REQ-KB-013 / AC-7

### Task M0-4: `.moai/project/product.md` KB 행 정정 — Priority Medium

- **파일**: `.moai/project/product.md` (L63, L90)
- **내용**: "RAG Q&A (6개 corpus)" → "RAG Q&A (3개 지식 repo 연동)". "FDA/EU MDR/MFDS/NMPA/PMDA + internal SOP 전용" → 소싱(3 repo)과 도메인(FDA/...) 분리 기술.
- **매핑**: REQ-KB-014 / AC-7

### Task M0-5: misframing grep hit 파일 분류 확정 — Priority Medium

- **내용**: research.md §3 분류 규칙(REVISE / KEEP / NOTE)에 따라, grep hit ~40건을 개별 직검하여 최종 배치. REVISE 대상만 수정. KEEP(`lib/ai/retrievers/*`, `lib/classification/*` 등) 은 불변.
- **매핑**: REQ-KB-011 (간접)

---

## M1 — MD-process E2E (#312 de-risk)

> 근거: #312 AC 4건을 MD-process(549 md, 다도메인) 단일 repo로 가장 빠르게 실DB 검증.

### Task M1-0: E2E 인증/조직 컨텍스트 준비 — Priority High (필수 선행)

- **근거 (plan-auditor C1)**: `POST /api/ra/knowledge-sources`(`knowledgesources.manage`)와 `POST /api/source-governance/approve`(`sourcegov.manage`) 모두 `ra-lead` 세션(`session.user.organizationId` + `session.user.id`)을 요구(permissions.ts:346,465). 누락 시 첫 API 호출에서 401/403 → AC-1..4 전부 차단.
- **준비**:
  1. 실DB에 `organizations` 행 존재/seed 확인 (기존 dev 조직 재사용 권장).
  2. 해당 조직에 `ra-lead` 역할 사용자 존재/seed 확인.
  3. E2E API 호출용 세션 획득 방식 확정 (dev 로그인 세션 쿠키, 또는 테스트 bearer/스크립트 인증).
- **검증**: 세션이 `knowledgesources.manage` + `sourcegov.manage` 권한을 모두 가짐을 직검.
- **매핑**: REQ-KB-001, REQ-KB-009 / AC-1 Given (신규 전제)

### Task M1-1: 환경 준비 — Priority High

- **확인**: 실DB(pgvector, 포트 5433) 실행. `GITHUB_PAT`(repo:read) 설정. gx10 Ollama(`192.168.100.1:11434`) embedding 접근.
- **산출물**: 환경 준비 체크리스트(커밋 불필요, 실행 로그만).

### Task M1-2: MD-process knowledge_source 등록 — Priority High

- **API**: `POST /api/ra/knowledge-sources` body: `{ git_url: 'https://github.com/holee9/MD-process.git', branch: 'main', auth_token: '<GITHUB_PAT>' }`.
- **검증**: `SELECT * FROM knowledge_sources WHERE source_repo = 'MD-process'` 행 존재 직검. `authTokenEncrypted` 열에 token 저장됨(평문 — NFR-KB-SEC-002 현황 기록).
- **매핑**: REQ-KB-001 / AC-1

### Task M1-3: 동기화 트리거 + 성공 검증 — Priority High

- **API**: `POST /api/ra/knowledge-sources/{id}/sync`.
- **검증(직검)**:
  - `syncStatus` `idle → syncing → synced` 전이.
  - `lastSyncedAt` 갱신.
  - `SELECT COUNT(*) FROM sources WHERE source_repo = 'MD-process'` 증가 (MAX_FILES=500 cap 내).
  - `SELECT COUNT(*) FROM source_sections` 증가.
  - `corpus_sync_runs` status=`synced` 행 추가.
- **매핑**: REQ-KB-002, REQ-KB-003, REQ-KB-030 / AC-1, AC-12

### Task M1-4: source 승인 + RAG 인용 검증 — Priority High

- **M1-4a source 승인 (필수 선행)**: ingest된 MD-process source 행들이 `approvalStatus='pending_review'`로 생성됨을 직검. 이후 `POST /api/source-governance/approve`(REQ-SOURCE-GOV-015)로 `approved` 전환 — `composeRetrievalGates`가 미승인 source를 검색에서 영구 제외하므로 **승인 없이는 RAG 인용 불가** (source-governance 설계, Charter [지양-2]). 게이트 우회 아님.
- **M1-4a-scaling (plan-auditor H1)**: 승인 API는 `sourceId` 1건씩만 처리(types.ts:46). MD-process는 파일당 1 `sources` 행(최대 500건) 생성 → 일괄 승인 필요: `SELECT id FROM sources WHERE source_repo='MD-process' AND approval_status='pending_review'` → loop POST(각 `source.approved` audit 기록), 또는 일괄 승인 쿼리 + audit 보강. 승인 대상 source 수를 AC-2 검증 전 직검.
- **M1-4b RAG 인용 검증**: 도메인 질의(예: "FDA 510(k) submission 요건은?") 로 RAG Q&A 호출.
- **검증(직검)**: `SELECT approval_status FROM sources WHERE source_repo='MD-process'` = `approved`. 응답에 MD-process 출처 인용(source_host=github.com, source_owner=holee9, source_repo=MD-process, source_path) 포함. `source.approved` audit 행 존재. 런타임 증거(응답 payload 또는 로그) 기록.
- **매핑**: REQ-KB-006, REQ-KB-009, REQ-KB-031 / AC-2, AC-12

### Task M1-5: 실패 경로 검증 — Priority High

- **실행**: 의도적 실패 유발(잘못된 branch, 무효 token, 일시적 네트워크 차단 중 택 1).
- **검증(직검)**: `syncStatus='failed'`, `audit_logs` 행 `meta_json.status='failed'` 동일 tx 기록, `corpus_sync_runs` status=`failed` + error_message.
- **매핑**: REQ-KB-004, NFR-KB-AUD-001, NFR-KB-AUD-002 / AC-3

### Task M1-6: re-sync supersession 검증 — Priority High

- **실행**: 동일 knowledge_source에 re-sync 트리거.
- **검증(직검)**: `chunksOutdated > 0` (기존 chunk supersession), `chunksAdded > 0` (새 chunk), `sources` 행 재사용(동일 provenance key). `corpus_sync_runs` 새 행(새 runId).
- **매핑**: REQ-KB-005 / AC-4

### Task M1-7: M1 증거 기록 — Priority Medium

- **산출물**: M1 직검 증거(DB 쿼리 출력, RAG payload, audit rows) 를 PR 본문 또는 커밋 메시지에 첨록.
- **매핑**: REQ-KB-032 / AC-12

---

## M2 — ra-project + ra-llm-wiki 확장

> 근거: M1 de-risk 완료 후 나머지 2 repo로 확장.

### Task M2-1: ra-project knowledge_source 등록 + 동기화 — Priority Medium

- **API**: `POST /api/ra/knowledge-sources` body: `{ git_url: 'https://github.com/holee9/ra-project.git', branch: 'main', auth_token: '<GITHUB_PAT>' }`.
- **검증**: AC-1 동일 검증(154 md 파일, MAX_FILES=500 cap 내).
- **매핑**: REQ-KB-007 / AC-8

### Task M2-2: ra-project RAG 인용 검증 — Priority Medium

- **실행**: RA scheduler/radar 도메인 질의.
- **검증**: ra-project 출처 인용 포함.
- **매핑**: REQ-KB-007 / AC-8

### Task M2-3: ra-llm-wiki adapter 운영 절차 문서화 — Priority Medium

- **파일**: `docs/architecture/knowledge-base.md` (M0-1에서 생성한 파일에 섹션 추가).
- **내용**: D1-A 결정(유지) 근거, adapter 환경(`GITEA_URL`, `GITEA_TOKEN`, `GITEA_WIKI_REPO`), 트리거 명령(`pnpm tsx scripts/ingest-gitea-wiki.ts`), hardening 요약(url-guard + sanitizer + withRetry).
- **매핑**: REQ-KB-008 / AC-9

### Task M2-4: ra-llm-wiki ingest 실행(선택) — Priority Low

- **주**: adapter가 이미 hardening되어 있으므로, 본 SPEC은 실행 그 자체보다 문서화가 주 범위. 환경(`GITEA_TOKEN`) 이용 가능한 경우 실행하여 AC-9를 런타임 검증. 불가능한 경우 문서화로 충족.
- **매핑**: REQ-KB-008 / AC-9

---

## M3 — gx10 embedding cleanup

> 근거: stale OPENAI_API_KEY heuristic 제거 (runtime은 이미 gx10).

### Task M3-1: seed-corpus.ts stale heuristic 제거 — Priority Medium

- **파일**: `scripts/seed-corpus.ts` (헤더 L8 `Requires: DATABASE_URL, OPENAI_API_KEY`).
- **내용**: `OPENAI_API_KEY` 요구 명시 제거. gx10 embed 경로 안내로 대체. (이미 `embedChunks` → gx10 사용 중이므로 코드 변경 불필요, 헤더만.)
- **매핑**: REQ-KB-020, REQ-KB-021 / AC-10

### Task M3-2: seed-fda-corpus.ts stale heuristic 제거 — Priority Medium

- **파일**: `scripts/seed-fda-corpus.ts` (헤더 L8, L10 `import { openai }`, L298).
- **내용**: 헤더 `Requires: OPENAI_API_KEY` 제거 + gx10 안내. `import { openai }` + 직접 `embed()` 호출은 test fixture 허용 범위로 주석 명시(runtime ingestion 아님).
- **매핑**: REQ-KB-021 / AC-10

### Task M3-3: runtime ingestion OpenAI 의존성 부재 직검 — Priority Medium

- **직검**: `lib/ingest/embed.ts` → `embedBatchTexts` → gx10 (embedding-provider.ts). `lib/knowledge-sources/sync.ts` → `embedChunks` → gx10. runtime 경로에 OpenAI 직접 호출 부재 grep 확인.
- **매핑**: REQ-KB-020

---

## M4 — 게이트 (품질 + 실DB 직검)

> 근거: L-013(실DB 직검) + L-008(lint) + L-009(full test) + L-015(ci:* 로컬 직검).

### Task M4-1: typecheck — Priority High

- **실행**: `pnpm typecheck`.
- **기준**: 0 errors (직검 출력).
- **매핑**: AC-11

### Task M4-2: lint (full, lint:hex 포함) — Priority High

- **실행**: `pnpm lint` (full).
- **기준**: 0 errors, 코드 줄 `#NNN` 금지 (L-008).
- **매핑**: AC-11

### Task M4-3: test (full, 타깃만 아님) — Priority High

- **실행**: `pnpm test` (full).
- **기준**: 0 failures (L-009). staged 범위 직검.
- **매핑**: AC-11

### Task M4-4: ci:* (전 단계 로컬 직검) — Priority High

- **실행**: `pnpm ci:*` 전 단계 로컬 실행.
- **기준**: 0 failures (L-015: 일부 green ≠ 전체 green).
- **매핑**: AC-11

### Task M4-5: 실DB E2E 직검 증거 취합 — Priority High

- **산출물**: M1(Task M1-3..M1-7) 의 실DB 직검 증거를 PR 본문에 정리. mock-only 선언 금지(REQ-KB-032).
- **매핑**: AC-12

### Task M4-6: 비파괴 + 검색 도메인 보존 직검 — Priority Medium

- **직검**:
  - `syncKnowledgeSource` / `ingestDocuments` 시그니처 불변 (git diff 확인).
  - `lib/ai/retrievers/*`, `lib/classification/*` 미수정 (git diff 확인).
  - SSRF guard(`isInternalHost`) 불변 (NFR-KB-SEC-003).
- **매핑**: EXCL-4, EXCL-5, NFR-KB-SEC-003 / AC-11

---

## 선행 관계 그래프

```
M0-1 (knowledge-base.md) ─┬─→ M0-2 (gap doc) ──→ M0-5 (grep 분류)
                          ├─→ M0-3 (seed headers) ──→ M3-1, M3-2
                          └─→ M0-4 (product.md)
M1 (순차: M1-1 → M1-2 → M1-3 → M1-4 → M1-5 → M1-6 → M1-7)  [선행: M0 완료]
M2 (M1 완료 후: M2-1 → M2-2; M2-3/M2-4는 M0-1 완료 후 병렬 가능)
M3 (M0-3와 병렬 가능: M3-1, M3-2, M3-3)
M4 (M1, M2, M3 완료 후: M4-1..M4-6)
```

---

## 위험 추적

| 위험 | Milestone | 완화 | 상태 |
|------|-----------|------|------|
| 549파일 > MAX_FILES=500 | M1 | NFR-KB-PERF-001 문서화, MAX_FILES 변경은 본 SPEC 외 | Open |
| auth-token 평문 저장 | M1 | NFR-KB-SEC-002 기록, 별도 이슈 위임 | Open |
| diskstation SSRF 우회 | M2 | D1-A(adapter 유지), guard 약화 금지, 문서화 | Open |
| approval_status pending_review 검색 차단 | M1 | REQ-KB-009 승인 단계(M1-4a)로 해결 — 게이트 우회 아님, source-governance 설계 | Mitigated |
| L-013 mock 맹점 | M4 | 실DB 직검 강제(AC-12), mock-only 기각 | Mitigated by design |

---

## 커밋 전략 (참고용 — 실제 커밋은 orchestrator/manager-git 관장)

- M0: `docs(knowledge-base): 단일 진실 원천 + misframing 정정 — SPEC-REGULA-CORPUS-SEED-001`
- M1: `feat(knowledge-sources): MD-process E2E 실DB 직검 — #312 AC-1..4 (SPEC-REGULA-CORPUS-SEED-001)`
- M2: `feat(knowledge-sources): ra-project + ra-llm-wiki adapter 문서화 (SPEC-REGULA-CORPUS-SEED-001)`
- M3: `chore(seed): stale OPENAI_API_KEY heuristic 제거 — gx10 단일 (SPEC-REGULA-CORPUS-SEED-001)`
- M4: `test(gates): typecheck/lint/test/ci + 실DB E2E 증거 (SPEC-REGULA-CORPUS-SEED-001)`

> 본 tasks.md는 milestone/작업 분해만 제공. 실제 commit/push/PR은 orchestrator가 manager-git으로 위임.
