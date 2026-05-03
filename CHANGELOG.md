# Changelog

모든 주목할 만한 변경 사항을 이 파일에 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/)를 따르고,
이 프로젝트는 [Semantic Versioning](https://semver.org/)을 준수합니다.

---

## [Unreleased]

---

## [1.0.0] — 2026-05-03

### Added

#### Phase 6 Quality & Launch (SPEC-REGULA-LAUNCH-001)

**LLM Evaluation Harness (Group A):**
- `tests/eval/promptfoo.config.yaml` — promptfoo 평가 harness (6개 corpus, 55개 시나리오)
- `tests/eval/datasets/` — 6개 dataset YAML: FDA (15), EU MDR (15), MFDS (10), NMPA (5), PMDA (5), 내부 SOP (5)
- `tests/eval/scorers/` — citation-coverage, hallucination, confidence-calibration, expert-review-gating 4종 scorer
- CI: `eval` job (PR 트리거, 30분 타임아웃, `ANTHROPIC_API_KEY_EVAL` secret)

**E2E Testing (Group B):**
- `playwright.config.ts` — chromium/firefox/webkit 3-browser matrix, CI retries:2
- `tests/e2e/` — auth, consultation, citation-click, expert-review, project-switch, i18n, a11y, security-headers 8종 spec
- CI: `e2e` matrix job (webkit `continue-on-error: true`)

**Load Testing (Group C):**
- `tests/load/k6.js` — steady 50VU + spike 100VU, first_token p95<1500ms / full p95<8000ms
- `tests/load/lcp-check.js` — Core Web Vitals LCP p95<2500ms (k6 browser)
- `scripts/run-load.sh` — staging/mock 모드, 타임스탬프 리포트

**Security (Group D):**
- `docs/security/` — OWASP Top 10, threat-model, pentest-plan 문서
- `tests/integration/audit-immutability.test.ts` / `audit-retention.test.ts` — audit_logs 불변성 + 7년 보존 테스트
- `.github/workflows/security.yml` — pnpm audit + gitleaks 비밀 스캔 CI
- `lib/ai/anthropic-client.ts` — Anthropic ZDR (`anthropic-beta: zero-data-retention`)
- `sentry.server.config.ts` — `beforeSend` PII 레덱션 (query, user_id, content, email)

**Deploy (Group E):**
- `vercel.json` — iad1 리전, consult 60s/API 30s maxDuration, X-Frame-Options + HSTS + nosniff
- `app/api/ra/consult/route.ts` — `export const runtime = 'nodejs'` (pgvector Edge 비호환)
- `docs/deployment/` — env-matrix + dns-setup 문서
- `scripts/preflight.sh` — 17단계 통합 품질 게이트 (`--skip-eval`, `--skip-e2e`, `--skip-load`)
- `scripts/post-deploy-smoke.sh` — 배포 후 HTTP/헤더 스모크 테스트

**Documentation (Group F):**
- `docs/architecture.md` — Mermaid 다이어그램 포함 시스템 아키텍처
- `docs/compliance.md` — 21 CFR Part 11 컴플라이언스 (7개 섹션)
- `docs/api-reference.md` — `/api/ra/*` 엔드포인트 레퍼런스 + Zod 스키마
- `docs/runbook.md` — 운영 런북 (배포, 롤백, 인시던트 대응, 모니터링)
- `DEVELOPMENT.md` — Quality Gates, Architecture Overview, Compliance Overview 섹션 추가

### Technical Decisions (Phase 6)

1. **Vercel + Neon** — SPEC 우선 (tech.md의 self-hosted 설정과 충돌 → SPEC 확정)
2. **nodejs runtime for consult** — pgvector Edge runtime 비호환
3. **Anthropic ZDR** — 의료 데이터 무보존 (`anthropic-beta: zero-data-retention`)
4. **RA lead review async** — 데이터셋 초안 완성 후 별도 커밋으로 서명

### Compliance (Phase 6)

- ✅ 48/48 REQ-LAUNCH 구현 (Group A~F)
- ✅ OWASP Top 10 2021 전체 매핑
- ✅ 21 CFR Part 11 audit 불변성 + 7년 보존 테스트
- ✅ Anthropic ZDR + Sentry PII 레덱션
- ✅ Vercel 보안 헤더 (X-Frame-Options DENY, HSTS, nosniff)

---

## [0.4.0] — 2026-05-03

### Added

#### Phase 5 Enterprise (SPEC-REGULA-ENTERPRISE-001)

- Multi-tenant 프로젝트 관리 + RBAC (Owner/Editor/Viewer)
- 4-way observability: Sentry + PostHog + Langfuse + Vercel Analytics
- Breadth: EU MDR, MFDS, NMPA, PMDA corpus retriever 확장
- Structured outputs: comparison, checklist, timeline SSE 이벤트

---

## [0.3.0] — 2026-05-02

### Added

#### Phase 3–4 Structured Outputs + Breadth (SPEC-REGULA-CHAT-001 + SPEC-REGULA-BREADTH-001)

- 구조화 답변: checklist, comparison, timeline, related SSE event types
- 다규제권역 retriever: FDA + EU MDR + MFDS + NMPA + PMDA + 내부 SOP
- i18n: ko/en/zh/ja (next-intl)
- corpus update-monitor cron

---

## [0.2.0] — 2026-05-02

### Added

#### Phase 2 Chat Core (SSE 스트리밍 RAG 파이프라인)

**API Endpoints:**
- `POST /api/ra/consult` — SSE 스트리밍 endpoint, 인증 필수, 30 req/60s rate limit
- `GET /api/ra/sources/[id]` — 출처 조회 API, offset 파라미터 지원

**AI Pipeline:**
- `lib/ai/consult.ts` — RAG 파이프라인 entry point (async generator)
- `lib/ai/intent.ts` — Haiku 3-class 의도 분류기 (regulation-lookup, comparison, general)
- `lib/ai/query-rewrite.ts` — Rule-based 쿼리 재작성 (20+ FDA 약자 확장, Ko-En 혼합)
- `lib/ai/retrievers/hybrid-search.ts` — pgvector cosine + Postgres FTS 하이브리드 (0.6 vec + 0.4 fts)
- `lib/ai/retrievers/fda.ts` — FDA 코퍼스 전용 retriever
- `lib/ai/prompt-templates.ts` — Citation 강제 system prompt (Anthropic cache_control)
- `lib/ai/citation-enforce.ts` — htmlparser2 기반 인용 후처리, 미인용 문장 감지
- `lib/ai/confidence.ts` — 신뢰도 점수 계산 (0.0~1.0)
- `lib/ai/streaming.ts` — SSE 3-phase order validator + encoder
- `lib/ai/persistence.ts` — transactional messages + message_sources + message_blocks insert

**Frontend Components:**
- `components/chat/Composer.tsx` — 텍스트 입력(200px max), 소스 필터 칩, 전송 버튼
- `components/chat/Thinking.tsx` — 실시간 분석 단계 표시 (trace steps with pulsing dots)
- `components/chat/AnswerBlock.tsx` — Meta row + ConfidenceBadge + prose + sources grid
- `components/chat/Citation.tsx` — `<sup class="cite">` inline citation with deep-link
- `components/chat/ConfidenceBadge.tsx` — High/Med/Low 신뢰도 배지
- `components/chat/SourceCard.tsx` — 출처 카드 (org, type pill, title clamp)
- `components/chat/SourcesGrid.tsx` — 240px min card grid layout
- `components/doc/DocViewer.tsx` — Full-screen 출처 모달 (260px nav + content, deep-link scroll)

**Hooks:**
- `hooks/useStreamingAnswer.ts` — SSE 스트리밍 상태 관리 (AbortController, parseSSEBuffer, applyEvent)
- `hooks/useDocViewer.ts` — DocViewer modal 상태 관리

**Types:**
- `types/streaming.ts` — 12 SSE event types (meta, trace, prose_delta, confidence, sources, expert_review_required, done, error, checklist, comparison, timeline, related)
- `types/consult.ts` — ConsultRequest Zod schema

**Scripts & Database:**
- `scripts/seed-fda-corpus.ts` — FDA 코퍼스 seeding (21 CFR Part 807/820/814, 3 sources, ~650 chunks)
- `migrations/0002_chat_indexes.sql` — FTS GIN index on source_sections

**Tests (210 tests, 15 test files):**
- Unit: intent, query-rewrite, confidence, citation-enforce, component snapshots
- Integration: full E2E (4 locales), citation-invariant, audit-trio, streaming order, abort semantics
- All tests passing, TypeScript 0 errors, Biome 0 errors

#### Environment & Configuration

- Added `ANTHROPIC_API_KEY` env var (Anthropic Claude API)
- Added `OPENAI_API_KEY` env var (OpenAI embedding API)
- Added `NEXT_PUBLIC_LLM_MODEL_LABEL` env var (default: claude-sonnet-4-5)
- Updated `lib/env.ts` Zod schema with new API keys
- Updated `.env.example` with new env vars

#### Documentation

- Added Phase 2 Chat Core feature summary to README.md
- Created sync report: `.moai/reports/sync-SPEC-REGULA-CHAT-001-2026-05-02.md`
- Updated SPEC status: draft → completed

### Changed

- `app/(app)/chat/page.tsx` — FOUNDATION placeholder → Composer + AnswerBlock 통합

### Technical Decisions Confirmed (Phase 2)

1. **Vercel AI SDK** — LangChain 대비 ~5.5x 경량, Next.js 15 native
2. **Anthropic Prompt Caching** — 캐시 hit 시 ~90% 비용 절감
3. **Hybrid Retrieval** — pgvector (60%) + FTS (40%) "510(k)" 같은 정확한 키워드 필요
4. **No Reranker Phase 2** — 하이브리드 스코어로 MVP 충분, Phase 5 평가 gate
5. **SSE Transport** — handoff 규정, Vercel edge 호환, CORS 단순
6. **OpenAI Embedding** — text-embedding-3-small, 1536 dim = pgvector column

### Compliance

- ✅ 60/60 REQ-CHAT 구현 (Groups A-G)
- ✅ SPEC-REGULA-FOUNDATION-001 v0.4.0+ 호환
- ✅ 7개 Non-Obvious Constraint 적용 (citation enforcement, 3-phase streaming, expert-review flagging, audit logging, typography, Korean+English, noindex)
- ✅ 3-Action Audit Logging: llm.call, source.access, expert_review.flag
- ✅ Citation 불변식: HTML data-source = DB message_sources.cite_index
- ✅ 21 CFR Part 11 append-only audit_logs 스키마

### Performance

- First token latency: < 1.5s (P95, seed corpus 650 chunks)
- SSE event order: Phase A < B < C (StreamOrderValidator)
- Hybrid search P95: < 400ms (pgvector ivfflat lists=50 tuning)
- Top-K chunks: 8 chunks max (~4K tokens, Sonnet 200K context within budget)

---

## [0.1.0] — 2026-04-22

### Added

#### SPEC-REGULA-FOUNDATION-001 (Phase 1 Infrastructure)

**Database Schema:**
- `conversations` table (id, user_id, project_id, created_at, updated_at)
- `messages` table (id, conversation_id, role, content_prose, meta_json, tokens_in, tokens_out, model, expert_review_required, created_at)
- `message_sources` table (id, message_id, source_id, section_id, cite_index, cite_type)
- `message_blocks` table (id, message_id, block_type, content, metadata)
- `sources` table (id, org_label, type, title, year, url, fts_indexed)
- `source_sections` table (id, source_id, section_num, anchor, text, vector_id)
- `audit_logs` table (append-only, actor_id, action, resource_type, resource_id, conversation_id, meta_json, created_at)
- pgvector extension (1536 dim embeddings)

**API Endpoints:**
- `GET /api/auth/session` — Session validation
- `POST /api/auth/signout` — Logout endpoint

**Authentication:**
- Auth.js v5 configuration (SAML/OIDC SSO)
- Session-based middleware protection

**Environment & Configuration:**
- `.env.example` template with DATABASE_URL, AUTH_SECRET, API keys
- `lib/env.ts` Zod schema validation
- Production environment variable checks

**Type System:**
- Drizzle ORM type definitions
- Zod runtime validation schemas

**Documentation:**
- README.md with architecture, tech stack, setup instructions
- Project philosophy (GitHub Issues + Wiki first, No issue no implementation)

---

[Unreleased]: https://github.com/holee9/ra-med-bot/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/holee9/ra-med-bot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/holee9/ra-med-bot/releases/tag/v0.1.0
