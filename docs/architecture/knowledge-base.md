# Knowledge Base — 단일 진실 원천 (Single Source of Truth)

> Regula의 RAG 지식베이스가 **어디서 오는지(data sourcing)**, **어떻게 검색되는지(retrieval domain)**, **어떻게 운영되는지(operations)** 를 정의한다.
> 작성일: 2026-07-10 | 근거: SPEC-REGULA-CORPUS-SEED-001 (직검 기반) | Charter [지양-1, 지양-2]

---

## 1. 지식베이스 = 3개 git 저장소

Regula의 운영 RAG 코퍼스는 **3개의 기존 git 저장소**에서만 소싱된다. 이외의 데이터 소스는 없다.

| 저장소 | URL | 규모 | 내용 | 접근 방식 |
|--------|-----|------|------|-----------|
| **ra-project** | `https://github.com/holee9/ra-project.git` | 154 md | RA scheduler, 규제 식별 radar, 규제 동향 | `knowledge_sources` git sync (GitHub PAT) |
| **MD-process** | `https://github.com/holee9/MD-process.git` | 549 md | 도메인별 구조화 규제/QMS/SOP (`01_법규_규제/{MFDS,ISO13485,FDA,EU_MDR}` 등 13개 도메인) | `knowledge_sources` git sync (GitHub PAT) |
| **ra-llm-wiki** | Gitea `http://diskstation:7001/DR_RnD/ra-llm-wiki` | wiki | 사내 SOP wiki | `scripts/ingest-gitea-wiki.ts` GraphQL adapter (Gitea token) |

> **과거 프레이밍 정정**: 이전 문서들(`production-deployment-gap-2026-07-10.md` BLOCK-1 등)이 "6개 코퍼스(FDA/EU MDR/MFDS/NMPA/PMDA/SOP) seed"로 기술했으나, 이는 **데이터 소싱에 대한 잘못된 표현**이었다. FDA/EU MDR/MFDS/NMPA/PMDA/SOP는 별도 저장소가 아니라 아래 §2의 검색·분류 도메인이다.

---

## 2. 데이터 소싱 vs 검색 도메인 (핵심 구분)

이 두 개념을 혼동하면 안 된다.

| 개념 | 정의 | 본 시스템에서의 실체 |
|------|------|----------------------|
| **데이터 소싱 (Data SOURCING)** | 코퍼스를 채우는 **물리적 데이터 원본** | §1의 3개 git 저장소 → `knowledge_sources` 등록 / Gitea adapter |
| **검색 도메인 (Retrieval/Classification DOMAIN)** | RAG 검색·문서 분류 시 사용하는 **논리적 분류 체계** | FDA / EU MDR / MFDS / NMPA / PMDA / ISO13485 / SOP — `MD-process/01_법규_규제/` 하위 디렉토리 구조이자 `lib/ai/retrievers/*`, `lib/classification/*`, `lib/ingest/doc-classifier.ts` 의 라우팅 키 |

**규칙**:
- "NMPA/PMDA를 코퍼스로 seed한다"는 **잘못**이다 (별도 저장소가 아님). 해당 관할구의 문서는 이미 `MD-process` 저장소 내부에 존재한다.
- "FDA/EU MDR을 검색 도메인으로 사용한다"는 **정확**하다. 이 코드(`lib/ai/retrievers/{fda,eu-mdr}.ts` 등)는 **CORRECT — 수정 금지**.

---

## 3. 데이터 소싱 경로 (상세)

### 3.1 GitHub 저장소 (ra-project, MD-process) — `knowledge_sources` git sync

```
운영자: GITHUB_PAT(repo:read) 확보
  → POST /api/ra/knowledge-sources  body: { git_url, branch, auth_token: <PAT> }
    → knowledge_sources 행 생성 (authTokenEncrypted 열에 token 저장 — §5 보안 주의)
  → POST /api/ra/knowledge-sources/{id}/sync
    → syncKnowledgeSource(): git clone → ingestDocuments()
      → 파일별: extract → classify → chunk → gx10 embed → source_sections upsert
    → syncStatus: idle → syncing → synced | failed
    → corpus_sync_runs 행 기록 (status, chunksAdded, chunksOutdated)
```

- **인증**: 코드는 `GITHUB_PAT` 환경변수를 직접 읽지 않는다 (`grep -rn GITHUB_PAT lib/ scripts/ app/` 결과 0건). 운영자가 PAT를 확보해 POST `auth_token` body 필드로 전달 → `authTokenEncrypted` 저장 → `cloneRepo`가 HTTPS URL username으로 주입 (`lib/knowledge-sources/sync.ts:188-193`). 공개 저장소는 `auth_token` 생략 가능(비인증 clone).
- **임베딩**: gx10 Ollama `qwen3-embedding` (1536-dim MRL). `lib/ai/embedding-provider.ts` 단일 SoT. OpenAI runtime 의존성 없음.
- **캡**: `MAX_FILES=500`, `MAX_FILE_SIZE=10MB`, `MAX_TOTAL_SIZE=100MB` (`sync.ts:213`). MD-process(549 md)는 첫 동기화 시 최대 500개 파일 ingest. 전량 ingest가 필요하면 캡 조정(별도 검토).

### 3.2 Gitea wiki (ra-llm-wiki) — GraphQL adapter (별도 경로)

`scripts/ingest-gitea-wiki.ts`:
- Gitea GraphQL API(`/api/graphql`, `wiki.pages.nodes`)로 wiki 페이지 fetch (git clone 아님).
- 자체 hardening: `assertGiteaUrlAllowed`(`lib/gitea/url-guard`), `sanitizeGiteaErrorBody`(token-leak 방지), `withRetry`.
- `sources`/`source_sections`에 직접 INSERT (`knowledge_sources` 테이블 미경유).
- 환경: `GITEA_URL`, `GITEA_TOKEN`, `GITEA_WIKI_REPO`.
- 실행: `pnpm tsx scripts/ingest-gitea-wiki.ts`.

> **왜 knowledge_sources 경로로 통일하지 않는가?** (D1-A 결정): (a) adapter가 이미 운영 검증됨; (b) wiki를 git repo로 취급하면 provenance 메타 부정확; (c) `knowledge_sources`의 SSRF guard(`isInternalHost`)가 `diskstation` hostname을 우회해 LAN 직접 접근 우려 (§5.2).

---

## 4. 검색 게이트 — source-governance 승인 (중요)

**ingest 직후 source는 `approvalStatus='pending_review'`로 생성**된다 (`sync.ts:543`). `composeRetrievalGates`(`lib/source-governance/retrieval-gate.ts`)가 `approvalStatus !== 'approved'`인 source를 **검색에서 영구 제외**한다.

→ 따라서 **RAG Q&A에서 인용되려면 RA-owner의 승인이 필수**다:
```
ingest (pending_review) → POST /api/source-governance/approve (REQ-SOURCE-GOV-015)
  → approvalStatus='approved' + source.approved audit
  → composeRetrievalGates 통과 → RAG 검색 결과에 인용
```

이는 **source-governance 설계**(미검증 콘텐츠가 규제 Q&A에 노출되는 것을 차단, Charter [지양-2])이며, 게이트를 우회하는 것이 아니다. 승인 API는 `sourceId` 1건 단위이므로 다수 source는 일괄 승인 스크립트/쿼리로 처리한다.

---

## 5. 보안 현황 (인지 및 후속 이슈)

### 5.1 auth-token 평문 저장 (#412)

`knowledge_sources.authTokenEncrypted` 열 이름과 달리 **실제 암호화 없이 평문 저장**된다:
- `app/api/ra/knowledge-sources/route.ts:62` — `authTokenEncrypted: auth_token || null`
- `app/api/ra/knowledge-sources/[id]/sync/route.ts:50` — 평문 읽기

저장 시 암호화 구현은 **#412**(priority/high)로 위임. 본 문서 작성 시점까지는 기존 메커니즘을 있는 그대로 사용.

### 5.2 SSRF guard — LAN hostname 우회 (#413)

`isInternalHost`(`sync.ts:36-49`)는 IP 기반 regex만 검사. `diskstation` 같은 LAN hostname은 IP regex를 우회해 통과(실제 LAN-internal 호스트). 현재 ra-llm-wiki는 adapter 경로(§3.2)로 우회하므로 즉시 영향 없음. 단, `knowledge_sources`로 LAN Gitea를 직접 연결하면 노출. env 기반 allowlist(`KB_INTERNAL_HOSTS_ALLOWLIST`) 도입은 **#413**(priority/medium)로 위임. SSRF guard 자체는 약화하지 않는다.

---

## 6. 운영 절차 (Runbook)

### 최초 코퍼스 구축
1. (Task M1-0) 실DB(pgvector) 실행 + `ra-lead` 세션 준비 (`knowledgesources.manage` + `sourcegov.manage` 권한).
2. `GITHUB_PAT`(repo:read) 확보.
3. `POST /api/ra/knowledge-sources`로 ra-project / MD-process 등록 (`auth_token` = PAT).
4. `POST /api/ra/knowledge-sources/{id}/sync`로 동기화 트리거.
5. ingest 완료 후 `POST /api/source-governance/approve`로 source 승인 (§4).
6. (ra-llm-wiki) `GITEA_TOKEN` 설정 후 `pnpm tsx scripts/ingest-gitea-wiki.ts`.

### 상태 전이
- `knowledge_sources.syncStatus`: `idle → syncing → synced | failed`
- `corpus_sync_runs.status`: `pending → synced | failed`
- `sources.approval_status`: `pending_review → approved` (RA-owner 승인 시)

### 실패 시 대응
- `syncStatus='failed'` + `knowledge_source.synced` audit(`meta.status='failed'`, 동일 tx) + `corpus_sync_runs.status='failed'` + `error_message`.
- 원인 진단: `corpus_sync_runs.error_message`, `ingestDocuments`의 `stats.errors`(파일별).

### 재동기화 (re-sync)
- 동일 `knowledge_source`에 재 sync → `applyOutdateOperations`(supersession): 기존 chunk outdated, 새 chunk 삽입. `sources` 행은 재사용(동일 provenance key).

---

## 7. 관련 문서 / 이슈

- SPEC: `SPEC-REGULA-CORPUS-SEED-001` (`spec.md` §5 선언과 동일)
- 이슈: #312 (E2E driver), #412 (auth-token 암호화), #413 (SSRF allowlist)
- 코드: `lib/knowledge-sources/sync.ts`, `lib/ai/embedding-provider.ts`, `lib/source-governance/retrieval-gate.ts`, `scripts/ingest-gitea-wiki.ts`
- Charter: [지양-1] 일반 KB ❌ (RA 규제 도메인 전용), [지양-2] 가짜 신뢰 ❌ (citation 강제 + Expert Review Gate)

---

Version: 1.0.0 | Author: orchestrator (SPEC-REGULA-CORPUS-SEED-001 M0-1) | 직검 기반 (L-013)
