# Research — SPEC-REGULA-CORPUS-SEED-001

> 작성일: 2026-07-10 | 작성자: manager-spec | Branch: `feat/spec-regula-corpus-seed-001-plan`
> 상태: 직검 기반 (L-013 anti-pattern — 정적 분석/CI mock/self-report 의존 금지)

## 1. 핵심 재정의 (Reframing) — 데이터 소싱 vs 검색 도메인

### 1.1 오개념 (Misrepresentation) 원본

`docs/proposals/production-deployment-gap-2026-07-10.md` BLOCK-1은 본 작업을 "seed 6 corpora: FDA / EU MDR / MFDS / NMPA / PMDA / SOP"로 정의했다. **이것은 데이터 소싱(data-sourcing)에 대한 잘못된 표현이다.**

직검 결과, 지식베이스 데이터 소스는 **3개의 기존 git 저장소**다. "FDA/EU MDR/MFDS/NMPA/PMDA"는 별도의 seed 대상 repo가 아니라, `MD-process` repo 내부 `01_법규_규제/` 하위 디렉토리 구조이자 합법적인 **검색·분류 도메인(retrieval/classification domain)**이다.

### 1.2 진실 (Ground-Truth) — 3개 repo (직검 2026-07-10)

| Repo | URL | 파일 수 | 내용 | 접근 |
|------|-----|---------|------|------|
| **ra-project** | `https://github.com/holee9/ra-project.git` | 154 md | RA scheduler docs, regulatory identification radar, 2026 Q2 regulatory landscape | `GITHUB_PAT` (repo:read), 또는 local `RA_PROJECT_PATH` |
| **MD-process** | `https://github.com/holee9/MD-process.git` | 549 md | 도메인별 구조화: `00_프로젝트관리/`, `01_법규_규제/{01_국내_MFDS,02_국제_ISO13485,03_미국_FDA,04_유럽_MDR}`, `02_품질경영시스템_QMS`, `03_설계_개발관리`, ... `13_규제평가_체크리스트` | `GITHUB_PAT` (repo:read), 또는 local `MD_PROCESS_PATH` |
| **ra-llm-wiki** | Gitea `http://diskstation:7001/DR_RnD/ra-llm-wiki` | (wiki) | 사내 SOP wiki | HTTP 200 (비인증 목록), 콘텐츠는 `GITEA_TOKEN` 필요 |

직검 명령:
```
git ls-remote https://github.com/holee9/ra-project.git HEAD    → e7aa8ac0...  ✓
git ls-remote https://github.com/holee9/MD-process.git HEAD    → 0c0cfc26...  ✓
curl -s -o /dev/null -w "%{http_code}" http://diskstation:7001/DR_RnD/ra-llm-wiki → 303 (redirect, alive)  ✓
```

### 1.3 데이터 소싱 vs 검색 도메인 — 명시적 분류

| 개념 | 정의 | 본 SPEC에서의 처리 |
|------|------|-------------------|
| **데이터 소싱 (Data SOURCING)** | 코퍼스를 채우는 **물리적 데이터 원본** | 3개 git repo → `knowledge_sources` 등록, `syncKnowledgeSource()` 로 ingest |
| **검색 도메인 (Retrieval/Classification DOMAIN)** | RAG 검색·문서 분류 시 사용하는 **논리적 분류 체계** | FDA / EU MDR / MFDS / NMPA / PMDA / ISO13485 / SOP. `lib/ai/retrievers/{fda,eu-mdr}.ts`, `lib/classification/*`, `lib/ingest/doc-classifier.ts` 에서 사용. **이들은 CORRECT — 수정 금지.** |

**결론**: "NMPA/PMDA를 seed-target corpus로 seed한다"는 표현은 잘못이다 (별도 repo가 아님). 그러나 "FDA/EU MDR을 검색 도메인으로 사용한다"는 정확하다. 본 SPEC은 이 둘을 명확히 분리하여, 데이터 소싱 misframing만 수정하고 검색 도메인 참조는 보존한다.

---

## 2. 인프라 인벤토리 (직검 — 재지정 금지)

### 2.1 `syncKnowledgeSource` + `ingestDocuments` — 이미 구현됨

`lib/knowledge-sources/sync.ts` (직검 전체 560라인):

- **cloneRepo** (L165): `execFile('git', ['clone','--depth','1','--single-branch','--branch', branch, cloneUrl, targetDir])` — execFile(argument array, shell=false) → RCE 방어. branch는 `GIT_REF_PATTERN` (`^[a-zA-Z0-9][a-zA-Z0-9._/-]*$`) 로 검증. `..` / leading `-` 차단.
- **SSRF guard** (`isInternalHost`, L36): localhost, ::1, 127/8, 10/8, 192.168/16, 172.16-31, 0/8, `.local` suffix, `metadata.google.internal` 차단.
- **ingestDocuments** (L258): scan → corpus_sync_runs INSERT (1 per repo) → per-file pipeline: extract → classify → chunk → embed → upsert source_sections. MAX_FILES=500, MAX_FILE_SIZE=10MB, MAX_TOTAL_SIZE=100MB. per-file try/catch (1 bad file → continue).
- **supersession**: `resolveExistingChunkIds` → `applyOutdateOperations` (delta-sync 패턴 재사용). re-sync 시 기존 chunk outdated 처리.
- **audit**: 성공/실패 모두 `db.transaction` 내 `writeAudit` (Part 11 §11.10(e), Issue #378 원자성).
- **상태 전이**: syncStatus `idle → syncing → synced | failed`. lastSyncedAt 갱신. corpus_sync_runs `pending → synced | failed`.

### 2.2 임베딩 — gx10 단일 SoT (이미 gx10)

`lib/ai/embedding-provider.ts` (직검):

- gx10 Ollama `qwen3-embedding:latest` (1536-dim MRL truncation, `http://192.168.100.1:11434/v1`).
- `embedBatchTexts()` → `embedMany()` via `getEmbeddingModel()`. 모든 consumer (embedChunks, retrievers, knowledge-promo, ingest)가 라우팅.
- MRL truncation은 fetch layer에서 주입 (`withEmbeddingDimensions`, L66) — pgvector `vector(1536)` byte-compatible.
- **Direct-verified 2026-07-01** (L-013). OpenAI runtime dependency 없음.

`lib/ingest/embed.ts` `embedChunks` → `embedBatchTexts` (gx10). 따라서 **ingestion 경로는 이미 gx10을 사용 중**. M3 cleanup은 seed scripts의 stale heuristic 제거만 해당.

### 2.3 knowledge_sources 스키마

`lib/db/schema.ts:3272` (직검):

```
knowledge_sources:
  id, organizationId, orgLabel, gitUrl, branch,
  sourceHost, sourceOwner, sourceRepo,
  lastSyncedAt, syncStatus (default 'idle'),
  authTokenEncrypted (text),    ← 열 이름은 "encrypted"지만...
  createdBy, createdAt
```

### 2.4 auth-token 경로 — 중요 발견 (보안 GAP)

직검 결과 (`app/api/ra/knowledge-sources/route.ts:40,62`, `[id]/sync/route.ts:50`):

- POST 생성: `body.auth_token` → `authTokenEncrypted: auth_token || null` (route.ts:62). **실제 암호화 없음** — 열 이름과 달리 평문 저장.
- POST 동기화: `auth_token: source.authTokenEncrypted` ([id]/sync/route.ts:50) → `syncKnowledgeSource({ auth_token })` → `cloneRepo(authToken)` → HTTPS URL에 username으로 주입 (sync.ts:188-193).

**결론**: auth-token은 이미 end-to-end로 연결되어 작동한다. 단, **저장 시 암호화가 누락**되어 있다 (열 이름과 불일치). 이것은 본 SPEC의 직접 범위가 아니나, NFR-KB-SEC-002로 명시하고 연계 이슈(REG-395 계열)로 위임한다. 본 SPEC은 **기존 메커니즘을 있는 그대로 사용**한다 (비파괴 원칙).

### 2.5 Gitea wiki adapter — 별도 경로 (knowledge_sources 아님)

`scripts/ingest-gitea-wiki.ts` (직검):

- **GraphQL API** 방식 (`/api/graphql`, wiki.pages.nodes). git clone 아님.
- 자체 SSRF guard (`assertGiteaUrlAllowed`, `lib/gitea/url-guard`) — https OR internal host 허용 (이슈 작성 경로와 동일 정책).
- token-leak sanitizer (`sanitizeGiteaErrorBody`) — Gitea error body가 Authorization header를 echo하는 것 방지.
- `sources`/`source_sections`에 **직접 INSERT** (knowledge_sources 테이블 거치지 않음). `knowledge_sources`의 syncStatus/lastSyncedAt/corpus_sync_runs 추적 없음.
- 환경: `GITEA_URL`, `GITEA_TOKEN`, `GITEA_WIKI_REPO`.

### 2.6 SSRF guard — diskstation 거동 (직검)

`isInternalHost("diskstation")` (sync.ts:36-49):
- `localhost`? No. `::1`? No. `127./10./192.168./172.16-31./0.` regex? No (hostname, not IP). `.local` suffix? No. `metadata.google.internal`? No.
- **결과: NOT blocked.** diskstation은 hostname이므로 IP regex를 우회한다. 그러나 실제로는 LAN-internal 호스트다.
- `lib/gitea/url-guard`의 `assertGiteaUrlAllowed`는 다른 정책 (https OR internal 허용)을 사용하므로 adapter 경로는 정상 작동한다. 그러나 `knowledge_sources` 경로로 Gitea wiki를 연결하면 `isInternalHost` 통과 → 직접 LAN 접근. **이것이 M2 design decision의 핵심.**

### 2.7 API 경로

- `POST /api/ra/knowledge-sources` (route.ts) — 생성. body: `{ git_url, branch, auth_token }`.
- `POST /api/ra/knowledge-sources/[id]/sync` — 동기화 트리거.
- `GET/PATCH/DELETE /api/ra/knowledge-sources/[id]`.

### 2.8 기존 테스트 (mock-based, L-013 맹점)

- `tests/integration/knowledge-sources.test.ts` — mock 기반, IDOR + audit 검증.
- `tests/unit/knowledge-sources/{parse-git-url,ingest-documents}.test.ts`.
- **실DB E2E (#312 AC) 미검증** — 본 SPEC M1/M4가 해결.

---

## 3. 오개념 (Misrepresentation) 수정 대상 분류표

다음은 "데이터 소싱 misframing" grep hit 파일 분류다. **일괄 재작성 금지** — 개별 분류 후 수정.

### 3.1 REVISE (데이터 소싱 misframing — 수정 대상)

| 파일 | 행 | 현재 내용 | 수정 방향 |
|------|----|-----------|-----------|
| `docs/proposals/production-deployment-gap-2026-07-10.md` | BLOCK-1 | "코퍼스 seed: FDA 510(k) · EU MDR · MFDS · PMDA · internal SOP" / "SPEC ... 6개 코퍼스 seed" | "3개 git repo 연동 (ra-project, MD-process, ra-llm-wiki) → ingestion. FDA/EU MDR/MFDS/NMPA/PMDA/SOP는 검색·분류 도메인(별도 repo 아님)" |
| `scripts/seed-corpus.ts` | L1-8 header | "운영 DB에서는 사용 금지" + `Requires: DATABASE_URL, OPENAI_API_KEY` | test-only 명시 강화 + `OPENAI_API_KEY` → gx10 embed 경로 안내 + `knowledge-base.md` 참조 추가 |
| `scripts/seed-fda-corpus.ts` | L1-9 header | `Requires: DATABASE_URL, OPENAI_API_KEY` | 동일. `import { openai } from '@ai-sdk/openai'` (L10) + `embed()` 직접 호출은 test fixture 허용 범위로 문서화 (runtime ingestion 아님) |
| `.moai/project/product.md` | L63, L90 | "RAG Q&A (6개 corpus)" / "FDA/EU MDR/MFDS/NMPA/PMDA + internal SOP 전용" | "RAG Q&A (3개 지식 repo 연동)" / 도메인 설명은 유지하되 "소싱=3 repo, 도메인=FDA/..." 분리 명시 |

### 3.2 KEEP (검색·분류 도메인 참조 — 수정 금지)

| 파일 | 근거 |
|------|------|
| `lib/ai/retrievers/fda.ts`, `lib/ai/retrievers/eu-mdr.ts` | 검색 도메인 분류기. CORRECT. |
| `lib/classification/*` | 문서 분류. CORRECT. |
| `lib/ingest/doc-classifier.ts` | 분류 로직. CORRECT. |
| `lib/ingest/chunkers/*` (sop, iso13485 등) | 도메인별 chunker. CORRECT. |
| chunker 라우팅에서 NMPA/PMDA 키워드 | 도메인 분류 키워드로서 CORRECT (별도 repo 아님). |

### 3.3 NOTE (참조만, 수정 불필요)

| 파일 | 비고 |
|------|------|
| `docs/architecture/` 기존 문서 | `knowledge-base.md` 신규 생성 후 역참조 추가 여부는 M0에서 결정 |
| `CLAUDE.md`, `.claude/rules/` | 본 SPEC 범위 외 (규칙 파일은 수정 금지) |

> 전체 grep hit 파일 목록 (~40건) 은 M0에서 `knowledge-base.md` 작성 시 개별 직검하여 위 3分类로 최종 배치한다. 본 research.md에서는 분류 **규칙**을 확정한다.

---

## 4. Design Decisions

### D1. Gitea wiki 경로 — `ingest-gitea-wiki.ts` adapter 유지 (권장)

**옵션 A (권장): 기존 `ingest-gitea-wiki.ts` GraphQL adapter 유지**
- 근거: (a) 이미 운영 검증 — token-leak sanitizer + url-guard + withRetry hardened; (b) knowledge_sources git-clone 경로는 wiki의 파일 구조를 repo로 취급하여 provenance 메타(host/owner/repo/path) 부정확; (c) knowledge_sources의 SSRF guard(`isInternalHost`)는 diskstation hostname을 우회하여 LAN 직접 접근 → SS-1 보안 우려.
- 단점: 두 경로(knowledge_sources + adapter)가 병존 → 운영 복잡도. 단, 서로 다른 데이터 소스(GitHub repo vs Gitea wiki) 담당이므로 정당화 가능.
- M2에서 `knowledge-base.md`에 두 경로의 역할 분담 명시.

**옵션 B: knowledge_sources로 통일 (기각)**
- 근거: 위 D1-A의 단점 역방향. 단일 경로 단순화.
- 기각 사유: SSRF guard 약화 필요 (`isInternalHost` 예외 추가) → 보안 부채. wiki GraphQL 접근이 이미 hardening되어 있으므로 중복 작업.

> **D1 결론**: 옵션 A 채택. ra-llm-wiki는 adapter 경로 유지. 본 SPEC은 adapter의 존재를 문서화하고, M2에서 ra-llm-wiki ingest를 트리거하는 절차(runbook)를 정의한다. 단, M1 E2E de-risk는 GitHub repo(MD-process)로 수행한다.

### D2. SSRF allowlist — 지금은 약화 금지, config 기반 도입 검토

**현황**: `isInternalHost` 는 IP regex 기반. `diskstation` hostname은 통과(LAN-internal이지만 차단 안 됨). 이는 **기존 보안 우려**다.

**본 SPEC 입장**:
- D1-A 채택으로 ra-llm-wiki는 adapter 경로 → knowledge_sources SSRF guard를 경유하지 않음. 따라서 **본 SPEC에서 SSRF guard 수정 불필요**.
- 단, 장기적으로 knowledge_sources가 LAN Gitea를 지원해야 할 경우, env 기반 allowlist (`KB_INTERNAL_HOSTS_ALLOWLIST`) 도입이 권장됨. 이것은 **별도 SPEC/이슈**로 위임 (본 SPEC 범위 외, NFR-KB-SEC-003로만 명시).
- **SS-1**: 본 SPEC은 SSRF guard를 약화하지 않는다. diskstation이 실제로 차단되지 않는 현황을 문서화만 한다.

### D3. auth-token — 기존 메커니즘 사용 (비파괴)

- `GITHUB_PAT` (repo:read) → POST 생성 API `auth_token` 필드 → `authTokenEncrypted` 열에 저장(평문, 열 이름과 불일치) → cloneRepo에서 HTTPS username으로 주입.
- 본 SPEC은 이 경로를 있는 그대로 사용. **저장 시 암호화는 본 SPEC 범위 외** (REG-395 계열 별도 이슈). NFR-KB-SEC-002로 명시.
- M1 검증: `GITHUB_PAT` 가 없는 환경에서는 local clone 경로(`RA_PROJECT_PATH` / `MD_PROCESS_PATH`) fallback 문서화 (runbook).

### D4. MD-process를 M1 de-risk 대상으로 선택

- 549 md 파일 → 가장 풍부 + 다도메인 (FDA/EU MDR/MFDS/ISO13485/SOP 혼재).
- 단일 GitHub host → auth-token 경로 단순 (`GITHUB_PAT`).
- #312 AC 4건을 가장 빠르게 end-to-end 검증 가능.

### D5. 코퍼스 seed 방식 — test fixture scripts는 runtime에서 제거 검토

- `seed-corpus.ts` / `seed-fda-corpus.ts` 는 `pnpm db:seed:corpus` / 수동 실행 → test fixture.
- 본 SPEC은 운영 코퍼스를 **오직 knowledge_sources git 연동**으로만 구축한다는 원칙을 확정. seed scripts는 test fixture로 명시적 격리 (M3).

---

## 5. Charter 정합성

- [지양-1] 범위 이탈 방지: RA Q&A 지식 구축 (영업/마케팅/인사 지식 아님). 3개 repo 모두 RA 도메인.
- [지양-2] 인용 필수: #312 AC-2 "RAG 검색에서 해당 repo 인용 반환" 으로 보장.
- 본 SPEC은 지식 소싱(운영 데이터 주입)이지 일반 KB 기능 추가가 아님 → Charter 범위 내.

## 6. 의존성 및 환경

- 실DB (pgvector, 포트 5433) — #312 AC의 회귀 높음(L-013), 별도 세션 권장.
- `GITHUB_PAT` (repo:read, ra-project + MD-process) — M1/M2.
- `GITEA_TOKEN` + `GITEA_URL` + `GITEA_WIKI_REPO` — M2 (ra-llm-wiki adapter).
- gx10 Ollama (`192.168.100.1:11434`) embedding — 이미 구성됨.

## 7. 참조

- Issue #312 (E2E driver, AC 4건)
- Issue #307 (Phase D — knowledge-sources 구현 완료)
- `docs/proposals/production-deployment-gap-2026-07-10.md` BLOCK-1 (수정 대상)
- `docs/proposals/phase-d-2b-ingestion-plan-2026-06-30.md` (ingestion 설계)
- SPEC-REGULA-DOCINGEST-001 (파이프라인 원본)
- SPEC-LLM-MIGRATION-A Phase A-revised (gx10 embedding)
- L-013 (정적 테스트 + CI mock + self-report 3중 맹점 — 실DB 직검 필수)
