# Production Deployment Gap Analysis — Regula v0.1 → Production

> 작성일: 2026-07-10 | main `b3d1386` | 목표: MVP 급 → 프로덕션 급 배포

---

## 1. 완료된 핵심 인프라 (✅ 프로덕션 준비)

| 영역 | 상태 | 증거 |
|---|---|---|
| **LLM 백엔드** | ✅ gx10 Ollama 단일 (gpt-oss:120b) | `llm-provider.ts` ollama-ai-provider, Phase B/C #318 완료, Anthropic/OpenAI 키 제거 |
| **임베딩** | ✅ gx10 qwen3-embedding | `embedding-provider.ts` gx10 `/v1` |
| **Audit** | ✅ SHA-256 hash chain + tx 원자성 | SPEC-V3-AUDIT-CHAIN-001, Part 11 §11.10(e) |
| **RLS policy** | ✅ 전 테이블 활성화 (sources/source_sections 포함 #317) | 단, 런타임 enforce 미완료 (아래 BLOCK-3) |
| **Validation** | ✅ IQ/OQ/PQ + signoff | SPEC-REGULA-VALIDATION-001/002 |
| **Observability** | ✅ Sentry/PostHog/Langfuse wiring | 7파일 |
| **배포 인프라** | ✅ T3610 로컬 + Cloudflare Tunnel | `regula.abyz-lab.work` 운영 중 |
| **RBAC** | ✅ 16 role + permission matrix | ci:rbac 게이트 |
| **v0.1 기능** | ✅ Chat/RAG/Inbox/Triage/Impact/Consult/Persona/CER/PCCP/Predicate | SPEC 완료 |

---

## 2. 프로덕션 배포 Blocking Items (우선순위순)

### BLOCK-1: RAG Corpus 비어있음 — ✅ 해소 (2026-07-16, PR #523)

> **해소 (2026-07-16, PR #523 / #517)**: 실행 중 **근본원인이 진단과 달랐음**을 발견. "데이터 연결만 부재"가 아니라 `lib/ingest/embed.ts`의 PII 가드가 **URL을 PII로 간주**해 규제문서 74%(136개 중 101개: URL 87 + email 14)를 임베딩 전 차단하고 있었음(`syncStatus=synced`으로 은폐). 이 URL 가드는 외부 API 임베딩 시절 방어책이었으나 #318 gx10 온프레미스 전환으로 obsolete+치명적이 됨. URL 패턴 제거 후 3-repo ingest 실증(실DB): `source_sections 19 → 2187`(embedded 2168, gx10 qwen3-embedding), `sources 1 → 623`(approved 622). RAG 인용 실검색 PASS("FDA 510(k)" → 510k Summary DB, "EU MDR" → MDR AnnexII Template). SPEC REQ-KB-022 신설.

**최초 현황 (2026-07-10)**: `sources=1, source_sections=19, knowledge_sources=0` (직검 regula-test-db). RAG Q&A가 인용할 데이터 없음 → **제품 핵심 가치 실현 불가**.

> **데이터 소싱 정정 (2026-07-10, `docs/architecture/knowledge-base.md` 참조)**: 지식베이스는 **3개 기존 git 저장소**에서만 소싱된다 — `ra-project`(GitHub, 154 md) · `MD-process`(GitHub, 549 md, FDA/EU MDR/MFDS/ISO13485 도메인 내장) · `ra-llm-wiki`(Gitea, 내부 SOP). 이전 "6개 코퍼스(FDA/EU MDR/MFDS/NMPA/PMDA/SOP) seed" 프레이밍은 데이터 소싱에 대한 오기반 — 해당 관할구는 **검색·분류 도메인**(repo 내부 디렉토리 구조 + retriever/classifier 라우팅 키)이지 별도 seed 소스가 아니다.

**작업**:
1. **3개 repo 연동** (#312): GitHub ra-project/MD-process → `knowledge_sources` git sync(clone → extract → chunk → gx10 embed → pgvector upsert). Gitea ra-llm-wiki → 기존 `ingest-gitea-wiki.ts` adapter.
2. `ingestDocuments` 실구현 완료 (`lib/knowledge-sources/sync.ts:258`, #307 D-2b). ~~**데이터 연결만 부재**~~ → **정정(2026-07-16)**: 데이터 연결 + PII 가드 URL 차단 제거가 선결이었음(PR #523).
3. RAG 인용 검증: ingest 후 RA-owner source-governance 승인(`POST /api/source-governance/approve`) → `composeRetrievalGates` 통과 → 인용 반환.

**SPEC**: `SPEC-REGULA-CORPUS-SEED-001` — 3-repo 연동 + #312 ingestion E2E 검증 + 문서 정정.
**이슈**: #312 (knowledge-sources 공개 repo 연동 E2E). 후속: #412(auth-token 암호화), #413(SSRF allowlist).
**회귀**: 해소됨 (PR #523: PII 가드 URL 제거 + 3-repo 실DB ingest + 승인 + 인용 검증 완료).

### BLOCK-2: 워크플로우 Executor Synthetic Outputs — 🔴 CRITICAL (가짜 출력)

**현황**: 3개 executor가 synthetic outputs 반환:
- `lib/workflows/submission-drafter/executor.ts` — 510(k) submission drafting
- `lib/workflows/audit-response/executor.ts` — 감사 대응
- `lib/workflows/indication-impact/executor.ts` — 적응증 영향

`@MX:TODO: Beta scaffold — step returns synthetic outputs. Replace with real LLM calls.` 사용자에게 **가짜 결과** 제공 중.

**작업**: 각 executor의 `executeStep`을 gx10 Ollama LLM 호출로 전환 (llm-provider `streamText` / `generateText` 사용). structured output (Zod) 검증.

**SPEC**: `SPEC-REGULA-WORKFLOWS-LLM-002` (#39, draft 상태).
**회귀**: 중간 (executor 시그니처 불변, 내부 로직만).

### BLOCK-3: RLS 런타임 미enforce — 🟡 HIGH (보안)

**현황**: `DATABASE_URL=postgresql://postgres:...@localhost:5432/regula_test` (superuser). RLS policy는 전 테이블 활성화되었으나 **superuser는 RLS bypass** → 런타임에 org-isolation이 enforce되지 않음.

**작업**: 운영 DB `DATABASE_URL`을 `regula_app` (NOBYPASSRLS) role으로 전환. migration 0085가 role 생성 (password placeholder → 실제 설정).

**SPEC**: ops runbook (코드 변경 아님, 환경 설정). `docs/ops/rls-enforce-runbook.md` 작성 권장.
**회귀**: 낮음 (설정 변경). 단, 전환 시 기존 쿼리가 RLS policy에 맞는지 검증 필요.

### BLOCK-4: Coverage 64% → 85% — 🟡 MEDIUM (테스트 품질)

**현황**: All files 64% (ratchet floor 60/70 유지 중). 85% target.

**작업**: #402 Priority 1-3 (순수 파일 → route → 복잡 db/LLM). 약 15-20 추가 PR.

**SPEC**: #402 (진행 중).
**회귀**: 낮음 (테스트 추가만).

### BLOCK-5: E2E 실시나리오 + QA Gate — 🟡 MEDIUM (검증)

**현황**: Playwright E2E가 기본 시나리오만. 프로덕션급 사용자 여정(Q&A → 인용 → export · 워크플로우 → signoff · impact wizard) 실시나리오 부족.

**작업**: #202 (Frontend QA Hybrid RA E2E). Playwright 시나리오 확장 + 스크린샷/문서 최신화.

---

## 3. 프로덕션 배포 순서 (새 세션 일괄 구현)

```
Phase 1 (BLOCK-1): RAG corpus seed → Q&A 핵심 가치 실현
Phase 2 (BLOCK-2): Workflow executor LLM 전환 → 가짜 출력 제거
Phase 3 (BLOCK-3): RLS enforce (regula_app 전환) → 보안
Phase 4 (BLOCK-4): coverage 85% ratchet-up → 테스트 품질
Phase 5 (BLOCK-5): E2E 실시나리오 → 프로덕션 검증
```

각 Phase는 별도 SPEC + plan → run → sync → PR 사이클.

---

## 4. Charter 정체성 재확인 (범위 통제)

Regula = **인허가 전사 Q&A 셀프서비스 + RA 담당자 워크벤치** (6-8명 내부).
- [지양-1] 일반 기업 KB ❌ · [지양-2] 가짜 신뢰 ❌ · [지양-3] QMS ❌ · [지양-4] AI 규제 판단 ❌ · [지양-5] SaaS 외판 ❌
- Expert Review Gate (HARD) · Draft watermark · citation 강제 · Article 61(4) disclaimer

프로덕션 배포 = 위 blocking items 해소 + Charter 준수. 로드맵(#36/#39/#40 등)은 프로덕션 이후 가치 확장.

---

Version: 1.0.0
Author: orchestrator (직검 기반, L-013)
Refs: #312, #39, #317, #402, #202, Charter
