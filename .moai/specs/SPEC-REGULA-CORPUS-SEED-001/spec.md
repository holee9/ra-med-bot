# SPEC-REGULA-CORPUS-SEED-001 — 3-Repo 지식베이스 구축 + #312 E2E + 문서 수정

```yaml
---
id: SPEC-REGULA-CORPUS-SEED-001
title: 3-Repo Knowledge Base Population + #312 E2E + Documentation Revision
version: 1.2.0
status: completed
created: 2026-07-10
updated: 2026-07-16
author: manager-spec
priority: high
issue_number: 312
related:
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-LLM-MIGRATION-A
  - SPEC-REGULA-SOURCE-GOVERNANCE-001
  - SPEC-REGULA-REALDB-001
---
```

## HISTORY

- 2026-07-10 생성 (manager-spec). `production-deployment-gap-2026-07-10.md` BLOCK-1 "6개 코퍼스 seed" 프레이밍을 직검하여 **3개 git repo 연동**으로 재정의. 데이터 소싱 vs 검색 도메인 분리 확립. #312 E2E AC를 M1 de-risk로 매핑. (main `9bcdd23`)
- 2026-07-10 (orchestrator 직검 정정, v1.0.0→1.0.1): **REQ-KB-009 신설** — AC-2 RAG 인용에 source-governance 승인 단계(`POST /api/source-governance/approve`)가 필수임을 코드 직검 확정(sync.ts:543 `pending_review` + `composeRetrievalGates` 미승인 영구 제외). 기존 AC-2/Task M1-4의 "별도 검토 위임"은 결함 — 승인은 source-governance 설계(게이트 우회 아님).
- 2026-07-16 (실행 중 근본원인 정정, v1.0.1→1.1.0): **§1.1 진단 오류 정정 + REQ-KB-022 신설**. "ingestion 파이프라인은 구현됨, 데이터 연결만 부재"는 **부분적으로 틀렸음**. 실제 ra-project ingestion 실행(실DB) 결과, 파이프라인은 작동하나 `lib/ingest/embed.ts`의 PII 가드가 **URL을 PII로 간주**해 규제문서 136개 중 101개(URL 87 + email 14)를 임베딩 전 차단 → 코퍼스 74%가 조용히 드롭됨(`syncStatus=synced`으로 표시되어 L-013류 은폐). 원인: 해당 URL 가드는 외부 API(GitHub Models) 임베딩 시절의 데이터 유출 방어책이었으나, #318이 임베딩을 gx10 온프레미스(LAN)로 옮기며 **obsolete + 치명적**이 됨. 조치: URL 패턴 제거(email/SSN/phone/card 유지), 재현 테스트 추가. 이는 데이터 연결의 **선결 조건**이었음.
- 2026-07-16 (M0~M4 완료, v1.1.0→1.2.0, status planned→completed): 가드 수정 후 **M1~M4 실행 완료**. M1: 3-repo(ra-project/MD-process) ingest + source-governance 승인 622 + RAG 인용 실DB 검증 PASS(`source_sections 19→2187`, `sources 1→623`). M0/M3: `production-deployment-gap` BLOCK-1 해소 마킹(REQ-KB-012), seed 스크립트 헤더 test-fixture 명시 확인(REQ-KB-013), `seed-corpus.ts` stale `OPENAI_API_KEY` heuristic 제거→`SEED_SKIP_EMBED` opt-out으로 교체(REQ-KB-021). M4: typecheck/lint/full regression green. (PR #523)

---

## 1. 배경 및 목적

### 1.1 문제

RAG 코퍼스가 비어 있다 (`sources=1, source_sections=19, knowledge_sources=0` 직검). 제품 핵심 가치(RA Q&A with citation)가 실현되지 않는다. 그러나 기존 프레이밍("6개 코퍼스 seed")은 **데이터 소싱을 잘못 표현**하고 있었다.

### 1.2 진실 (직검)

지식베이스 데이터 소스는 **3개의 기존 git 저장소**다 (research.md §1.2):

1. **ra-project** (GitHub, 154 md) — RA scheduler, radar, 규제 동향
2. **MD-process** (GitHub, 549 md) — 도메인별 구조화 규제/QMS/SOP 문서
3. **ra-llm-wiki** (Gitea, LAN) — 사내 SOP wiki

"FDA / EU MDR / MFDS / NMPA / PMDA / SOP"는 별도 repo가 아니라 **검색·분류 도메인**이다 (주로 MD-process 내부 디렉토리 구조 + retriever/classifier 라우팅 키). 이들을 "seed 대상"으로 지정하는 것은 데이터 소싱에 대한 잘못된 표현이다.

### 1.3 목적

본 SPEC은 두 가지를 동시에 달성한다:

1. **지식 구축 (Data population)**: 3개 repo를 `knowledge_sources` (또는 Gitea adapter) 로 연동하여 운영 코퍼스를 실제로 채운다. #312 E2E AC 4건을 실DB(pgvector)에서 직검한다 (L-013 방어).
2. **문서 수정 (Documentation revision)**: 단일 진실 원천(`docs/architecture/knowledge-base.md`)을 확립하고, 데이터 소싱 misframing을 정정한다. 검색 도메인 참조는 보존한다.

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- MD-process repo를 knowledge_source로 등록 후 동기화 → 실DB ingest → RAG 인용 검증 (#312 E2E, M1).
- ra-project repo 동기화 (M2).
- ra-llm-wiki Gitea adapter 경로 운영 절차 문서화 (M2, D1-A).
- `docs/architecture/knowledge-base.md` 신규 작성 — 단일 진실 원천 (M0).
- `production-deployment-gap-2026-07-10.md` BLOCK-1 정정 (M0).
- `seed-corpus.ts` / `seed-fda-corpus.ts` 헤더 정정 + test-only 명시 (M0/M3).
- `product.md` KB 프레이밍 정정 (M0).
- stale `OPENAI_API_KEY` heuristic 제거 (M3).
- 게이트: typecheck/lint/full regression/ci:* + 실DB E2E 직검 (M4).

### 2.2 제외 (Exclusions — What NOT to Build)

- **[EXCL-1]** NMPA / PMDA를 별도 seed-target repo로 지정하거나 신규 코퍼스를 생성하지 **않는다**. 이들은 검색 도메인일 뿐이며, repo 내부 콘텐츠로서 이미 존재한다.
- **[EXCL-2]** auth-token 저장 시 암호화 구현을 **포함하지 않는다** (`authTokenEncrypted` 열 이름과 불일치 문제). 기존 메커니즘을 있는 그대로 사용. 별도 SPEC/이슈(REG-395 계열)로 위임.
- **[EXCL-3]** SSRF guard(`isInternalHost`)를 약화하거나 예외를 추가하지 **않는다**. diskstation hostname 우회 현황은 문서화만 한다. LAN Gitea allowlist 도입은 별도 이슈.
- **[EXCL-4]** `syncKnowledgeSource` / `ingestDocuments` 함수 시그니처 변경을 **포함하지 않는다** (비파괴 원칙). config/env 기반 해결 우선.
- **[EXCL-5]** retriever (`lib/ai/retrievers/{fda,eu-mdr}.ts`) 및 classifier (`lib/classification/*`) 수정을 **포함하지 않는다**. 이들은 검색 도메인으로서 CORRECT.
- **[EXCL-6]** 일반 KB 기능(영업/마케팅/인사 지식, Notion/Confluence 대체)을 **포함하지 않는다** (Charter [지양-1]).
- **[EXCL-7]** seed-corpus.ts/seed-fda-corpus.ts 스크립트 자체를 삭제하지 **않는다**. test fixture로 유지, 헤더/의존성만 정정.
- **[EXCL-8]** Gitea wiki adapter(`scripts/ingest-gitea-wiki.ts`)를 knowledge_sources 경로로 마이그레이션하지 **않는다** (D1-A 결정).

---

## 3. 요구사항 (Requirements — EARS)

### 3.1 데이터 소싱 — 3-Repo 연동

**REQ-KB-001** (Event-Driven): 사용자가 knowledge_source 생성 API에 MD-process repo git URL과 branch를 제출**할 때**, 시스템은 해당 repo를 `knowledge_sources` 테이블에 등록**해야 한다 (shall)**.

**REQ-KB-002** (Event-Driven): knowledge_source의 동기화가 트리거**될 때**, 시스템은 `syncKnowledgeSource` 를 호출하여 git clone → extract → classify → chunk → gx10 embed → source_sections upsert 파이프라인을 실행**해야 한다 (shall)**.

**REQ-KB-003** (Event-Driven): MD-process repo 동기화가 성공**할 때**, 시스템은 `syncStatus` 를 `synced`로, `lastSyncedAt`을 현재 시각으로 갱신하고 `corpus_sync_runs` 행을 `synced` 상태로 기록**해야 한다 (shall)**.

**REQ-KB-004** (Unwanted): 동기화 중 어느 시점에서 실패가 발생**하면**, 시스템은 `syncStatus`를 `failed`로 갱신하고 `knowledge_source.synced` audit 행을 `meta.status='failed'` 와 함께 동일 트랜잭션에 기록**해야 한다 (shall)**. (#312 AC-3, Part 11 §11.10(e))

**REQ-KB-005** (Event-Driven): 동일 knowledge_source에 대해 re-sync가 트리거**될 때**, 시스템은 기존 chunk들에 대해 `applyOutdateOperations`(supersession)을 적용**해야 한다 (shall)**. (#312 AC-4)

**REQ-KB-006** (Event-Driven): RAG 검색 쿼리가 MD-process에서 ingest되고 **승인된(approvalStatus='approved')** 도메인(예: FDA 510(k), EU MDR)을 포함**할 때**, 시스템은 해당 repo에서 유래한 source 인용을 검색 결과에 반환**해야 한다 (shall)**. (#312 AC-2, Charter [지양-2]; 승인 전제 REQ-KB-009)

**REQ-KB-009** (Event-Driven): knowledge_source 동기화로 ingest된 source 행들이 `approvalStatus='pending_review'`(sync.ts:543)로 생성**될 때**, E2E 검증은 RA-owner/source-governance 승인 절차(`POST /api/source-governance/approve`, REQ-SOURCE-GOV-015)로 해당 source들을 `approved`로 전환**해야 한다 (shall)**. `composeRetrievalGates`(lib/source-governance/retrieval-gate.ts)가 `approvalStatus !== 'approved'`를 검색에서 영구 제외하므로, **승인 없이는 AC-2(RAG 인용) 달성이 불가**하다. 이는 source-governance 설계(미검증 콘텐츠 Q&A 차단, Charter [지양-2])이며 본 SPEC은 게이트를 우회하지 않는다 (직검 정정 — 기존 "별도 검토 위임"은 결함이었음).

**REQ-KB-007** (Event-Driven): ra-project repo가 knowledge_source로 등록·동기화**될 때**, 시스템은 MD-process와 동일한 파이프라인으로 ingest**해야 한다 (shall)**.

**REQ-KB-008** (State-Driven): ra-llm-wiki(Gitea) ingest를 운영자가 요청**하는 동안**, 시스템은 기존 `scripts/ingest-gitea-wiki.ts` GraphQL adapter 경로(`GITEA_TOKEN` + url-guard)를 통해 ingest**해야 한다 (shall)** — knowledge_sources git-clone 경로가 아님. (D1-A)

### 3.2 문서 — 단일 진실 원천

**REQ-KB-010** (Ubiquitous): 시스템 문서는 "지식베이스 = 3개 git repo (ra-project, MD-process, ra-llm-wiki)"를 단일 진실 원천으로 `docs/architecture/knowledge-base.md`에 명시**해야 한다 (shall)**.

**REQ-KB-011** (Ubiquitous): `docs/architecture/knowledge-base.md`는 데이터 소싱(3 repo → knowledge_sources)과 검색 도메인(FDA/EU MDR/MFDS/NMPA/PMDA/SOP → retrieval/classification)의 구분을 명시**해야 한다 (shall)**.

**REQ-KB-012** (Ubiquitous): `docs/proposals/production-deployment-gap-2026-07-10.md` BLOCK-1은 "6개 코퍼스 seed" 프레이밍을 "3개 git repo 연동"으로 정정**해야 한다 (shall)**.

**REQ-KB-013** (Ubiquitous): `scripts/seed-corpus.ts`와 `scripts/seed-fda-corpus.ts` 헤더는 test fixture 전용임을 명시하고, 운영 코퍼스는 `knowledge-base.md` 에 기술된 git 연동 경로로만 구축함을 안내**해야 한다 (shall)**.

**REQ-KB-014** (Ubiquitous): `.moai/project/product.md`의 KB 관련 행(L63, L90)은 데이터 소싱(3 repo)과 검색 도메인(FDA/EU MDR/...)을 분리하여 기술**해야 한다 (shall)**.

### 3.3 임베딩 — gx10 단일

**REQ-KB-020** (Ubiquitous): 모든 운영 ingestion 경로는 gx10 Ollama qwen3-embedding (1536-dim MRL) 을 사용**해야 한다 (shall)**. OpenAI runtime dependency는 존재하지 않는다.

**REQ-KB-021** (Unwanted): `scripts/seed-corpus.ts` 에서 운영 ingestion이 OpenAI API key를 필요로 한다는 stale heuristic(헤더의 `Requires: OPENAI_API_KEY` 등)이 발견**되면**, 이를 gx10 embed 경로 안내로 대체**해야 한다 (shall)**.

**REQ-KB-022** (Unwanted): 임베딩 입력에 URL이 포함**되면**, 시스템은 이를 PII로 간주하여 차단해**서는 안 된다 (shall not)** — 임베딩은 gx10 온프레미스(LAN)로 전송되어 외부 유출 위험이 없으며(#318), 규제 source 문서는 URL을 필연적으로 포함한다. 단, 실제 PII(SSN/email/phone/card)는 계속 차단**해야 한다 (shall)**. (`lib/ingest/embed.ts` PII_GUARD_PATTERNS, `tests/unit/ingest/embed.test.ts` 재현 테스트)

### 3.4 검증 — 실DB E2E (L-013 방어)

**REQ-KB-030** (Event-Driven): M1 검증이 완료**될 때**, 시스템은 실DB(pgvector)에서 `sources`/`source_sections` 행 수가 증가했음을 직검(SELECT COUNT)으로 확인**해야 한다 (shall)**.

**REQ-KB-031** (Event-Driven): M1 검증이 완료**될 때**, 시스템은 실제 RAG 쿼리 응답에 MD-process 출처 인용이 포함됨을 런타임 증거로 확인**해야 한다 (shall)**.

**REQ-KB-032** (Unwanted): mock 기반 단위 테스트만으로 본 SPEC의 완료를 선언**하려 하면**, 이는 기각**해야 한다 (shall)** — 실DB E2E 직검이 필수다 (L-013).

---

## 4. 비기능 요구사항 (NFR)

### 보안

**NFR-KB-SEC-001**: `cloneRepo` 는 `execFile`(argument array, shell=false) + `GIT_REF_PATTERN` branch 검증을 유지**해야 한다 (shall)** — RCE 방어 (sync.ts L165-204).

**NFR-KB-SEC-002**: `authTokenEncrypted` 열 이름과 달리 평문 저장되는 현황을 인지하고, 본 SPEC은 기존 메커니즘을 비파괴로 사용한다. 저장 시 암호화는 **별도 SPEC/이슈(REG-395 계열)**로 위임한다. 본 SPEC M1 검증 시 평문 저장 여부를 직검하여 기록한다.

**NFR-KB-SEC-003**: `isInternalHost` SSRF guard를 약화하지 않는다. diskstation hostname이 IP regex를 우회하는 현황을 `knowledge-base.md`에 문서화한다. LAN Gitea allowlist 도입(`KB_INTERNAL_HOSTS_ALLOWLIST`)은 별도 이슈로 위험한다.

**NFR-KB-SEC-004**: ra-llm-wiki adapter 경로는 기존 hardening(`assertGiteaUrlAllowed` + `sanitizeGiteaErrorBody` + `withRetry`)을 유지한다.

### 감사 (Audit — 21 CFR Part 11)

**NFR-KB-AUD-001**: 모든 동기화(성공/실패)는 `writeAudit`(`knowledge_source.synced`, resource_type=`knowledgeSource`) 로 기록**되어야 한다 (shall)** — Part 11 §11.10(e). 성공/실패 UPDATE와 audit 행은 동일 `db.transaction` 내 원자적 기록(sync.ts L90-148).

**NFR-KB-AUD-002**: corpus_sync_runs 테이블에 repo 단위 동기화 실행이 기록**되어야 한다 (shall)** — status `pending → synced | failed`, chunksAdded/chunksOutdated 메타 포함.

### 성능

**NFR-KB-PERF-001**: MD-process(549 md) 단일 repo 동기화 시 MAX_FILES=500 cap 내에서 완료되어야 한다. 549 > 500이므로 **첫 동기화에서 최대 500개 파일만 ingest**되며, 이 현황을 `knowledge-base.md`에 문서화한다. 549 전체 ingest가 필요한 경우 MAX_FILES 조정은 별도 검토(본 SPEC 범위 외).

**NFR-KB-PERF-002**: 동기화 중 하나의 파일 실패가 전체 repo 동기화를 실패시키지 않아야 한다 (per-file try/catch, sync.ts L318-326).

### 추적성

**NFR-KB-TRC-001**: 모든 커밋은 `SPEC-REGULA-CORPUS-SEED-001` 을 참조하고, 관련 이슈 #312를 연결한다.

---

## 5. 검색 도메인 보존 선언 (Jurisdiction-as-Retrieval-Domain Clarification)

본 SPEC은 다음을 명시적으로 선언한다:

> **FDA / EU MDR / MFDS / NMPA / PMDA / ISO13485 / SOP** 는 Regula의 **검색·분류 도메인(retrieval/classification domain)**이다. 이들은 `lib/ai/retrievers/*`, `lib/classification/*`, `lib/ingest/doc-classifier.ts`, `lib/ingest/chunkers/*` 에서 라우팅 키로 사용되며, **수정 대상이 아니다.**
>
> 데이터 소싱은 오직 3개 git repo(REQ-KB-001 ~ 008)로만 이루어진다. "6개 코퍼스 seed" 프레이밍은 데이터 소싱에 대한 잘못된 표현이며 본 SPEC이 정정한다(REQ-KB-010 ~ 014).

이 선언은 `docs/architecture/knowledge-base.md` 의 핵심 섹션으로 포함된다.

---

## 6. 이슈 매핑

| AC (#312) | 본 SPEC REQ | Milestone |
|-----------|-------------|-----------|
| 공개 repo 연결 후 sync 성공 → 코퍼스 채워짐 | REQ-KB-001..003, 007, 030 | M1 (MD-process), M2 (ra-project) |
| RAG 검색에서 해당 repo 인용 반환 | REQ-KB-006, 009, 031 | M1 |
| 실패 시 syncStatus='failed' + audit | REQ-KB-004, NFR-KB-AUD-001 | M1 (실패 경로 검증) |
| re-sync 시 supersession | REQ-KB-005 | M1 |

---

## 7. 위험 및 완화

| 위험 | 완화 |
|------|------|
| MD-process 549파일 > MAX_FILES=500 cap | NFR-KB-PERF-001 문서화 + 필요시 별도 검토 |
| auth-token 평문 저장 (NFR-KB-SEC-002) | 본 SPEC 비파괴; 별도 이슈 위임 |
| 실DB E2E 회귀 (L-013 맹점) | REQ-KB-030..032 직검 강제; mock-only 완료 선언 기각 |
| diskstation SSRF 우회 현황 | D1-A(adapter 유지) + NFR-KB-SEC-003 문서화; guard 약화 금지 |

---

## 8. 참조

- research.md (본 디렉토리) — 직검 인프라 인벤토리, design decisions D1-D5
- acceptance.md — AC + Given/When/Then
- tasks.md — Milestone M0-M4
- Issue #312 (E2E driver), #307 (Phase D 완료)
- SPEC-REGULA-DOCINGEST-001, SPEC-LLM-MIGRATION-A, SPEC-REGULA-SOURCE-GOVERNANCE-001
