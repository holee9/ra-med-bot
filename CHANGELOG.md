# Changelog

모든 주목할 만한 변경 사항을 이 파일에 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/)를 따르고,
이 프로젝트는 [Semantic Versioning](https://semver.org/)을 준수합니다.

---

## [Unreleased] — Wave 5 (2026-06-20~21)

> **Wave 5 규제 준수 축 완성**: Issue #88 전자서명(PR #204), Issue #87 Export Hub(PR #203), Issue #92 외부 감사관 뷰(PR #206)가 main에 머지되었습니다. 21 CFR Part 11 §11.50/§11.70 전자서명, 다중 포맷 내보내기, 외부 감사관 read-only 페르소나 + 1-클릭 감사 패키지가 통합되었습니다.

### Backend Tech Debt Batch (2026-06-21) — PRs Pending Review

> 프로덕션 준비도 감사에서 발견된 3건의 백엔드 기술 부채 일괄 처리. 각 PR은 `origin/main`에서 독립 분기되어 리뷰 대기 중.

- **Email dispatcher SendGrid wiring** (Issue #214, PR #220): `lib/notifications/dispatcher.ts`의 RESEND stub → SendGrid v3 REST API 실발송. `SENDGRID_API_KEY` 미설정 시 `error`가 아닌 `skipped` 반환 (dev 환경 정상 처리, `radar/notifier-channels/email.ts` 일관성). radar 이메일 채널의 placeholder 주소 → `orgDigestPreferences.recipientEmails` DB 조회 (lazy import). 테스트 +11.
- **Real document rendering** (Issue #215, PR #221): PCCP PDF/DOCX exporter placeholder 제거 — `@react-pdf/renderer`·`docx` 라이브러리(기존 의존성) 기반 실구현. `PccpComponentRecord` 타입 도입, export route의 잘못된 cast 수정, `content_jsonb` 구조화 렌더링 공유 유틸(`lib/pccp/exporters/content-flatten.ts`). Export-Hub pdf-exporter stale `@MX:TODO T-023~T-025` 정리 (컴포넌트는 이미 구현됨). 테스트 +8 (PDF/DOCX magic bytes 검증).
- **Inngest background job infrastructure** (Issue #216, PR #222): `inngest@^4.7.0` 의존성 추가. 클라이언트 싱글톤(`lib/inngest/client.ts`) + 함수 레지스트리(`lib/inngest/functions.ts`) + serve endpoint(`app/api/inngest/route.ts` GET/POST/PUT) 신규. weekly-digest cron(매주 월 00:00 UTC) + docingest upload-processed 6단계 파이프라인을 `inngest.createFunction`으로 실등록. 파이프라인 모듈 dynamic import 전환으로 side-effect 제거. 테스트 +6.

### Added

- **External Auditor Read-Only View** (SPEC-REGULA-AUDITOR-VIEW-001 — Issue #92, PR #206): 외부 감사관(FDA/MFDS/BSI·TÜV) read-only 페르소나 + 1-클릭 감사 패키지.
  - `auditor` RBAC role(hierarchy 0.5) + `audit.read` / `audit.package.generate` 권한(`lib/auth/permissions.ts`, `lib/auth/rbac.ts`)
  - **중앙 쓰기 차단**: `withPermission` 내 `WRITE_METHODS` 블록 → auditor 세션의 모든 POST/PUT/PATCH/DELETE 403 + `audit.denied` 로깅(`lib/auth/with-permission.ts`)
  - 감사 로그 뷰: `GET /api/ra/audit-log` 페이지네이션(50/page) + 날짜/이벤트/actor 필터, `app/(app)/audit/page.tsx` 읽기 전용 UI
  - 1-Click 감사 패키지: `POST /api/ra/audit-package` ZIP 5섹션(audit-log/signed-answers/citations/expert-reviews/compliance-reports), 12개월 60초 이내
  - `lib/audit-package/manifest.ts` SHA-256 per-file manifest + `verifyManifest`, `lib/audit-package/zip.ts` STORE-mode ZIP writer(의존성 없음), `lib/audit-package/builder.ts` in-memory 조립
  - `AuditorWatermark` 컴포넌트, migration `0062_auditor_view_enums.sql`
  - 신규 테스트 46개(6 파일), 총 2,847 passed / 7 skipped

- **21 CFR Part 11 Electronic Signatures** (SPEC-REGULA-ESIG-001 — Issue #88, PR #204): 답변 승인 기록 전자서명 + §11.70 답변 잠금.
  - `answer_signatures` 테이블, `signature.applied` / `signature.revoked` audit actions
  - API: `POST/GET/POST /api/ra/messages/[messageId]/signature{,/revoke}`
  - `lib/signature/hash.ts` canonical JSON SHA-256 record hash, `answer_locked` 403 mutation gate
  - RBAC: `signature.sign` = `ra-lead` 이상 + signature-specific `qa-lead`(일반 gate 상속 안 함), message-level authorization(`conversations`/`projects` 경유 tenant scope)
  - `SignatureManifestation` UI + PDF §11.50 manifestation
  - 문서: `docs/electronic-signatures.md`, `docs/compliance/part-11-extended.md`

- **Export Hub - 내보내기 기능** (SPEC-REGULA-EXPORT-HUB-001 — Issue #87, PR #203): Wave 5 핵심 기능. 4가지 포맷(Markdown, DOCX, PDF, Email) 지원 내보내기 시스템. Export 허브 UI 컴포넌트 + BaseExporter 추상 클래스 + 포맷별 Exporter 구현.
  - `lib/export/types.ts`: ExportFormat enum, ExportResult/ExportOptions 인터페이스, ExportErrorCode 정의
  - `lib/export/base-exporter.ts`: BaseExporter 추상 클래스 (공통 유틸리: validateOptions, createSuccessResult, createErrorResult)
  - `lib/export/audit-logger.ts`: export 감사 로깅 헬퍼 (logExport, getExportAction)
  - `migrations/0043_export_audit_actions.sql`: audit_action enum에 artifact_exported_* 액션 추가
  - `lib/export/exporters/markdown-exporter.ts`: Markdown 포맷 Exporter (REQ-EXP-002, REQ-EXP-003)
  - `lib/export/exporters/docx-exporter.ts`: DOCX 포맷 Exporter (docx ^9.7.1 라이브러리, Word 스타일, 인용 하이퍼링크)
  - `lib/export/exporters/pdf-exporter.tsx`: PDF 포맷 Exporter (@react-pdf/renderer ^4.5.1, A4 페이지, Regula 브랜딩, 페이지 번호)
  - `lib/export/exporters/email-exporter.ts`: Email 포맷 Exporter (mailto 링크 생성, 제목/본문 포맷팅)
  - `lib/export/export-hub.ts`: Exporter 중앙 등록 및 포맷별 팩토리
  - `components/export/ExportHub.tsx`: 메인 내보내기 UI 컴포넌트 (포맷 선택 dropdown, 상태 관리)
  - `components/export/ExportButton.tsx`: 내보내기 트리거 버튼 (FileText 아이콘)
  - `components/export/FormatOptions.tsx`: 포맷 옵션 메뉴 (DOCX/PDF/Markdown/Email)
  - `components/export/useExportState.ts`: 내보내기 상태 관리 훅 (idle → loading → success/error)
  - `components/chat/AnswerBlock.tsx`: ExportButton 통합 (답변 내보내기)
  - `components/chat/Checklist.tsx`: ExportButton 통합 (체크리스트 내보내기)
  - `components/chat/ComparisonTable.tsx`: ExportButton 통합 (비교표 내보내기)
  - `tests/e2e/export-hub.spec.ts`: E2E 테스트 24개 (모든 포맷 내보내기 플로우, 감사 로깅 검증)
  - `tests/e2e/fixtures/export-fixtures.ts`: E2E 테스트 픽스처 (FDA 21 CFR, EU MDR 샘플 데이터)
  - `app/(app)/export/page.tsx`: 내보내기 기능 문서 페이지 (한국어)
  - **@MX 태그 추가**: lib/export/**/*.ts, components/export/**/*.tsx, components/chat/**/*.tsx 내보내기 함수에 MX:NOTE/MX:ANCHOR/MX:SPEC 태그 추가

### Fixed

- **E2E 테스트 환경 설정**: Playwright config에 jsdom environment 설정 추가
- **타입 커버리지**: 모든 export 모듈 95%+ 커버리지 달성
- **감사 로그 통합**: 모든 내보내기 작업이 audit_logs에 기록됨 (21 CFR Part 11 준수)

### Technical Details

- **테스트 커버리지**: 128개 테스트 통과 (lib/export: 48개, components/export: 32개, E2E: 24개, 기타: 24개)
- **의존성**: docx ^9.7.1, @react-pdf/renderer ^4.5.1, react-markdown ^9.0.1
- **감사 로그**: artifact_exported, artifact_exported_docx, artifact_exported_pdf, artifact_exported_markdown, artifact_exported_email 액션 추가
- **TRUST 5 준수**: Tested (95%+), Readable (영어 주석 + MX 태그), Unified (포맷팅 일관), Secured (입력 검증), Trackable (커밋 메시지에 SPEC 참조)

---

## [Unreleased] — Wave 3 (2026-06-04 sync)

### Added

- **FDA 510(k) Predicate 검색 엔진** (SPEC-REGULA-PREDICATE-001 — Issue #22): Wave 3 핵심 기능. openFDA REST API 기반 3-tier 캐스케이드 검색(device_name → product_code → panel) + Vectorize 재순위화, 5-dimension Claude Haiku LLM 비교표 빌더, Cloudflare KV 캐시(24h TTL).
  - `lib/predicate/types.ts`: `PredicateCandidate`, `PredicateComparison`, `ComparisonDimension` Zod 스키마
  - `lib/predicate/openfda-client.ts`: KV 토큰 버킷(240/1000 req/min) + 지수 백오프 + 페이지네이션
  - `lib/predicate/cache.ts`: Cloudflare KV 캐시 (24h TTL, md5 키, 50건 상한)
  - `lib/predicate/cascade-search.ts`: 3-tier 캐스케이드 + Vectorize 재순위화
  - `lib/predicate/comparison-builder.ts`: 5-dimension 비교표 빌더 (Claude Haiku 보조)
  - `app/api/ra/predicate/search/route.ts`: POST 검색 — RBAC + KV 캐시 + 감사 로그
  - `app/api/ra/predicate/comparison/route.ts`: POST 생성 + GET 이력 조회
  - `app/api/ra/predicate/comparison/[id]/approve/route.ts`: PUT 셀 승인
  - `app/api/ra/predicate/export/route.ts`: PDF(`@react-pdf/renderer`) + DOCX(`docx`) 내보내기
  - `app/api/admin/predicate/cache/clear/route.ts`: 개발 전용 캐시 초기화
  - `components/predicate/CandidateCard.tsx`, `ComparisonTable.tsx`, `SubjectDeviceForm.tsx`: UI 컴포넌트 3종
  - `app/(app)/predicate/`: search / compare / history 페이지 3종
  - `lib/auth/predicate-permissions.ts`: RBAC 헬퍼 (`canSearchPredicates`, `canManageComparisons` 등)
  - `lib/db/schema.ts`: `workflow_type` ENUM에 `predicate_comparison` 추가
  - `lib/audit.ts`: `predicate_search`, `predicate_comparison_generated`, `predicate_export_requested` 감사 액션 추가
  - `migrations/0029-0032`: ENUM + 인덱스 + 감사 액션 마이그레이션 4건
- **감사 로그 관리 UI** (`app/admin/audit-logs/page.tsx`): 관리자용 감사 로그 테이블 페이지 신설. `data-testid="audit-log-table"` 포함.
- **감사 로그 API** (`app/api/audit-logs/route.ts`): `GET /api/audit-logs` 엔드포인트 신설. `auditLogs.view` 권한 검증, limit/offset 페이징.
- **ExpertReviewCallout 신뢰도 점수 표시** (`components/expert-review/ExpertReviewCallout.tsx`): `score` prop 추가 — 신뢰도 백분율(`data-testid="confidence-score"`) 표시.
- **로컬 문서 시드 스크립트** (`scripts/seed-local-docs.ts`): 내부 SOP 문서를 pgvector에 직접 시드하는 스크립트 신설.

### Fixed

- **E2E Wave 3-5 사전 조건 수정**: 6개 실패 테스트 중 5개 수정 완료 (48 pass, 5 skip, 1 fail).
  - `components/chat/SourceCard.tsx`: `data-testid="citation-source-title"`, `data-testid="citation-corpus"` 추가 + DocViewer 연결 클릭 핸들러.
  - `hooks/useDocViewer.ts`: `useState` → Zustand 전역 스토어로 전환 — SourceCard·DocViewer 간 상태 공유 해결.
  - `middleware.ts`: 미인증 `/api/*` 요청에 307 리다이렉트 대신 401 JSON 응답 반환.
  - `app/api/ra/consult/route.ts`: E2E_TEST_MODE 시 `chat.query` 감사 로그 기록 추가.
  - `lib/db/schema.ts`, `lib/audit.ts`: `audit_action` enum에 `'chat.query'` 추가.
  - `migrations/0026_chat_query_audit_action.sql`: `ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'chat.query'`.
  - **주의**: `tests/e2e/audit-log.spec.ts:63` (미인증 401 확인) — Playwright 전역 storageState 설계 모순으로 영구 SKIP 상태 유지.
- **프로덕션 빌드 블로커 3개 수정** (`fix/build`): 빌드 오류 해결.
- **FDA corpus 시드 스크립트 FTS-only 모드 지원** (`scripts/seed-fda-corpus.ts`).
- **LocaleToggle ARIA 역할 수정** (`fix/a11y`): `listbox` → `menu/menuitem` 패턴.

### Security

- **Predicate 비교 셀 승인 IDOR 수정** (`app/api/ra/predicate/comparison/[id]/approve/route.ts`): 소유권 검사를 통해 타 사용자의 비교 셀을 승인하는 IDOR 취약점 차단. 요청자 `userId`와 비교 생성자를 대조하여 권한 검증.

### Refactored

- **AnswerBlock ExpertReviewCallout 통합** (`components/chat/AnswerBlock.tsx`): `expertReviewRequired` + `conversationId` + `messageId` 조건 시 `ExpertReviewCallout` 컴포넌트 렌더링, 미충족 시 기존 `Callout` fallback.
- **권한 테이블 확장** (`lib/auth/permissions.ts`): `auditLogs.view` 권한 추가 (`minRole: 'ra-lead'`).

### Fixed

- **RAG 파이프라인 E2E 동작 복구** (PR #117 — Issue #116): pgvector hybrid search + FTS fallback + internal SOPs retriever E2E 복구.
  - `lib/ai/retrievers/hybrid-search.ts`: OpenAI embedding 오류 발생 시 FTS-only fallback 추가, `websearch_to_tsquery`로 재작성
  - `lib/ai/retrievers/internal-sops.ts`: `ss.org_id` → `s.organization_id` 컬럼 참조 수정, FTS-only fallback 추가
  - `lib/ai/consult.ts`: `llmFailed` flag 시 0 citations → 8 citations 정상 반환 (topChunks emit 복구)
  - `lib/ai/query-rewrite.ts`: `510k` 약어 → `510(k) premarket notification` 확장
- **LLM 공급자 추상화** (PR #117 — Issue #116): 환경 변수 기반 LLM 스위칭 (`ollama | openai | anthropic`) 도입.
  - `lib/ai/llm-provider.ts` 신설: `getLlmModel()` / `getLlmFastModel()` 팩토리 함수
  - `lib/ai/intent.ts`, `lib/ai/router.ts`: `getLlmModel()` 사용, LLM 오류 시 `general` intent fallback 추가
  - `lib/ai/consult.ts`: 하드코딩 `claude-sonnet-4-5` → 환경 변수 동적 모델명 참조
  - `.env.example`: `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` 변수 추가
- **Auth.js v5 DrizzleAdapter 호환** (PR #117 — Issue #116): `users` 테이블에 `email_verified` 컬럼 추가.
  - `lib/db/schema.ts`: `emailVerified: timestamp(...)` 컬럼 추가 (DrizzleAdapter `DefaultPostgresUsersTable` 인터페이스 충족)
  - `migrations/0025_users_email_verified.sql`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ`
  - TypeScript TS2322 오류 해결: `lib/auth.ts` DrizzleAdapter 타입 정합성 확보
- **LLM 오류 타입 처리** (PR #117 — Issue #116): `unknown` 타입 llmErr → `logger.warn` meta 객체 래핑으로 타입 안전성 확보.
- Align Deploy workflow jobs with Node.js 22 for current Wrangler compatibility.
- Skip Cloudflare staging deploy and staging smoke with an explicit notice when staging secrets are absent.
- DEPLOY-001 review follow-up: install Wrangler before Cloudflare staging deploy.
- Pass the Vercel preview deployment URL into post-deploy smoke instead of falling back to localhost.
- Fix `scripts/post-deploy-smoke.sh` parsing and require explicit `BASE_URL`.

### Refactored

- **LLM 공급자 추상화 리팩토링** (PR #117 — Issue #116): Anthropic 하드코딩 제거, Ollama(로컬 GX10) 기본값 + OAuth 구독형 확장 구조 도입. `getLlmModel()` / `getLlmFastModel()` 중앙 팩토리로 전체 AI 파이프라인 통합.

### Style

- **Biome import sort** (PR #117): 18개 파일 import 정렬 자동 수정 (기능 변경 없음).

---

## [1.0.0-rc] — 2026-05-06

RC1 릴리즈 후보 — 내부 RA 운영체계 범위 전체 포함.

### RC1 트랙 완료 항목

**SPEC-REGULA-RELEASE-HARDENING-001 (PR #102 — Issue #33)**
- Dashboard·Knowledge·Console·TODO 페이지 Beta 라벨 및 production hardening
- runtime `console.*` → structured logger 교체 (전체 경로)
- Playwright E2E globalSetup 인증 + 7-spec 활성화
- Feature flags 통합 + citation E2E 준비

**SPEC-REGULA-QUALITY-001 (PR #103 — Issue #34)**
- Corpus 시드 스크립트 + FDA 특화 픽스처 (101행 샘플 데이터)
- promptfoo eval 파이프라인 (threshold 80%, YAML config)
- Vectorize → pgvector hybrid fallback (`isVectorizeAvailable()`)
- DocIngest E2E 파이프라인 (Extract → Chunk → Embed → Insert + PII filter)
- CSP nonce + HSTS + X-Frame-Options:DENY 보안 헤더 미들웨어
- Admin RBAC 커버리지 검증 스크립트 + gap detection
- 로컬 Bootstrap 자동화 스크립트 + DEVELOPMENT.md 5-step 가이드

**SPEC-REGULA-E2EFIX-001 (PR #106 — Issue #97)**
- E2E 7-spec 전체 활성화 (auth.setup.ts globalSetup 패턴)
- env-guard: CI staging 조건부 실행 + 로컬/CI 환경 분리

**SPEC-REGULA-DEPLOY-001 (PR #107 — Issue #105)**
- `.github/workflows/deploy.yml` 신설 (4 jobs)
- Vercel preview-per-PR + Cloudflare staging (`--env staging` only)
- `production-vercel` 환경 수동 승인 게이트
- post-deploy smoke test 자동 실행

---

## [1.2.0] — 2026-05-06

### Added

#### Phase 8 Quality & Evaluation (SPEC-REGULA-QUALITY-001)

**Group A — Corpus Seed (테스트 데이터 기반):**
- `scripts/seed-corpus.ts` — 범용 코퍼스 시드 스크립트 (5개 카테고리 × 21개 청크 = 101행)
- `scripts/seed-fda-corpus.ts` — FDA 특화 시드 (테스트 fixture)
- `pnpm db:seed:corpus` — 데이터베이스 초기화 커맨드
- `tests/unit/scripts/seed-corpus.test.ts` — 시드 스크립트 단위 테스트

**Group B — Eval Pipeline (평가 체계):**
- `tests/eval/promptfoo.config.yaml` — promptfoo 평가 설정 (threshold 80%, outputPath 구성)
- `tests/unit/eval/promptfoo-config.test.ts` — 평가 config 검증 테스트
- `tests/integration/hybrid-router-fallback.test.ts` — Vectorize fallback 통합 테스트

**Group C — Vectorize Fallback (하이브리드 레트리버):**
- `lib/ai/hybrid-router.ts` — `isVectorizeAvailable()` 함수 + pgvector fallback 로직
- `lib/env.ts` — Vectorize 환경 변수 설정
- Fallback strategy: Vectorize 불가 시 pgvector 사용

**Group D — DocIngest E2E (문서 수집 파이프라인):**
- `app/api/ra/admin/documents/upload/route.ts` — Extract→Chunk→Embed→Insert 파이프라인
- RBAC 검증: Admin 역할 확인
- PII 검증: 민감한 정보 필터링
- `tests/integration/docingest-e2e.test.ts` — E2E 통합 테스트

**Group E — Security Headers (보안 헤더):**
- `middleware.ts` — CSP nonce + HSTS + X-Frame-Options:DENY + X-Content-Type-Options
- `tests/e2e/security-headers.spec.ts` — Playwright E2E 검증
- XSS/clickjacking/MIME-sniffing 완화

**Group F — Admin RBAC (관리자 접근 제어):**
- `scripts/qa/check-rbac.mjs` — Admin 4 라우트 RBAC 검증 + gap detection 로직
- `scripts/qa/rbac-coverage.ts` — RBAC 커버리지 분석
- Admin 전용 경로: `/api/ra/admin/*`

**Group G — Local Bootstrap (로컬 개발 초기화):**
- `scripts/dev-bootstrap.ts` — 개발 환경 자동 초기화 스크립트
- `lib/env.ts` — 개발 placeholder guard (안전한 기본값)
- `DEVELOPMENT.md` — 5-step 로컬 설정 가이드
- `tests/unit/scripts/dev-bootstrap.test.ts` — Bootstrap 테스트
- `tests/unit/env.test.ts` — 환경 변수 검증 테스트

**Supporting Tests & QA:**
- `tests/unit/lib/feature-flags.test.ts` — Feature flag 단위 테스트
- `tests/unit/lib/observability/logger.test.ts` — 로깅 검증
- `tests/integration/audit-immutability.test.ts` — 감사 로그 불변성
- `tests/integration/audit-retention.test.ts` — 7년 보존 정책
- `tests/e2e/citation-click.spec.ts` — Citation 클릭 E2E
- Citation workflow 검증

### Technical Decisions (Phase 8)

1. **Vectorize Fallback 전략** — Vectorize 불가 시 pgvector로 graceful fallback
2. **CSP Nonce 접근법** — Runtime nonce 생성 + 미들웨어 주입으로 XSS 방어
3. **Bootstrap Guard** — 개발 환경에서 placeholder 사용 + 프로덕션에서 실제 값 강제
4. **Admin RBAC 자동화** — 스크립트 기반 gap detection으로 수동 검증 제거
5. **E2E 중심 평가** — Playwright + promptfoo 조합으로 사용자 시나리오 검증

### Compliance (Phase 8)

- ✅ 7/7 Group 전체 구현 (Corpus Seed, Eval, Vectorize, DocIngest, Security, RBAC, Bootstrap)
- ✅ 15개 신규 테스트 파일 (단위 15, 통합 2, E2E 2)
- ✅ OWASP Top 10: CSP nonce, X-Frame-Options, X-Content-Type-Options
- ✅ RBAC 완전 자동화 (Admin 4 라우트 검증)
- ✅ Local Bootstrap: 5-step 가이드 + 환경 guard

---

## [1.1.0] — 2026-05-04

### Added

#### Phase 7 Cloudflare Hybrid 배포 (SPEC-REGULA-CLOUDFLARE-001)

**Cloudflare Workers 이식 (Group A):**
- `wrangler.toml` — Workers 설정: `nodejs_compat`, 4 KV 네임스페이스, 5 R2 버킷, 5 Vectorize 인덱스, 4 큐, 4 크론
- `open-next.config.ts` — `@opennextjs/cloudflare` 어댑터, R2 ISR 캐시
- `middleware-edge.ts` — Edge 호환 미들웨어 (Auth.js v5 세션 검증 + locale 리다이렉트)
- `lib/cloudflare/env.d.ts` — Workers 바인딩 TypeScript 타입 (global declare)
- `types/opennextjs-cloudflare.d.ts` — OpenNext 패키지 타입 선언

**Hybrid RAG 라우터 (Group B):**
- `lib/ai/hybrid-router.ts` — `hybridRetrieve()` 진입점: internal→pgvector 격리, public→Vectorize+fallback
- `BadScopeError` — internal scope에서 AutoRAG 강제 시 throw (REQ-CF-027)
- `HIPAABAAScopeError` — HIPAA BAA 미확인 상태 AutoRAG 접근 시 throw (REQ-CF-082)
- `lib/ai/retrievers/vectorize-fda.ts` + `eu-mdr` + `mfds` + `nmpa` + `pmda` — Vectorize 5종 retriever
- `lib/ai/retrievers/autorag-adapter.ts` — AutoRAG 어댑터, HIPAA BAA 게이팅, Langfuse 래핑

**KV / R2 / Analytics (Group C/D):**
- `lib/auth/kv-session-store.ts` — Auth.js v5 KV Adapter (30일 TTL, dual-write)
- `lib/ratelimit/cloudflare-kv.ts` — 슬라이딩 윈도우 레이트 리미터 (Upstash 대체)
- `lib/storage/r2.ts` — R2 단일 진입점 (put/get/delete/list, 공개 URL 없음)
- `lib/analytics/cloudflare-engine.ts` — Analytics Engine 지연·캐시·리전 메트릭, PII 거부

**Audit Cold Storage (Compliance):**
- `lib/audit/cold-storage.ts` — Neon→R2 Iceberg 아카이빙, SHA-256 체크섬 체인, 멱등성
- `lib/audit/cold-query.ts` — 콜드 조회 (Admin RBAC 검증 + audit-of-audit 기록)
- `migrations/0011_organizations_data_region.sql` — `data_region` 컬럼 (`us|eu|apac`, NOT NULL)

**QA / 규정 준수:**
- `scripts/qa/no-vercel-edge.ts` — `@vercel/edge` / `@vercel/og` 임포트 정적 감지
- `docs/compliance/part-11-extended.md` — 21 CFR Part 11 확장 준수 문서
- `docs/compliance/hipaa-baa-scope.md` — HIPAA BAA 범위 추적 문서 (Pending Item #1)
- `docs/compliance/vectorize-eu-region.md` — Vectorize EU GA 추적 문서 (Pending Item #2)
- `lib/external/fda-estar.ts`, `eu-ectd.ts` — mTLS 플레이스홀더 인터페이스

### Fixed

- `tests/unit/ai/hybrid-router.test.ts` — `vi.mock` 으로 `internal-sops` 동적 임포트 타임아웃 수정
- `lib/ai/hybrid-router.ts` — Sentry globalThis 타입 캐스트 수정 (biome 엄격 모드 대응)
- `lib/cloudflare/env.d.ts` — `global declare` 방식 전환으로 Workers 바인딩 타입 호환성 개선
- 여러 테스트 파일 — 비null 단언 연산자(`!`) 및 `unknown` 중간 캐스트 적용

### Technical Decisions (Phase 7)

1. **internal scope 하드 격리** — `forceAutoRAG=true` + internal scope 조합은 `BadScopeError` throw (REQ-CF-027)
2. **HIPAA BAA 플래그 게이팅** — `HIPAA_BAA_CONFIRMED=false` 기본값, BAA 확인 후 수동 전환 (Pending Item #1)
3. **Vectorize EU GA 플래그** — `VECTORIZE_EU_GA=false` 기본값, GA 발표 후 수동 전환 (Pending Item #2)
4. **R2 Compliance Mode** — `audit-cold` 버킷만 Object Lock 적용 (7년 보존, REQ-CF-042)
5. **동적 임포트 전략** — `retrieveInternal()`이 `import('./retrievers/internal-sops')`를 lazy 로드하여 엣지 번들 크기 절감

### Compliance (Phase 7)

- ✅ 85/85 REQ-CF 구현 (Group A~H)
- ✅ 21 CFR Part 11: R2 Compliance Mode Object Lock + SHA-256 체크섬 체인 + 7년 보존
- ✅ HIPAA BAA 범위 추적 (Pending Item #1 — `HIPAA_BAA_CONFIRMED` 플래그)
- ✅ internal ↔ public corpus 완전 격리 (REQ-CF-027)
- ✅ 전체 테스트: 1,223 passed / 0 failed / 6 skipped

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
