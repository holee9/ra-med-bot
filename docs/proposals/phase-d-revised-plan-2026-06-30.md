# Phase D 개정계획 — 안전 구현/구동 로드맵 (Issue #307)

> **작성일**: 2026-06-30
> **상태**: 승인 대기 (구현 전)
> **근거**: D-2(expert-backend 1차) 결함 직검 + DOCINGEST 재사용 딥리서치
> **목표**: Phase D(설정 지식베이스 연결)를 **안전하게 구현 + 구동 검증까지** 진행

---

## 0. 배경 — 왜 개정인가

Phase D-1(데이터 모델)은 완료. 그러나 D-2(expert-backend 1차 구현)에 **결함이 다수** 발견되어 게이트(typecheck) 실패 + 구동 불가:

| 결함 | 상태 | 영향 |
|---|---|---|
| RCE (sync.ts `exec` 문자열 보간, branch/cloneUrl 사용자 제어) | ✅ 수정 (execFile 인자 배열 + branch/host 검증) | 보안 |
| 테스트 route 시그니처 7곳 (`POST(request, {}, session)` — withPermission wrapper 불일치) | ❌ 미수정 | typecheck 실패 |
| `ingestDocuments` **stub** (TODO no-op) | ❌ 미구현 | **코퍼스 안 채워짐 → RAG 작동 안 함** |

→ 설령 게이트를 통과해도 **git repo 연동해도 코퍼스가 안 채워지므로 사이트가 작동하지 않음** (사용자 핵심 요구 미충족).

---

## 1. 딥리서치 결과 — DOCINGEST 재사용 포인트

실제 ingestion은 **기존 `lib/ingest` 자산 재사용**으로 구현 (중복 구현 금지):

| 단계 | 재사용 함수 | 위치 |
|---|---|---|
| 파일 추출 (PDF/DOCX/TXT/MD) | extract 모듈 | `lib/ingest/extract/` |
| PII redaction | redact | `lib/ingest/pii/redact.ts` |
| 청킹 | `chunk()` | `lib/ingest/chunkers/index.ts:32` |
| 임베딩 | `embedChunks()` | `lib/ingest/embed.ts:78` |
| sources/source_sections upsert | sources 모듈 | `lib/ingest/sources/` |
| 6단계 파이프라인 참조 | `uploadProcessedFn` | `lib/inngest/docingest/upload-processed.ts` |

→ `ingestDocuments`는 이 함수들을 순차 호출로 구현 (clone된 디렉토리 → extract → redact → chunk → embed → upsert). provenance(sourceHost/owner/repo)는 knowledge_sources에서 가져와 sources에 기록.

---

## 2. 개정 로드맵 (안전 구현/구동)

### Step 1 — D-1 먼저 머지 (데이터 모델, 유효)
`knowledge_sources` 테이블 + RLS + audit + schema + permissions. 이미 typecheck 0 + 실DB 적용 완료. **별도 PR로 먼저 머지** (D-2 결함과 분리).

### Step 2 — D-2a: route/테스트 시그니처 fix
- `withPermission` wrapper route 호출 패턴을 기존 통합 테스트(`capa-idor-runtime.test.ts` 등) 참조하여修正
- `knowledge-sources.test.ts` 7곳 `POST(request, {}, session)` → 올바른 wrapper 호출 시그니처로
- typecheck 통과 목표

### Step 3 — D-2b: `ingestDocuments` 실제 구현 (DOCINGEST 재사용)
- clone된 디렉토리 스캔 → extract → redact → `chunk()` → `embedChunks()` → sources/source_sections upsert
- provenance: knowledge_sources.sourceHost/owner/repo → sources에 기록 (RAG 인용 추적)
- lastSyncedAt 갱신 + audit
- **이것이 "구동"의 핵심** — 코퍼스가 채워져야 RAG 작동

### Step 4 — D-2c: 보안 강화 (이미 일부 완료)
- ✅ RCE: `execFile`(인자 배열, shell 미사용) + branch(git ref 검증) + host(SSRF internal 차단)
- 추가: clone 타임아웃(60s), 임시디렉토리 정리(finally), 파일 확장자 필터(.md/.txt/.pdf/.docx), 파일 크기 제한
- Charter 지양-4 유지 (동기화는 데이터 수집, 판단은 RA)

### Step 5 — D-2d: 구동 검증 (구동까지)
- **공개 repo 연동 E2E**: 예) FDA guidance 공개 mirror 또는 전용 테스트 repo
- clone → ingestion → `source_sections` 채움 직검 → RAG Q&A가 해당 코퍼스 **인용**하는지 확인
- 마지막 동기화 날짜 표시 확인
- 실패 시 sync_status='failed' + audit

### Step 6 — D-3: 설정 UI (expert-frontend)
- `app/(app)/settings`에 지식베이스 연결 섹션
- git URL 등록/목록/삭제 + **각 repo별 마지막 동기화 날짜 필수 표시** + 수동 re-sync 버튼
- private repo용 org 토큰(옵션)
- 테마/언어는 Topbar 토글에 일원화 (설정에서 중복 제거)

---

## 3. 현재 D-2 1차 처리 방침 (승인 항목)

- **RCE 수정본(sync.ts)**: 유지 (안전)
- **테스트/ingestion 결함**: Step 2-3에서 fix (D-2 1차를 기반 부분 재구현)
- 또는 D-2 1차 전체 백업 후 Step 2-3 재작성 — 승인 시 결정

---

## 4. 게이트 (각 Step)

- `pnpm typecheck` exit 0
- `pnpm lint` (full biome+lint:hex) exit 0 (L-008)
- `pnpm test` (full) PASS (L-009)
- 실DB migration 직검 (L-010/013)
- **구동 E2E**: 실제 repo 연동 → 코퍼스 → RAG (Step 5)
- next dev 구동 중 build skip (L-012)

---

## 5. 리스크

- **ingestion 성능**: 큰 repo clone+embed는 시간/비용 (OpenAI). 타임아웃 + 배치 + 진행률 필요.
- **RAG 품질**: 채워진 코퍼스가 실제 규제 질문에 인용되는지 Step 5에서 검증.
- **마이그레이션**: 0099는 D-1에서 적용 완료. 추가 스키마 변경 시 신규 migration.

---

## 6. 승인 요청

위 로드맵(**Step 1 D-1 먼지 머지 → Step 2-5 D-2 fix/실제 ingestion/구동 검증 → Step 6 D-3 UI**)으로 진행 승인을 요청합니다.

**승인 시 착수 순서**:
1. D-1 별도 PR 머지 (데이터 모델)
2. D-2a (테스트 fix) → D-2b (실제 ingestion) → D-2c (보안) → D-2d (구동 검증)
3. D-3 (설정 UI)

각 Step별 커밋/게이트/보고.

---

**버전**: 1.0.0
**관련**: Issue #307 · [scope-rationalization 제안서](scope-rationalization-2026-06-28.md) · `lib/ingest` · `lib/knowledge-sources/`
