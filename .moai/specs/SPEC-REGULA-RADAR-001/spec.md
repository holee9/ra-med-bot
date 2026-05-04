---
id: SPEC-REGULA-RADAR-001
title: Regula Phase 10 Regulatory Radar — 3 Crawlers + 3-Tier Classifier + Impact Scoring + Notifier (v2.0)
status: completed
created: 2026-04-22
updated: 2026-05-04
author: manager-spec
phase: 10
skill: regula
version: 2.0.0
priority: Medium
issue_number: 12
revision_history:
  - version: 2.0.0
    date: 2026-05-04
    author: TDD implementation
    notes: |
      v2.0 scope reduction: 11 crawlers → 3 crawlers (FDA Federal Register, EU OJ, MFDS).
      PMDA/NMPA moved to Phase 8 corpus. Batch (cron) instead of real-time.
      40 REQ implemented. Migration: 0018_radar.sql.
      All completion gates passed: 3 crawlers ✅, tier1 ≥95% ✅, impact scoring ✅, E2E notification ✅.
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial Phase 10 draft. 55 REQ-RADAR across 6 groups (A/B/C/D/E/F).
      Group A — 11 crawlers (REQ-RADAR-001 ~ 022, 2 REQ per crawler)
      Group B — Classification pipeline (REQ-RADAR-023 ~ 030)
      Group C — Relevance scoring (REQ-RADAR-031 ~ 037)
      Group D — Notification pipeline (REQ-RADAR-038 ~ 044)
      Group E — DB schema extension (REQ-RADAR-045 ~ 050)
      Group F — UI + ad-hoc search (REQ-RADAR-051 ~ 055)
      Phase 10 is post-launch (after Phase 6 LAUNCH) and depends on a
      shipped Phase 1~6 baseline, plus CLOUDFLARE (Workers + Cron +
      Browser Rendering + R2 + Queues + KV), DOCINGEST (organization_documents
      for product portfolio matching), and WORKFLOWS (Phase 9 draft API).
      Promotes regulatory_updates from manual seed (Phase 4 BREADTH) to
      fully automated 11-source daily pipeline with 3-tier Haiku
      classification and impact scoring anchored to organization product
      portfolio.
related_handoff_sections:
  - "§7.8"
  - "§11.7"
  - "§11.10"
  - "§12"
  - "§16"
  - "§20"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-BREADTH-001 (v0.2.0+)
  - SPEC-REGULA-ENTERPRISE-001
  - SPEC-REGULA-CLOUDFLARE-001 (planned)
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001 (Phase 9)
---

# SPEC-REGULA-RADAR-001 — Regula Phase 10 Regulatory Radar

## 목적 (Purpose)

Regula Phase 10은 handoff §7.8 Regulatory Updates view와 §11.7 `GET /api/ra/updates`를 **수동 seed 기반 피드 → 자동 intelligence 레이어**로 승격하는 post-launch Phase이다. 즉 Phase 4 BREADTH에서 "피드 조회만" 가능했고, Phase 5 ENTERPRISE와 LAUNCH까지도 "Inngest crawler job은 post-launch"로 이관되었던 수집 자동화 영역을 본 Phase가 전담한다.

구체적으로 본 Phase는 세 축을 동시에 전진시킨다:

1. **11개 공식 소스 × 일 1회 crawl**: FDA guidance / Federal Register / recalls / warning letters, EU OJ / NB-MED, MFDS 고시 / 인허가, PMDA 통지, NMPA 공고, ISO/IEC 표준 개정 — Cloudflare Cron + Browser Rendering API 기반 서버리스 수집. robots.txt 엄격 준수 및 유료 ISO/IEC 본문 수집 금지.

2. **3-Tier Haiku 분류 + 조직별 impact scoring**: Tier1 의료기기 관련성(≥95%) → Tier2 device class × product category(≥85%) → Tier3 영향 유형. DOCINGEST의 `organization_documents` 제품 포트폴리오(device class, product category, target markets)와 WORKFLOWS의 진행중 프로젝트(`projects.target_markets[]`, `submission_date`)를 cross-reference하여 impact_score 0~1 산출.

3. **Multi-channel notification**: impact_score ≥ 0.7 → 대시보드 배지 + 이메일 daily digest (opt-in); ≥ 0.9 → 즉시 토스트 + Slack webhook (조직 설정). Alert fatigue 방지를 위해 묶음 디지스트 + 사용자 피드백 기반 weight decay 내장.

본 Phase는 다음 추가 가치를 제공한다:
- **Ad-hoc radar search**: "지난 6개월 FDA guidance 중 소프트웨어 의료기기 관련" 같은 자연어 질의 (BREADTH Chat router에 `radar.search` intent 추가)
- **WORKFLOWS 연동**: /updates 상세에서 "이 업데이트로 작업 초안" 버튼 → Phase 9 `/api/ra/workflows/draft` 호출
- **Admin dashboard**: crawler 상태 모니터링, 수동 실행 (`POST /api/admin/radar/run?crawler=<name>`)

Non-Obvious Constraint 매트릭스상 본 Phase가 직접 건드리는 항목은 **제약 #6 한/영 이중언어 first-class**(원문 수집 다국어 + 번역 파이프라인 + UI 다국어 완비)와 **제약 #4 21 CFR Part 11 audit**(crawler 실행 + 알림 전송 audit 기록, `audit_action` enum 3값 확장: `radar.crawler_run`, `radar.notification`, `radar.search`)이다. 나머지 제약(#1 citation, #2 streaming, #3 expert review, #5 serif, #7 noindex)은 기존 Phase 산출물 재사용으로 상속.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| Crawler framework | `lib/radar/crawlers/_base.ts` (공통 retry + dedup + audit + Zod schema validation), `lib/radar/crawlers/_types.ts` (`RawUpdate`, `CrawlerResult`, `CrawlerContext` 타입) |
| 11 crawlers | `lib/radar/crawlers/fda-guidance.ts`, `fda-federal-register.ts`, `fda-recalls.ts`, `fda-warning-letters.ts`, `eu-oj.ts`, `eu-nbmed.ts`, `mfds-notice.ts`, `mfds-approval.ts`, `pmda-notice.ts`, `nmpa-notice.ts`, `iso-iec.ts` |
| Classification pipeline | `lib/radar/classifier.ts` (tier1 binary relevance, tier2 device class × category, tier3 impact type — Haiku structured output), `lib/radar/classifier-prompts.ts` (few-shot prompts), `lib/radar/classifier-schemas.ts` (Zod schemas for structured output validation) |
| Translation pipeline | `lib/radar/translator.ts` (multilingual → en + ko, Haiku 주 / Google Translate 1차 for zh/ja), `lib/radar/translator-cache.ts` (KV cache wrapper) |
| Relevance scorer | `lib/radar/relevance-scorer.ts` (rule + LLM 2-step scoring), `lib/radar/portfolio-loader.ts` (DOCINGEST `organization_documents` + `projects` 메타 로드 헬퍼) |
| Notifier | `lib/radar/notifier.ts` (threshold gating), `lib/radar/notifier-channels/toast.ts`, `lib/radar/notifier-channels/badge.ts`, `lib/radar/notifier-channels/email.ts` (SendGrid 재사용), `lib/radar/notifier-channels/slack.ts` (조직 webhook URL) |
| Cron + Queue wiring | `workers/radar-cron.ts` (Cloudflare Worker, Cron Trigger), `workers/radar-classify-consumer.ts` (Queue consumer), `workers/radar-score-consumer.ts`, `workers/radar-notify-consumer.ts` |
| DB migration | `migrations/0010_radar.sql` — (1) `regulatory_updates` 확장 8 컬럼, (2) 2 신규 테이블 (`org_update_relevance`, `crawler_runs`), (3) `audit_action` enum `ALTER TYPE ADD VALUE` 3회 (`radar.crawler_run`, `radar.notification`, `radar.search`), (4) 인덱스 |
| Drizzle schema update | `lib/db/schema.ts` — `regulatoryUpdates` 확장, `orgUpdateRelevance` / `crawlerRuns` 신규 테이블 선언 |
| Audit helper extension | `lib/audit.ts`의 `AuditAction` TS union 3값 확장 (FOUNDATION REQ-FND-049 enum inventory v0.5.0 bump 연동) |
| UI — /updates 확장 | `app/(app)/updates/page.tsx` **수정** (Phase 4 스켈레톤 → Phase 10 필터 확장: 영향 점수 / 지역 / 제품군 / 영향 유형), `components/radar/UpdateCard.tsx` **확장** (impact badge, 제품 매칭 chip), `components/radar/ImpactChip.tsx` **신규** (0.7~0.9 amber / ≥ 0.9 danger) |
| UI — /updates/:id 상세 | `app/(app)/updates/[id]/page.tsx` **신규** (원문 뷰 + Sonnet 동적 `impact_analysis_text` 생성 + "작업 초안" 버튼 → WORKFLOWS Phase 9) |
| UI — /admin/radar | `app/(app)/admin/radar/page.tsx` **신규** (조직 관리자 전용, crawler 상태 + 수동 실행 + 실패 alert 리스트) |
| API — `/api/ra/updates` 확장 | `app/api/ra/updates/route.ts` **수정** (필터 파라미터 추가: `impact_min`, `region`, `product_category`, `impact_type`), `app/api/ra/updates/[id]/route.ts` **신규** (상세 + on-demand `impact_analysis_text` 생성), `app/api/ra/updates/[id]/feedback/route.ts` **신규** (사용자 "관심 없음" 피드백 수신) |
| API — `/api/admin/radar/*` | `app/api/admin/radar/run/route.ts` (POST, `crawler` 쿼리 파라미터, ENTERPRISE `withPermission('admin.radar.run')` 래핑), `app/api/admin/radar/runs/route.ts` (GET, crawler_runs 상태 목록), `app/api/admin/radar/health/route.ts` (GET, 공개 헬스체크 — crawler별 last success timestamp만 노출) |
| API — ad-hoc search | `app/api/ra/radar/search/route.ts` **신규** (POST, 자연어 쿼리 → Haiku intent parse → filter → 결과 목록), BREADTH chat router `lib/ai/router.ts` 확장으로 `'radar.search'` intent dispatch |
| TanStack Query hooks | `lib/queries/useUpdates.ts` **확장** (필터 파라미터), `lib/queries/useUpdate.ts` **신규**, `lib/queries/useUpdateImpactAnalysis.ts` **신규** (on-demand Sonnet 생성 streaming), `lib/queries/useCrawlerRuns.ts` **신규** (admin) |
| Zustand state | `stores/radar.ts` **신규** (`radarFilters` persist, `dismissedUpdates[]` 일시 세션) |
| Seeds & fixtures | `scripts/seed-radar-fixtures.ts` (개발 환경 crawler 모킹용 fixture 20건), `__tests__/fixtures/radar/` (소스별 샘플 HTML/JSON) |
| Integration test | `__tests__/radar/classifier.test.ts`, `__tests__/radar/relevance-scorer.test.ts`, `__tests__/radar/notifier.test.ts`, `__tests__/radar/crawlers/*.test.ts` (11개, fixture 기반) |
| LLM eval harness | `eval/radar/tier1-accuracy.promptfoo.yaml`, `eval/radar/tier2-accuracy.promptfoo.yaml` (Phase 6 eval 프레임워크 재사용) |
| Observability | Sentry tag `radar.crawler`, `radar.classifier`, `radar.scorer` + Langfuse trace `radar.pipeline` |

### Out of Scope

다음 항목은 **의도적으로 본 Phase에서 구현하지 않는다**:

| 항목 | 대체 Phase / 해결 방안 | 사유 |
|---|---|---|
| **규제 기관 직접 submission** (FDA ESG, EMA CESP) | Post-launch (별도 SPEC) | Regulatory radar는 **읽기/알림 전용**; submission은 별도 compliance 흐름 |
| **규제 변경의 자동 CAPA 실행** | 영원히 금지 | 인간 결정 필수 — 본 Phase는 "작업 초안 제안"까지만 (WORKFLOWS 연동) |
| **유료 규제 데이터베이스** (PharmaIntelligence, BSI Entropy) | Post-launch 확장 SPEC | 공식 무료 소스 11개로 시작, 필요 시 future SPEC에서 추가 |
| **의료기기 외 규제 영역** (cosmetic, food, drug) | 영원히 out of scope | Regula는 **의료기기 RA** 범위 고수 |
| **Teams / Zoom / Webhook 커스텀** | Post-launch 확장 | Phase 10은 Slack webhook + SendGrid email만 |
| **Onboarding wizard** (impact score threshold 사용자 조정) | Post-launch | Phase 10은 0.7/0.9 고정값 |
| **실시간 push notification** (PWA Push, iOS APNs) | Post-launch | Phase 10은 in-app polling 10s + email + Slack |
| **Cold storage 자동 이관 cron** (R2 cold) | Phase 10 hot만 구현, cold 이관은 Post-launch | 초기 1년은 hot 테이블로 충분, cold 이관 로직은 운영 3개월 후 검토 |
| **ISO/IEC 표준 본문 full-text 수집** | 영원히 금지 | 저작권 (유료 표준); 메타(제목·번호·개정일·URL)만 수집 |
| **NMPA 월 1회 blank day 허용 시 수동 수집 파이프라인** | Post-launch 수동 공지 | Phase 10은 자동 실패 + Sentry alert로 수동 개입 대기 |
| **crawler 실행 시 cost dashboard** | Post-launch | Phase 10은 Sentry span + Langfuse로 비용 추정만 |
| **조직 간 "다른 조직의 notified 업데이트 비교"** | 영원히 금지 | 프라이버시 위반, org-scoped strict 원칙 유지 |
| **사용자당 impact_threshold 커스터마이징** | ENTERPRISE 확장 | Phase 10은 조직 단위 공통 0.7/0.9 |
| **번역 후 법률 감수 (certified translation)** | Post-launch 비용 검토 | 규제 원문 열람은 `source_url`로 위임, 내부 분류 용도만 번역 |

### 영향받지 않는 기존 Phase 산출물 (수정 금지)

본 Phase는 Phase 1~6 산출물을 최소한으로 수정한다:
- `lib/db/schema.ts` — `regulatoryUpdates` 확장 + 2개 신규 테이블 **추가**만 (기존 13 tables 정의 수정 금지)
- `migrations/0000_init.sql`, `migrations/0001_audit_append_only.sql`, `migrations/0004_breadth.sql`, `migrations/0005_enterprise.sql` — 건드리지 않음
- `lib/auth.ts`, `middleware.ts` — Phase 1/5 그대로
- `styles/tokens.css`, `app/globals.css`, `tailwind.config.ts` — 토큰 추가 없음, 기존 amber/danger 재사용
- `app/api/ra/consult/route.ts` (Phase 2 + Phase 4 router 확장) — BREADTH router에 `radar.search` intent **추가 1건**만 허용
- `components/chat/AnswerBlock.tsx` 및 Phase 3 block 컴포넌트 — 재사용만 (radar.search 결과는 기존 `related` block 포맷 재사용)

---

## 기술적 결정 (Technical Decisions)

| # | 결정 | 선택 | 탈락 | 근거 |
|---|---|---|---|---|
| 1 | Crawling 스케줄 | 일 1회 06:00 KST (소스별 15분 offset) | 실시간 streaming | 대부분 공식 소스 일 단위 업데이트; 실시간은 cost/rate-limit 부담 |
| 2 | 동적 JS 페이지 렌더링 | Cloudflare Browser Rendering API | Puppeteer self-host | 서버리스, 운영 부담 감소, CLOUDFLARE SPEC 전제 |
| 3 | 분류 LLM | Claude Haiku (3-tier structured output) | Claude Sonnet / Llama 3.1 | 비용 12x 절감, 정확도 충분 (tier1 95%, tier2 85% 목표 달성 가능) |
| 4 | 영향 점수 임계값 | 0.7 (대시보드/이메일) + 0.9 (토스트/Slack) | 단일 임계값 또는 0.5 | UX 휴리스틱 + 파일럿 3조직 precision 82%/96% 입증 |
| 5 | 원문 보존 기간 | hot DB 1년 + R2 cold 1~7년 (cold 이관 로직은 post-launch) | 영구 DB 저장 | Drizzle 성능 + 스토리지 비용; 21 CFR Part 11 7년은 audit_logs 전담 |
| 6 | 다국어 저장 | 원문 + `raw_content_en` + `raw_content_ko` 3-way | 원문만 or 영어만 | 검색 단일화 (en) + 한국어 UI 우선 (ko), 통일 쿼리 |
| 7 | 번역 파이프라인 분기 | en/ko/ja: Haiku 단독 / zh: Google Translate + Haiku 2-step | 단일 Haiku 또는 단일 Google | NMPA 중국어 전문 용어 정확도 부족 보완 |
| 8 | Queue 아키텍처 | Cloudflare Queues 3단계 (raw → classify → score → notify) | 단일 Worker 순차 | 부하 스파이크 분산 + per-stage retry/DLQ |
| 9 | Tier1 recall keyword fallback | LLM 판단과 무관하게 'recall'/'리콜'/'回收'/'リコール' 매칭 시 강제 relevant=true | LLM 단독 | Recall 미감지는 치명적 false negative — safety net 필수 |
| 10 | impact_analysis 생성 | 사용자 `/updates/:id` 최초 열람 시 Sonnet on-demand + 72h cache | 모든 업데이트 일괄 생성 | 비용 폭발 방지 (일 100~200 업데이트 × Sonnet = 과도) |
| 11 | Alert fatigue 방지 | 동일 source+category 7일 내 3건 초과 시 묶음 디지스트 + 사용자 "관심 없음" 피드백 weight decay 30일 | 알림 개수 hard cap | Precision 유지 + 사용자 통제 보장 |
| 12 | Admin 대시보드 권한 | ENTERPRISE `withPermission('admin.radar.run')` + org admin role | public | 관리자 전용 수동 실행 보호 |
| 13 | ISO/IEC 수집 범위 | **메타만** (제목, 번호, 개정일, URL); 본문 수집 금지 | 본문 full-text | 유료 표준 저작권 회피 |
| 14 | audit_action enum 확장 규모 | 3값 (`radar.crawler_run`, `radar.notification`, `radar.search`) | 값 다수 (crawler별 세분화) | 최소 확장 원칙, 세분화는 meta_json으로 처리 |
| 15 | Cron 경고 시스템 | crawler 3회 연속 실패 → Sentry alert + admin dashboard red badge | 1회 실패 즉시 경보 | 일시 rate-limit 배제, 구조적 장애만 감지 |

---

## EARS 요구사항 (EARS Requirements)

### Group A — Crawlers (REQ-RADAR-001 ~ REQ-RADAR-022)

#### REQ-RADAR-001 (Event-driven) — Crawler framework
**요구사항:** WHEN Cloudflare Cron Trigger fires for a radar crawler slot, THEN the system SHALL invoke `lib/radar/crawlers/_base.ts` `runCrawler(name, fn)` which wraps the crawler function with (1) `crawler_runs` row INSERT on start, (2) `writeAudit({action: 'radar.crawler_run', ...})`, (3) per-record Zod schema validation, (4) `regulatory_updates` UPSERT by `external_id`, (5) `crawler_runs` UPDATE with `completed_at`, `records_added`, `errors_json`, `status` on finish.
**근거:** research.md §5.1 + Non-Obvious Constraint #4 (audit).
**검증 방법:** 단위 테스트: fake crawler fn 3건 returning 2 records → `runCrawler` 호출 → `crawler_runs` 1 row with status='success', records_added=2; `audit_logs` 1 row with action='radar.crawler_run'.

#### REQ-RADAR-002 (Ubiquitous) — Crawler retry policy
**요구사항:** The crawler framework SHALL retry HTTP 429 / 503 with exponential backoff 5min → 15min → 45min (max 3 attempts) before marking `crawler_runs.status = 'rate_limited'`.
**근거:** research.md §5.2.
**검증 방법:** Mock fetch returning 429 3번 → total wait ~65min(테스트는 fake timer) → 최종 `status='rate_limited'`.

#### REQ-RADAR-003 (Event-driven) — FDA guidance crawler
**요구사항:** WHEN `runCrawler('fda-guidance')` is invoked, THEN the system SHALL fetch `https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/guidance-documents-medical-devices-and-radiation-emitting-products` + RSS feed, parse each item as `{external_id, title, published_at, source_url, raw_content, region: 'US', source_crawler: 'fda-guidance'}`, and UPSERT into `regulatory_updates`.
**근거:** research.md §2.1 row 1.
**검증 방법:** Fixture `__tests__/fixtures/radar/fda-guidance.html` 로드 → 5 records parsed → DB 5 rows.

#### REQ-RADAR-004 (Event-driven) — FDA Federal Register crawler
**요구사항:** WHEN `runCrawler('fda-federal-register')` is invoked, THEN the system SHALL call `https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=food-and-drug-administration&conditions[publication_date][gte]={lastRun}` and parse JSON items into `regulatory_updates`.
**근거:** research.md §2.1 row 2.
**검증 방법:** Mock API response → per-item parse → `source_crawler='fda-federal-register'`, `region='US'`.

#### REQ-RADAR-005 (Event-driven) — FDA recalls crawler
**요구사항:** WHEN `runCrawler('fda-recalls')` is invoked, THEN the system SHALL call OpenFDA `https://api.fda.gov/device/recall.json?search=report_date:[{lastRun} TO {today}]&limit=100` and UPSERT with `impact_type_hint = 'recall'`.
**근거:** research.md §2.1 row 3 + 결정 #9 (recall safety net).
**검증 방법:** Fixture JSON → 3 recall records → DB 3 rows with pre-classified impact_type_hint.

#### REQ-RADAR-006 (Event-driven) — FDA warning letters crawler
**요구사항:** WHEN `runCrawler('fda-warning-letters')` is invoked, THEN the system SHALL fetch the warning letters HTML index page and parse each entry's company, issue date, subject, URL into `regulatory_updates` with `impact_type_hint = 'enforcement_action'`.
**근거:** research.md §2.1 row 4.
**검증 방법:** Fixture HTML → 5 letters → DB 5 rows.

#### REQ-RADAR-007 (Event-driven) — EU OJ crawler
**요구사항:** WHEN `runCrawler('eu-oj')` is invoked, THEN the system SHALL call EUR-Lex REST API with `sector=3` (legislation) + MDR/IVDR filters, parse into `regulatory_updates` with `region='EU'` and multi-language `raw_content` (EN + local).
**근거:** research.md §2.1 row 5.
**검증 방법:** Fixture API response → EN + FR + DE variants detected → stored under `raw_content` (EN primary).

#### REQ-RADAR-008 (Event-driven) — EU NB-MED crawler
**요구사항:** WHEN `runCrawler('eu-nbmed')` is invoked, THEN the system SHALL scrape `https://www.team-nb.org/consensus-papers/` via standard fetch (static HTML), parse consensus paper list, and UPSERT with `region='EU'`, `source_crawler='eu-nbmed'`.
**근거:** research.md §2.1 row 6.
**검증 방법:** Fixture HTML → 12 consensus papers → DB rows.

#### REQ-RADAR-009 (Event-driven) — MFDS 고시 crawler (dynamic JS)
**요구사항:** WHEN `runCrawler('mfds-notice')` is invoked, THEN the system SHALL use Cloudflare Browser Rendering API (`env.BROWSER.fetch()`) to load `https://www.mfds.go.kr/brd/m_99`, wait for dynamic JS content, extract notice list, and UPSERT with `region='KR'`, `raw_content` in Korean.
**근거:** research.md §2.2 + 결정 #2.
**검증 방법:** Browser Rendering mock + fixture rendered HTML → 8 notices → DB rows with Korean raw_content.

#### REQ-RADAR-010 (Event-driven) — MFDS 의료기기 인허가 crawler
**요구사항:** WHEN `runCrawler('mfds-approval')` is invoked, THEN the system SHALL use Browser Rendering to access `https://emed.mfds.go.kr`, retrieve the approval announcement list, and UPSERT with `impact_type_hint='informational'`.
**근거:** research.md §2.1 row 8.
**검증 방법:** Fixture → 15 approval rows → DB upsert.

#### REQ-RADAR-011 (Event-driven) — PMDA crawler
**요구사항:** WHEN `runCrawler('pmda-notice')` is invoked, THEN the system SHALL fetch PMDA safety notice pages (`https://www.pmda.go.jp/safety/`), parse Japanese HTML, and UPSERT with `region='JP'`, `raw_content` in Japanese.
**근거:** research.md §2.1 row 9.
**검증 방법:** Fixture → 4 safety notices → DB rows.

#### REQ-RADAR-012 (Event-driven) — NMPA crawler
**요구사항:** WHEN `runCrawler('nmpa-notice')` is invoked, THEN the system SHALL use Browser Rendering + a Cloudflare Worker IP rotation strategy to access `https://www.nmpa.gov.cn/zwfw/sdxx/`, extract 公告 list, and UPSERT with `region='CN'`, `raw_content` in Simplified Chinese. IF geo-block (HTTP 403/451) is detected on 3 consecutive runs, THEN the system SHALL set `crawler_runs.status='geo_blocked'` and emit Sentry alert without failing the overall radar pipeline.
**근거:** research.md §2.2 + §9 NMPA geo-block 대응.
**검증 방법:** Mock 403 × 3 → `status='geo_blocked'` + Sentry event captured (mock transport); 정상 fixture → 10 notices → DB rows.

#### REQ-RADAR-013 (Event-driven) — ISO/IEC 표준 개정 crawler
**요구사항:** WHEN `runCrawler('iso-iec')` is invoked, THEN the system SHALL fetch `https://www.iso.org/news-and-media.rss` + IEC dynamic pages (via Browser Rendering), extract **only metadata** (title, standard number, revision date, URL) and NOT store full standard text (copyright protection).
**근거:** research.md §2.3 + 결정 #13.
**검증 방법:** Fixture RSS + IEC HTML → `raw_content` 필드는 요약 only, 원문 본문 저장 없음 verified (< 500 chars per record).

#### REQ-RADAR-014 (Ubiquitous) — robots.txt 준수
**요구사항:** The system SHALL cache each source's `robots.txt` for 24 hours and SHALL abort a crawler if its target URL is disallowed by the current `robots.txt`. Abort results MUST write `crawler_runs.status='robots_disallowed'`.
**근거:** research.md §2.3.
**검증 방법:** Mock robots.txt with `Disallow: /medical-devices` → FDA guidance crawler → aborts + `status='robots_disallowed'`.

#### REQ-RADAR-015 (Ubiquitous) — User-Agent 설정
**요구사항:** All crawlers SHALL send User-Agent header `Regula-Radar/1.0 (+https://regula.app/crawlers; contact=compliance@regula.app)` with `compliance@regula.app` contact per RFC 9110 §10.1.5 guidance.
**근거:** research.md §9 위험 "차단".
**검증 방법:** Mock fetch capture headers → `User-Agent` contains `Regula-Radar/1.0`.

#### REQ-RADAR-016 (Event-driven) — External ID dedup
**요구사항:** WHEN a crawler parses records, THEN each record SHALL have a deterministic `external_id` derived from source-specific stable IDs (FDA docket ID, Federal Register doc number, OpenFDA recall event ID, EUR-Lex CELEX, MFDS 고시번호, PMDA 통지번호, NMPA 공고번호, ISO/IEC 표준번호). UPSERT SHALL use `ON CONFLICT (external_id) DO UPDATE SET raw_content = EXCLUDED.raw_content, updated_at = now()` to detect content amendments.
**근거:** research.md §5.3.
**검증 방법:** 동일 `external_id` 재수집 × 3 → DB row 1개 + updated_at 최종 시각 일치.

#### REQ-RADAR-017 (Event-driven) — HTML 구조 drift 감지
**요구사항:** WHEN a crawler fails Zod schema validation 3 consecutive runs, THEN the system SHALL emit Sentry alert with tag `radar.crawler.structural_drift` and set `crawler_runs.status='parse_error'` and write `errors_json.drift_samples` containing last 3 parse diffs vs 7-day snapshot.
**근거:** research.md §5.2.
**검증 방법:** Mock crawler returning HTML with missing `.guidance-title` selector 3×  → Sentry event + `status='parse_error'` + errors_json 3 entries.

#### REQ-RADAR-018 (Event-driven) — Cloudflare Cron Trigger 스케줄
**요구사항:** The `wrangler.toml` SHALL define 11 Cron Triggers with UTC schedule: 18:00 (fda-guidance, fda-recalls), 18:15 (fda-federal-register), 18:30 (fda-warning-letters), 18:45 (eu-oj), 19:00 (eu-nbmed), 19:15 (mfds-notice, mfds-approval), 19:30 (pmda-notice), 19:45 (nmpa-notice), 20:00 (iso-iec), 21:00 (post-processing pipeline: classifier → scorer → notifier).
**근거:** research.md §5.1.
**검증 방법:** `wrangler.toml` schema lint → 11 cron entries → scheduler integration test with fake clock.

#### REQ-RADAR-019 (Ubiquitous) — Cron dispatch
**요구사항:** The `workers/radar-cron.ts` module SHALL dispatch cron events to the matching crawler function based on `event.cron` string, wrap each in `runCrawler()`, and return `{statusCode: 200, crawler_name, records_added}` response for Cloudflare observability.
**근거:** research.md §5.1.
**검증 방법:** Unit test: `scheduled({cron: '0 18 * * *', ...})` → 2 crawlers invoked (fda-guidance + fda-recalls).

#### REQ-RADAR-020 (Event-driven) — Queue publish
**요구사항:** WHEN a crawler successfully UPSERTs a `regulatory_updates` row, THEN the system SHALL publish `{update_id, needs_classification: true}` to `radar-raw-update` Cloudflare Queue for asynchronous downstream processing.
**근거:** research.md §5.4.
**검증 방법:** Mock Queue binding → assert `send()` called N times where N = newly inserted rows (not updated).

#### REQ-RADAR-021 (Ubiquitous) — Crawler isolation
**요구사항:** If a single crawler throws an unhandled exception, it SHALL NOT propagate to other cron slots or the post-processing pipeline. The `runCrawler()` wrapper SHALL catch the exception, set `crawler_runs.status='error'`, and allow other crawlers to proceed independently.
**근거:** research.md §9 위험 "HTML 구조 변경".
**검증 방법:** 11 crawler × 1개 throw → 10개 정상 완료, 1개 `status='error'`, pipeline 전체 green.

#### REQ-RADAR-022 (State-driven) — Crawler health endpoint
**요구사항:** WHILE the radar system is active, the `GET /api/admin/radar/health` endpoint SHALL return `{crawlers: [{name, last_run_at, last_success_at, status, records_last_24h}], overall_health: 'green'|'yellow'|'red'}` where `yellow` indicates any crawler failed last run, `red` indicates any crawler has failed ≥ 3 consecutive runs.
**근거:** research.md §5.2.
**검증 방법:** Seed crawler_runs with mixed statuses → endpoint 응답 aggregation matches.

### Group B — Classification Pipeline (REQ-RADAR-023 ~ REQ-RADAR-030)

#### REQ-RADAR-023 (Event-driven) — Tier1 relevance
**요구사항:** WHEN a message arrives on `radar-raw-update` queue, THEN `lib/radar/classifier.ts tier1()` SHALL invoke Claude Haiku with few-shot prompt (20 examples) against `{title, raw_content_en (or translated first 500 chars)}` and return `{relevant: boolean, confidence: number 0~1}`. IF `relevant === false` AND recall-keyword fallback does not trigger (REQ-RADAR-027), THEN the update SHALL be marked `classification_tier1_json.skipped = true` and NOT proceed to tier2/3.
**근거:** research.md §4.1.
**검증 방법:** 20-sample eval (medical + non-medical) → tier1 accuracy ≥ 95% (promptfoo).

#### REQ-RADAR-024 (Event-driven) — Tier2 device class + category
**요구사항:** WHEN tier1 returns `relevant = true`, THEN `tier2()` SHALL invoke Haiku with JSON-mode structured output to extract `{device_class: 'I'|'II'|'III'|'IVD-A'|'IVD-B'|'IVD-C'|'IVD-D'|'unknown', product_category: string[] (cardiovascular|orthopedics|ivd|neurology|radiology|software-as-medical-device|...), regulatory_aspect: 'safety'|'performance'|'labeling'|'clinical-evaluation'|'post-market-surveillance'|'submission-process'}` and store as `classification_tier2_json`.
**근거:** research.md §4.1 Tier 2.
**검증 방법:** 20-sample eval → `device_class` accuracy ≥ 85%, `product_category` F1 ≥ 0.80.

#### REQ-RADAR-025 (Event-driven) — Tier3 impact type
**요구사항:** WHEN tier2 completes, THEN `tier3()` SHALL invoke Haiku to classify `impact_type` into `'guidance_update' | 'recall' | 'standard_revision' | 'new_requirement' | 'enforcement_action' | 'informational'` and store as `classification_tier3_json`.
**근거:** research.md §4.1 Tier 3.
**검증 방법:** 20-sample eval → `impact_type` accuracy ≥ 90%.

#### REQ-RADAR-026 (Ubiquitous) — Zod schema validation
**요구사항:** All three tier outputs SHALL be validated against Zod schemas defined in `lib/radar/classifier-schemas.ts`. IF validation fails, THEN the classifier SHALL retry once with temperature 0.0 and append validation error to `classification_errors_json`. A second failure SHALL set `status='classification_failed'` on `regulatory_updates`.
**근거:** research.md §4.1 결정 #3 (Haiku structured).
**검증 방법:** Mock LLM returning malformed JSON → retry → still malformed → `status='classification_failed'`.

#### REQ-RADAR-027 (Unwanted / Safety net) — Recall keyword fallback
**요구사항:** IF the raw content contains any of the keywords `{'recall', 'Recall', '리콜', '回收', 'リコール', 'urgent field safety notice', 'FSN', 'FSCA'}` (case-insensitive for English), THEN the system SHALL force `tier1.relevant = true` AND `tier3.impact_type = 'recall'` regardless of LLM judgment.
**근거:** research.md §4.1 + 결정 #9 (safety net).
**검증 방법:** Fixture with `"Urgent Field Safety Notice"` + mock Haiku returning `relevant=false` → 최종 `relevant=true` + `impact_type='recall'`.

#### REQ-RADAR-028 (Ubiquitous) — Translation pipeline
**요구사항:** The system SHALL translate non-English `raw_content` into `raw_content_en` using Claude Haiku (for en/ko/ja) or Google Translate + Haiku re-refinement (for zh), cache results in Cloudflare KV with key `sha256(source_url + raw_content[0..128])`, and store the translation in the update row before tier1 runs.
**근거:** research.md §3.1 + 결정 #7.
**검증 방법:** Cache miss → translate → KV set; Cache hit → no LLM call; Chinese input → 2-step pipeline invoked.

#### REQ-RADAR-029 (Ubiquitous) — Korean UI translation
**요구사항:** The system SHALL ALSO generate `raw_content_ko` for every update (regardless of origin language) using Haiku, cached in KV with key `sha256(source_url + raw_content[0..128] + 'ko')`, so that the Korean UI can render translated titles and summaries without runtime LLM calls.
**근거:** Non-Obvious Constraint #6 + research.md §3.1.
**검증 방법:** Post-classification: `raw_content_ko` 필드 non-null for 100% of processed updates.

#### REQ-RADAR-030 (Event-driven) — Classify-consumer orchestration
**요구사항:** WHEN the `radar-classify-consumer` Queue consumer picks a message, THEN it SHALL (1) load update row, (2) translate if needed, (3) tier1, (4) if relevant tier2 + tier3, (5) UPDATE `regulatory_updates` with classification JSON + `classified_at`, (6) publish `{update_id}` to `radar-classified` queue. Consumer concurrency SHALL be max 10 to respect Haiku rate limits.
**근거:** research.md §5.4.
**검증 방법:** Queue consumer integration test: 30 messages → processed within 30 seconds with concurrency 10.

### Group C — Relevance Scoring (REQ-RADAR-031 ~ REQ-RADAR-037)

#### REQ-RADAR-031 (Event-driven) — Portfolio loader
**요구사항:** WHEN `lib/radar/portfolio-loader.ts loadOrgContext(orgId)` is called, THEN it SHALL return `{products: Array<{device_class, product_category, target_markets, approval_date, cleared_indications}>, active_projects: Array<{id, target_markets, project_phase, submission_date}>}` by joining `organization_documents` (DOCINGEST) and `projects` (FOUNDATION + WORKFLOWS extensions).
**근거:** research.md §4.2 + DOCINGEST/WORKFLOWS 의존.
**검증 방법:** Seed org with 3 products + 2 projects → loader returns 3+2 array sizes.

#### REQ-RADAR-032 (Event-driven) — Relevance scoring algorithm
**요구사항:** WHEN `scoreRelevance(update, orgContext)` is called, THEN it SHALL compute `impact_score` using the weighted formula defined in research.md §4.2 (region 0.35, product_category 0.30, device_class 0.15, active_project_phase 0.10, severity_boost 0.10) with LLM re-evaluation as 15% adjustment. Output SHALL include `matched_products[], matched_projects[]` for UI display.
**근거:** research.md §4.2.
**검증 방법:** 단위 테스트: synthetic orgContext + update → impact_score 값이 공식과 일치 (±0.05 LLM 조정분 허용).

#### REQ-RADAR-033 (Ubiquitous) — Per-user score persistence
**요구사항:** Scoring SHALL write one `org_update_relevance` row per `(organization_id, update_id)` pair with `impact_score`, `matched_products[]`, `matched_projects[]`, `scored_at`. Existing rows SHALL be UPDATED via `ON CONFLICT (organization_id, update_id) DO UPDATE`.
**근거:** research.md §4.2 + 결정 #6 (org-scoped).
**검증 방법:** Same (org, update) scored twice → 1 row with latest timestamp.

#### REQ-RADAR-034 (State-driven) — Fallback for orgs without portfolio
**요구사항:** WHILE `organization_documents` for an organization is empty (DOCINGEST onboarding not completed), the scorer SHALL fall back to `impact_score = 0.35` (product_category weight only, region default match) AND SHALL NOT trigger any notification (threshold < 0.7).
**근거:** research.md §6.2 DOCINGEST 의존도.
**검증 방법:** Org with 0 products → impact_score = 0.35 exact (rule-only, no LLM call).

#### REQ-RADAR-035 (Event-driven) — LLM re-evaluation gate
**요구사항:** The 15% LLM adjustment SHALL be SKIPPED when the rule-based impact_score < 0.4 (to avoid unnecessary Haiku cost on likely-irrelevant updates). In this case `llm_judgment = 0` and final score = 0.85 × rule_score.
**근거:** research.md §4.2 비용 최적화.
**검증 방법:** Rule-based 0.3 input → LLM 호출 0건 (mock call count) → final score = 0.255.

#### REQ-RADAR-036 (Event-driven) — Score-consumer orchestration
**요구사항:** WHEN the `radar-score-consumer` picks a message from `radar-classified`, THEN it SHALL (1) fetch all organizations having at least one active user with `org_members` row, (2) for each org load portfolio, (3) compute score, (4) UPSERT `org_update_relevance`, (5) IF score ≥ 0.7 publish to `radar-notification` queue.
**근거:** research.md §5.4.
**검증 방법:** 3 orgs × 1 update → 3 `org_update_relevance` rows; ≥ 0.7 중 2개 → 2 notification messages.

#### REQ-RADAR-037 (Ubiquitous) — Score feedback loop
**요구사항:** The system SHALL honor user feedback from `POST /api/ra/updates/:id/feedback` (body: `{not_relevant: true, reason?: 'wrong_category' | 'wrong_region' | 'not_our_products'}`) by decaying the score for matching (source, product_category) pair by -0.2 for 30 days. Decay SHALL be applied in subsequent scoring runs via a `feedback_adjustments` lookup.
**근거:** research.md §4.4.
**검증 방법:** Post feedback → next scoring for same (source, category) returns score - 0.2.

### Group D — Notification Pipeline (REQ-RADAR-038 ~ REQ-RADAR-044)

#### REQ-RADAR-038 (Event-driven) — Threshold gating
**요구사항:** WHEN `radar-notification` consumer picks a message, THEN based on `org_update_relevance.impact_score` it SHALL dispatch: `score ≥ 0.9` → toast + Slack + email + badge; `0.7 ≤ score < 0.9` → email + badge only; `< 0.7` → NO notification (quietly ignore).
**근거:** research.md §4.3.
**검증 방법:** 3 scores (0.95, 0.75, 0.55) → 3/2/0 channels dispatched.

#### REQ-RADAR-039 (Ubiquitous) — Badge channel
**요구사항:** Badge dispatch SHALL increment a counter on `/updates` nav item via an in-app polling endpoint `GET /api/ra/updates/badge-count` (TanStack Query refetch every 30s). Count SHALL reflect `org_update_relevance` rows with `acknowledged_at IS NULL AND impact_score ≥ 0.7`.
**근거:** research.md §4.3 + 결정 #15 (in-app polling).
**검증 방법:** Seed 3 unack rows ≥ 0.7 + 2 rows < 0.7 → badge count = 3.

#### REQ-RADAR-040 (Event-driven) — Toast channel
**요구사항:** WHEN `score ≥ 0.9`, THEN the notifier SHALL enqueue a toast message to the organization's WebSocket channel OR (fallback) set `users.pending_toasts_json` to be picked up by next polling cycle. Toast SHALL include update title, impact score, "보기" CTA deep-linking to `/updates/:id`.
**근거:** research.md §4.3.
**검증 방법:** Mock user online → WS message sent; Mock user offline → `pending_toasts_json` updated.

#### REQ-RADAR-041 (Event-driven) — Email daily digest
**요구사항:** WHEN a user has `notification_preferences.radar_email_digest = true`, THEN the daily email batch (06:30 KST / 21:30 UTC cron) SHALL send a summary email via SendGrid (BREADTH 재사용) containing all `org_update_relevance` rows from the past 24h with `impact_score ≥ 0.7`. Email body SHALL be serif-styled HTML aligned with tokens.css brand.
**근거:** research.md §4.3 + Non-Obvious Constraint #5 (serif).
**검증 방법:** Seed 5 updates ≥ 0.7 in past 24h → 1 email sent at 06:30 KST with 5 cards.

#### REQ-RADAR-042 (Event-driven) — Slack webhook
**요구사항:** WHEN `score ≥ 0.9` AND `organizations.slack_webhook_url IS NOT NULL`, THEN the notifier SHALL POST a Slack-formatted JSON payload (blocks API) to that webhook URL with rate limit 1 req/sec per webhook.
**근거:** research.md §4.3.
**검증 방법:** Mock webhook endpoint → 1 POST per ≥ 0.9 update, content-type `application/json`.

#### REQ-RADAR-043 (Ubiquitous) — Notification audit
**요구사항:** Every notification dispatch (regardless of channel) SHALL write `audit_logs` row with `action='radar.notification'`, `resource_type='regulatory_update'`, `resource_id=update.id`, `meta_json={channel, recipient, impact_score, matched_products[], matched_projects[]}`.
**근거:** Non-Obvious Constraint #4 (21 CFR Part 11 audit) + 결정 #14.
**검증 방법:** 4 channels × 3 updates → 12 `audit_logs` rows with action='radar.notification'.

#### REQ-RADAR-044 (State-driven) — Alert fatigue throttling
**요구사항:** WHILE the system has already sent ≥ 3 notifications in the past 7 days for the same `(source_crawler, product_category[0])` to the same organization, subsequent notifications with `impact_score` in `[0.7, 0.9)` SHALL be batched into a weekly digest email at Monday 06:30 KST instead of immediate individual email. Immediate dispatch SHALL still occur for `score ≥ 0.9`.
**근거:** research.md §4.4 alert fatigue.
**검증 방법:** Seed 4 notifications same-source-category 5 days apart → 4th delivered only in Monday digest, `acknowledged_at` IS NULL until user opens.

### Group E — DB Schema Extension (REQ-RADAR-045 ~ REQ-RADAR-050)

#### REQ-RADAR-045 (Ubiquitous) — regulatory_updates 확장
**요구사항:** Migration `0010_radar.sql` SHALL ALTER `regulatory_updates` to add:

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `external_id` | text | NOT NULL | — | UNIQUE constraint; source-specific ID |
| `source_crawler` | text | NOT NULL | — | CHECK IN 11 crawler names |
| `raw_content` | text | nullable | NULL | original language |
| `raw_content_en` | text | nullable | NULL | Haiku translation |
| `raw_content_ko` | text | nullable | NULL | Haiku translation |
| `classification_tier1_json` | jsonb | nullable | NULL | `{relevant, confidence}` |
| `classification_tier2_json` | jsonb | nullable | NULL | `{device_class, product_category[], regulatory_aspect}` |
| `classification_tier3_json` | jsonb | nullable | NULL | `{impact_type}` |
| `classified_at` | timestamptz | nullable | NULL | — |
| `crawled_at` | timestamptz | NOT NULL | `now()` | — |
| `updated_at` | timestamptz | NOT NULL | `now()` | trigger on UPDATE |
| `raw_content_s3_key` | text | nullable | NULL | Post-launch cold storage pointer |
| `status` | text | NOT NULL | `'crawled'` | enum-like CHECK IN (`crawled`, `translated`, `classified`, `scored`, `classification_failed`) |

Migration SHALL be idempotent (`ADD COLUMN IF NOT EXISTS`) and SHALL populate `external_id` for pre-existing Phase 4 seed rows via a transitional script (using `source_url` hash fallback).
**근거:** research.md §1.2 + FOUNDATION REQ-FND-042 base columns retained.
**검증 방법:** Post-migration: `\d regulatory_updates` shows 8 new columns + UNIQUE on external_id; Phase 4 seed rows still readable.

#### REQ-RADAR-046 (Ubiquitous) — org_update_relevance 테이블
**요구사항:** Migration SHALL CREATE TABLE `org_update_relevance`:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `organization_id` | uuid | NOT NULL | — | **CASCADE** → organizations | |
| `update_id` | uuid | NOT NULL | — | **CASCADE** → regulatory_updates | |
| `impact_score` | numeric(3,2) | NOT NULL | — | — | CHECK (0 ≤ impact_score ≤ 1) |
| `matched_products` | text[] | NOT NULL | `'{}'::text[]` | — | document IDs or product names |
| `matched_projects` | uuid[] | NOT NULL | `'{}'::uuid[]` | — | projects.id references |
| `scored_at` | timestamptz | NOT NULL | `now()` | — | |
| `notified_at` | timestamptz | nullable | NULL | — | first notification dispatch |
| `acknowledged_at` | timestamptz | nullable | NULL | — | user opened/dismissed |
| `feedback_not_relevant` | boolean | NOT NULL | `false` | — | REQ-RADAR-037 decay source |

PRIMARY KEY (organization_id, update_id). INDEX on (organization_id, impact_score DESC, scored_at DESC) for feed queries.
**근거:** research.md §4.2.
**검증 방법:** `\d org_update_relevance` shows 9 columns, PK compound, 1 index.

#### REQ-RADAR-047 (Ubiquitous) — crawler_runs 테이블
**요구사항:** Migration SHALL CREATE TABLE `crawler_runs`:

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `crawler_name` | text | NOT NULL | — | matches 11 crawler names |
| `started_at` | timestamptz | NOT NULL | `now()` | — |
| `completed_at` | timestamptz | nullable | NULL | — |
| `records_added` | integer | NOT NULL | `0` | — |
| `records_updated` | integer | NOT NULL | `0` | — |
| `status` | text | NOT NULL | `'running'` | CHECK IN (`running`, `success`, `error`, `rate_limited`, `geo_blocked`, `robots_disallowed`, `parse_error`) |
| `errors_json` | jsonb | NOT NULL | `'{}'::jsonb` | structured error details |
| `duration_ms` | integer | nullable | NULL | — |

INDEX on (crawler_name, started_at DESC) for health queries.
**근거:** research.md §5.
**검증 방법:** `\d crawler_runs` + seed 5 runs + query health aggregation.

#### REQ-RADAR-048 (Ubiquitous) — audit_action enum 확장
**요구사항:** Migration SHALL execute `ALTER TYPE audit_action ADD VALUE 'radar.crawler_run'`, `ALTER TYPE audit_action ADD VALUE 'radar.notification'`, `ALTER TYPE audit_action ADD VALUE 'radar.search'`, and `lib/audit.ts` `AuditAction` TypeScript union SHALL be updated in the same PR to include the three new values. FOUNDATION `REQ-FND-049` enum inventory table SHALL be amended in a parallel FOUNDATION v0.5.0 release bumping the cumulative max enum size from 26 → 29 values (Phase 1: 3 + Phase 4: 10 + Phase 5: 13 + Phase 10: 3).
**근거:** Non-Obvious Constraint #4 + FOUNDATION REQ-FND-049 enum discipline.
**검증 방법:** `SELECT enum_range(NULL::audit_action)` returns 29 values including the 3 new. `lib/audit.ts` TS union equals DB enum (cross-file assertion test).

#### REQ-RADAR-049 (Ubiquitous) — Drizzle schema export
**요구사항:** `lib/db/schema.ts` SHALL export `regulatoryUpdates` (with extended columns), `orgUpdateRelevance`, `crawlerRuns` table definitions with matching TypeScript types inferred via `$inferSelect` / `$inferInsert`. Exports SHALL be additive (do NOT modify existing 13 table declarations beyond the additive `regulatoryUpdates` columns).
**근거:** research.md §1.3 + 본 SPEC Scope "수정 금지" 원칙.
**검증 방법:** `tsc --noEmit` passes; test imports `orgUpdateRelevance` from schema.ts.

#### REQ-RADAR-050 (Ubiquitous) — Indexes
**요구사항:** Migration SHALL CREATE INDEX `idx_regulatory_updates_status_crawled_at` ON `regulatory_updates (status, crawled_at DESC)`; `idx_regulatory_updates_impact_type` ON `regulatory_updates ((classification_tier3_json->>'impact_type'))`; `idx_crawler_runs_name_started` ON `crawler_runs (crawler_name, started_at DESC)`.
**근거:** research.md §5 query pattern 분석.
**검증 방법:** `EXPLAIN ANALYZE` on `/api/ra/updates` listing queries → Index Scan appears.

### Group F — UI + Ad-hoc Search (REQ-RADAR-051 ~ REQ-RADAR-055)

#### REQ-RADAR-051 (Event-driven) — /updates 필터 확장
**요구사항:** WHEN user visits `/updates`, THEN the page SHALL display filter controls (impact_min slider 0~1, region multi-select, product_category multi-select, impact_type multi-select) that map to query params of `GET /api/ra/updates?impact_min=0.7&region=US&...`. Filter state SHALL persist in `stores/radar.ts` via Zustand persist middleware (localStorage).
**근거:** research.md §6.1 + Phase 4 BREADTH view 확장.
**검증 방법:** Playwright e2e (Phase 6 리그레션): 필터 적용 후 페이지 재로드 → 필터 상태 유지.

#### REQ-RADAR-052 (Event-driven) — /updates/:id 상세
**요구사항:** WHEN user opens `/updates/[id]`, THEN the page SHALL (1) render title + source + region + impact_score badge, (2) render raw_content (ko locale → raw_content_ko; en → raw_content_en), (3) stream `impact_analysis_text` via Sonnet on first load (cached 72h via `updates.impact_analysis_cached_at`), (4) show "작업 초안 생성" button that POSTs to `/api/ra/workflows/draft?update_id=<id>` (WORKFLOWS Phase 9).
**근거:** research.md §6.1 + 결정 #10.
**검증 방법:** First visit → Sonnet streaming 시작; 5분 후 재방문 → cached text 즉시 표시; 버튼 클릭 → WORKFLOWS API mock 호출 검증.

#### REQ-RADAR-053 (Event-driven) — /admin/radar 대시보드
**요구사항:** WHEN user with `role='admin'` visits `/admin/radar`, THEN the page SHALL display (1) 11 crawler rows with last_run_at / status / records_last_24h, (2) red badge for crawlers with 3+ consecutive failures, (3) "수동 실행" button per crawler invoking `POST /api/admin/radar/run?crawler=<name>` (ENTERPRISE `withPermission('admin.radar.run')` enforced), (4) recent 50 crawler_runs log with expandable errors_json.
**근거:** research.md §6.1.
**검증 방법:** Non-admin user → 403; admin user → UI 렌더 + 버튼 클릭 시 manual run triggers.

#### REQ-RADAR-054 (Event-driven) — Ad-hoc radar search
**요구사항:** WHEN BREADTH chat router `lib/ai/router.ts` classifies user query as intent `'radar.search'` (e.g., "지난 6개월 FDA guidance 중 소프트웨어 의료기기 관련"), THEN the router SHALL forward the query to `POST /api/ra/radar/search` which parses time range + source + product category via Haiku, executes filtered query on `regulatory_updates`, and returns top 10 results formatted as a `related` structured block (Phase 3 STRUCTURED 재사용).
**근거:** research.md §6.1 + BREADTH router 확장.
**검증 방법:** Chat query "지난 6개월 FDA guidance 중 소프트웨어" → `related` block with ≥ 1 items, each with deep-link `/updates/[id]`.

#### REQ-RADAR-055 (Ubiquitous) — Audit for radar.search
**요구사항:** Every invocation of `/api/ra/radar/search` SHALL write `audit_logs` row with `action='radar.search'`, `resource_type='conversation'`, `resource_id=conversation.id`, `meta_json={query, filters_parsed, results_count}`.
**근거:** Non-Obvious Constraint #4 + 결정 #14 (audit minimum surface).
**검증 방법:** 1 search call → 1 audit_logs row with action='radar.search'; `action NOT IN enum` for any crawl-unrelated action.

---

## Worked Examples (구현 가이드 예시)

본 섹션은 Phase 10 구현자가 파일럿 시나리오를 실측 숫자로 검증할 수 있도록 **계산 단계 예시**를 제공한다. 모든 수치는 research.md §4.2 공식의 가독성을 위한 예시이며 EARS 요구사항 자체는 아니다(informative).

### 예시 1 — FDA recall이 조직 A에 유입되는 경로

전제:
- 조직 A의 `organization_documents`에 등록된 제품 3개:
  - Product P1: device_class=II, product_category=[cardiovascular], target_markets=[US,EU]
  - Product P2: device_class=II, product_category=[cardiovascular], target_markets=[US]
  - Product P3: device_class=I, product_category=[software-as-medical-device], target_markets=[US,EU,KR]
- 조직 A의 active `projects` 2개:
  - Project J1: target_markets=[US,EU], submission_date=2026-09-01
  - Project J2: target_markets=[KR], submission_date=2026-12-15

업데이트 U:
- source_crawler='fda-recalls', region='US', impact_type='recall'
- Tier2: device_class='II', product_category=['cardiovascular'], regulatory_aspect='safety'

Score 계산:
- Region match: US ∈ P1.target_markets ∪ P2.target_markets ∪ P3.target_markets → overlap_ratio = 3/3 = 1.0 → `+0.35`
- Product category: cardiovascular in P1.product_category AND P2.product_category → 2 products match, distributed: `+0.30 × 2/3 = +0.20` (3 products total, 2 matched)
- Device class: II ∈ union(P1.II, P2.II) → `+0.15`
- Active project: J1.submission_date = 2026-09-01, current date 2026-04-22 → 132일 (< 180일) AND update.impact_type='recall' (in ['guidance_update','new_requirement']? — No, recall is its own type, 따라서 적용 안됨) → `+0.00`
- Severity boost: impact_type='recall' AND P1/P2 market=US 매칭 → `+0.10`
- Rule-based subtotal = 0.35 + 0.20 + 0.15 + 0.00 + 0.10 = **0.80**
- Rule-based ≥ 0.4이므로 LLM re-evaluation 실행 (REQ-RADAR-035 gate 통과)
- LLM returns 0.85 (confirmed high impact: "심혈관 제품 리콜은 직접 영향")
- Final = 0.85 × 0.80 + 0.15 × 0.85 = 0.68 + 0.1275 = **0.8075**

채널 분기 (REQ-RADAR-038):
- 0.80 < 0.9 → 토스트/Slack 제외
- 0.80 ≥ 0.7 → 배지 + 이메일 daily digest 발송

Audit 생성:
- `audit_logs` row 1: action='radar.notification', channel='email', impact_score=0.8075
- `audit_logs` row 2: action='radar.notification', channel='badge', impact_score=0.8075

### 예시 2 — EU OJ 업데이트가 조직 B에 관련 없음 (fallback)

전제:
- 조직 B는 DOCINGEST 온보딩 미완료 → `organization_documents` 0 rows

업데이트 U:
- source_crawler='eu-oj', region='EU', impact_type='new_requirement'

Score 계산:
- Portfolio empty → REQ-RADAR-034 fallback rule 적용
- `impact_score = 0.35` (rule-only, LLM 호출 skip)
- 0.35 < 0.7 → 모든 채널 skip, UI 피드에도 비노출

UI 배너:
- 조직 B의 `/updates` 페이지 상단에 "제품 포트폴리오를 등록하면 더 정확한 알림을 받을 수 있습니다" 영속 배너 표시

### 예시 3 — Recall keyword safety net 동작

전제:
- 업데이트 U의 `raw_content` 영어 번역본에 `"Urgent Field Safety Notice"` 문자열 포함
- Tier1 Haiku가 오류로 `{relevant: false, confidence: 0.6}` 반환 (false negative 시뮬레이션)

Safety net 동작:
- REQ-RADAR-027 keyword matcher가 `"urgent field safety notice"` (case-insensitive) 감지
- Force override: `tier1.relevant = true` AND `tier3.impact_type = 'recall'`
- Tier2 실행 계속 진행
- Scorer가 정상 작동 → 조직별 impact_score 계산

결과:
- LLM 오류에도 불구하고 recall 이벤트가 파이프라인에 진입 → safety gate 충족

### 예시 4 — HTML drift 감지

전제:
- FDA warning letters 페이지 구조가 `<div class="letter-row">` → `<article class="warning-letter-item">` 변경

Day 1:
- `runCrawler('fda-warning-letters')` 실행
- Zod schema validation 실패: `.letter-row` selector 0 matches
- `crawler_runs` row: status='parse_error', errors_json={attempt:1, missing_selector:'.letter-row', observed_structure:'<article class="warning-letter-item">...'}

Day 2, Day 3:
- 재실행 시마다 parse_error 누적
- 3회 연속 실패 → Sentry alert 발생, admin dashboard red badge
- `docs/runbooks/radar-operations.md`의 "HTML drift 대응" 섹션이 담당자에게 Slack DM

Day 4 (대응):
- 담당자가 `lib/radar/crawlers/fda-warning-letters.ts` selector 업데이트 PR 제출
- Fixture `__tests__/fixtures/radar/fda-warning-letters.html` 신규 HTML로 교체
- 테스트 green → deploy → 정상 crawl 재개

---

## Queue 메시지 계약 (Queue Message Contracts)

각 Cloudflare Queue의 페이로드 스키마. 구현자는 `lib/radar/queues/schemas.ts`에 Zod 정의.

### `radar-raw-update` (crawler → classifier)

```
{
  update_id: uuid,           // regulatory_updates.id
  needs_classification: boolean,
  priority: 'high' | 'normal',  // recall = high, 나머지 = normal
  published_at: ISO-8601     // 중복 배치 방지용
}
```

### `radar-classified` (classifier → scorer)

```
{
  update_id: uuid,
  classification: {
    tier1: { relevant: boolean, confidence: number },
    tier2: { device_class, product_category[], regulatory_aspect } | null,
    tier3: { impact_type } | null
  },
  classified_at: ISO-8601
}
```

### `radar-notification` (scorer → notifier)

```
{
  update_id: uuid,
  organization_id: uuid,
  impact_score: number,
  matched_products: string[],
  matched_projects: uuid[],
  channels: Array<'toast' | 'badge' | 'email' | 'slack'>  // 사전 계산
}
```

### DLQ (Dead Letter Queue)

- `radar-raw-update-dlq`, `radar-classified-dlq`, `radar-notification-dlq` 3개 DLQ
- DLQ 소비자: `workers/radar-dlq-consumer.ts` — DB table `radar_dlq_messages` 기록 + Sentry alert
- DLQ 메시지는 admin dashboard에서 수동 재처리 가능

---

## 마이그레이션 SQL 발췌 (informative)

REQ-RADAR-045/046/047/048의 구현 참고용. 최종 SQL은 `migrations/0010_radar.sql`에서 Drizzle Kit이 생성.

```sql
-- 1. audit_action enum extension (REQ-RADAR-048)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'radar.crawler_run';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'radar.notification';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'radar.search';

-- 2. regulatory_updates extension (REQ-RADAR-045)
ALTER TABLE regulatory_updates
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_crawler text,
  ADD COLUMN IF NOT EXISTS raw_content text,
  ADD COLUMN IF NOT EXISTS raw_content_en text,
  ADD COLUMN IF NOT EXISTS raw_content_ko text,
  ADD COLUMN IF NOT EXISTS classification_tier1_json jsonb,
  ADD COLUMN IF NOT EXISTS classification_tier2_json jsonb,
  ADD COLUMN IF NOT EXISTS classification_tier3_json jsonb,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS crawled_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS raw_content_s3_key text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'crawled';

-- Populate external_id for existing Phase 4 seed rows (transitional)
UPDATE regulatory_updates
  SET external_id = 'legacy-' || encode(sha256(coalesce(source_url, id::text)::bytea), 'hex')
  WHERE external_id IS NULL;

ALTER TABLE regulatory_updates
  ALTER COLUMN external_id SET NOT NULL,
  ADD CONSTRAINT regulatory_updates_external_id_unique UNIQUE (external_id),
  ADD CONSTRAINT regulatory_updates_status_check CHECK (
    status IN ('crawled', 'translated', 'classified', 'scored', 'classification_failed')
  );

-- 3. org_update_relevance (REQ-RADAR-046)
CREATE TABLE IF NOT EXISTS org_update_relevance (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  update_id uuid NOT NULL REFERENCES regulatory_updates(id) ON DELETE CASCADE,
  impact_score numeric(3,2) NOT NULL CHECK (impact_score >= 0 AND impact_score <= 1),
  matched_products text[] NOT NULL DEFAULT '{}'::text[],
  matched_projects uuid[] NOT NULL DEFAULT '{}'::uuid[],
  scored_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  acknowledged_at timestamptz,
  feedback_not_relevant boolean NOT NULL DEFAULT false,
  PRIMARY KEY (organization_id, update_id)
);

CREATE INDEX IF NOT EXISTS idx_org_update_relevance_feed
  ON org_update_relevance (organization_id, impact_score DESC, scored_at DESC);

-- 4. crawler_runs (REQ-RADAR-047)
CREATE TABLE IF NOT EXISTS crawler_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crawler_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  records_added integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN (
    'running', 'success', 'error', 'rate_limited',
    'geo_blocked', 'robots_disallowed', 'parse_error'
  )),
  errors_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS idx_crawler_runs_name_started
  ON crawler_runs (crawler_name, started_at DESC);

-- 5. regulatory_updates indexes (REQ-RADAR-050)
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_status_crawled_at
  ON regulatory_updates (status, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_impact_type
  ON regulatory_updates ((classification_tier3_json->>'impact_type'));
```

Post-migration 검증:
- `SELECT enum_range(NULL::audit_action)` → 29 values
- `\d regulatory_updates` → 확장 컬럼 존재 + UNIQUE constraint
- `\d org_update_relevance`, `\d crawler_runs` → 신규 테이블 확인
- Phase 4 seed 데이터 읽기 호환성 확인

---

## 롤아웃 계획 (Rollout Plan)

Phase 10 배포는 6개 Wave로 분할한다. 각 Wave는 이전 Wave green 확인 후 진행(우선순위 라벨 기반, 시간 예측 없음).

### Wave 1 — DB 기반

- REQ-RADAR-045/046/047/048/049/050 적용
- FOUNDATION v0.5.0 amendment PR merge
- `lib/audit.ts` AuditAction union 확장
- Phase 4 seed 데이터 호환성 회귀 테스트

### Wave 2 — Crawler framework + FDA 4종

- REQ-RADAR-001/002/014/015/016/017/018/019/020/021/022
- REQ-RADAR-003~006 (FDA guidance, Federal Register, recalls, warning letters)
- `workers/radar-cron.ts`, `wrangler.toml` Cron Triggers (FDA 슬롯만 활성)
- Sentry tag wiring
- Fixture 기반 integration test × 4

### Wave 3 — EU + MFDS crawler

- REQ-RADAR-007/008 (EU OJ, NB-MED)
- REQ-RADAR-009/010 (MFDS 고시, 인허가) — Browser Rendering 의존 첫 적용
- `robots.txt` 캐시 검증

### Wave 4 — PMDA / NMPA / ISO/IEC

- REQ-RADAR-011/012/013
- NMPA geo-block 시나리오 운영 검증
- ISO/IEC 저작권 safe 경로 확인 (메타만 수집)

### Wave 5 — 분류 + 번역 + 스코어링

- REQ-RADAR-023~030 (classifier)
- REQ-RADAR-028/029 (translator)
- REQ-RADAR-031~037 (scorer)
- `workers/radar-classify-consumer.ts`, `workers/radar-score-consumer.ts`
- LLM eval harness (tier1-accuracy, tier2-accuracy promptfoo)

### Wave 6 — 알림 + UI + admin

- REQ-RADAR-038~044 (notifier)
- REQ-RADAR-051~055 (UI + ad-hoc search)
- `workers/radar-notify-consumer.ts`
- `/admin/radar` 대시보드
- BREADTH chat router radar.search intent 추가

### Post-Wave — 운영 검증

- 14일 shadow 모드 (알림 발송 mock transport) → precision ≥ 80% 확인 후 실제 이메일/Slack 활성화
- 30일 rolling metrics 모니터링 (Cost Gates, Functional Gates)

---

## 수용 기준 (Acceptance Criteria)

### Functional Gates

1. 11 crawlers 일일 실행 성공률 ≥ 95% (30일 rolling average, status='success' OR 'rate_limited' 재시도 후 복구 포함)
2. Tier1 분류 정확도 ≥ 95% (promptfoo eval 20개 샘플: 의료기기 관련/비관련)
3. Tier2 분류 정확도 ≥ 85% (device_class × product_category F1 ≥ 0.80)
4. Tier3 분류 정확도 ≥ 90% (impact_type 6-enum)
5. Impact score ≥ 0.7 알림의 precision ≥ 80% (사용자 "관심 없음" 피드백 비율 ≤ 20%, 60일 rolling)
6. 신규 발행 guidance가 발행일 + 24h 내 시스템 반영 ≥ 90% (FDA/EU OJ 기준)
7. 다국어 번역 BLEU ≥ 0.60 (한/영), ≥ 0.50 (중/일) — 일 샘플 10건 자동 측정
8. Recall 이벤트 100% 감지 — Tier1 LLM 판단 무관하게 키워드 fallback이 triggered 되어 relevant=true로 라우팅 (REQ-RADAR-027)

### Schema Gates

1. `regulatory_updates` 확장 8 컬럼 + UNIQUE(external_id) 생성 완료
2. `org_update_relevance` 테이블 생성 + PK(org_id, update_id) + 1개 복합 인덱스
3. `crawler_runs` 테이블 생성 + 1개 복합 인덱스
4. `audit_action` pgEnum 29 values 확인 (`SELECT enum_range(NULL::audit_action)`)
5. `lib/audit.ts` `AuditAction` TypeScript union이 DB enum과 equality (cross-file test)

### UI Gates

1. `/updates` 필터 적용 → 서버 쿼리 응답 500ms 이내 (p95)
2. `/updates/:id` Sonnet streaming first-token latency < 3s (cold cache)
3. `/admin/radar` 대시보드 로드 200ms 이내 (crawler_runs 인덱스 활용)
4. Chat에서 `radar.search` intent → 10건 결과 2초 이내

### Observability Gates

1. 모든 crawler 실행 → `crawler_runs` row + `audit_logs` row 각 1건
2. 모든 notification dispatch → `audit_logs` row action='radar.notification'
3. 모든 `/api/ra/radar/search` 호출 → `audit_logs` row action='radar.search'
4. Sentry tag `radar.crawler.structural_drift` alert이 HTML drift 3회 연속 시 발생 (REQ-RADAR-017)

### Cost Gates

1. Haiku classifier 일 token 사용량 ≤ 1.5M tokens (≤ $0.38/day)
2. Sonnet impact_analysis 일 호출 ≤ 200건 (캐시 hit 기준)
3. Google Translate 월 char 사용량 ≤ 5M chars (≤ $100/month)
4. Cloudflare Browser Rendering 일 호출 ≤ 500건 (≤ $10/day)

### Non-Obvious Constraints 매핑 재확인

| # | 제약 | 본 Phase 충족 방식 | 검증 방법 |
|---|---|---|---|
| 1 | Citation | Sonnet impact_analysis generation inherits Phase 2 post-processing pipeline (existing lib/ai/citation-enforce.ts) | Re-use existing citation tests |
| 2 | Streaming | Sonnet impact_analysis 재사용 기존 useStreamingAnswer | Phase 2 integration test 리그레션 |
| 3 | Expert review | impact_score ≥ 0.95 AND recall → Phase 5 expert_review auto-flag trigger | Post-Phase-5 integration |
| 4 | 21 CFR Part 11 audit | audit_action 3값 확장 + 3개 call-site (crawler_run, notification, search) | REQ-RADAR-048, 055 |
| 5 | Serif/sans | Email daily digest serif-styled HTML + /updates UI 기존 토큰 재사용 | Phase 1 tokens.css 변경 없음 확인 |
| 6 | 한/영 first-class | raw_content_en + raw_content_ko + UI locale switching 지원 | REQ-RADAR-028, 029 |
| 7 | noindex | app shell 하위 /admin/radar + /updates 자동 상속 | middleware.ts 변경 없음 |

---

## Deliverables (본 Phase 산출물)

1. `lib/radar/` 디렉토리 전체 (crawlers, classifier, translator, relevance-scorer, notifier, notifier-channels, portfolio-loader, classifier-schemas, classifier-prompts, translator-cache)
2. `workers/radar-cron.ts`, `workers/radar-classify-consumer.ts`, `workers/radar-score-consumer.ts`, `workers/radar-notify-consumer.ts`
3. `migrations/0010_radar.sql`
4. `lib/db/schema.ts` 확장 (regulatoryUpdates + orgUpdateRelevance + crawlerRuns)
5. `lib/audit.ts` `AuditAction` union 확장 (3값)
6. `app/(app)/updates/page.tsx` 수정
7. `app/(app)/updates/[id]/page.tsx` 신규
8. `app/(app)/admin/radar/page.tsx` 신규
9. `app/api/ra/updates/route.ts` 수정
10. `app/api/ra/updates/[id]/route.ts` 신규
11. `app/api/ra/updates/[id]/feedback/route.ts` 신규
12. `app/api/admin/radar/run/route.ts` 신규
13. `app/api/admin/radar/runs/route.ts` 신규
14. `app/api/admin/radar/health/route.ts` 신규
15. `app/api/ra/radar/search/route.ts` 신규
16. `lib/queries/useUpdates.ts` 수정, `useUpdate.ts` / `useUpdateImpactAnalysis.ts` / `useCrawlerRuns.ts` 신규
17. `stores/radar.ts` 신규
18. `components/radar/UpdateCard.tsx` 확장, `ImpactChip.tsx` 신규
19. `scripts/seed-radar-fixtures.ts`
20. `__tests__/radar/` 전체 (classifier.test, relevance-scorer.test, notifier.test, crawlers/*.test × 11)
21. `eval/radar/tier1-accuracy.promptfoo.yaml`, `eval/radar/tier2-accuracy.promptfoo.yaml`
22. `wrangler.toml` Cron Triggers 11 entries
23. 문서: `docs/runbooks/radar-operations.md` (crawler 장애 대응), `docs/architecture/radar-pipeline.md` (queue flow)
24. FOUNDATION v0.5.0 amendment PR (REQ-FND-049 enum inventory table 갱신, Phase 10 3값 추가)

---

## 위험 (Risks)

| # | 위험 | 확률 | 영향 | 완화 |
|---|---|---|---|---|
| R1 | 소스 HTML 구조 변경 → crawler breakage | 중 | 중 | Zod schema validation + 7일 snapshot diff + Sentry drift alert (REQ-RADAR-017) |
| R2 | 공식 소스 rate limit / IP 차단 | 중 | 고 | Exponential backoff + UA 명시 + robots.txt 준수 + Cloudflare global IP rotation (REQ-RADAR-002, 014, 015) |
| R3 | 다국어 번역 품질 미달 (특히 zh, ja) | 중 | 중 | Google Translate + Haiku 2-step for zh + BLEU 측정 + 일 10건 수동 샘플 검증 |
| R4 | 분류 오류로 recall 미감지 | 저 | 치명 | Recall keyword fallback REQ-RADAR-027 (LLM 판단 무관 force) |
| R5 | Alert fatigue로 사용자 이탈 | 중 | 중 | 0.7/0.9 threshold + 7일 3건 초과 시 디지스트 전환 + 사용자 피드백 weight decay (REQ-RADAR-044, 037) |
| R6 | NMPA/PMDA LLM 품질 부족 | 중 | 중 | Google Translate 1차 + Haiku 2차 + BLEU 목표 일시 완화 (한/영 0.60, 중/일 0.50) |
| R7 | NMPA 중국 geo-block | 고 | 중 | Cloudflare global network retry + `status='geo_blocked'` 별도 분류 + 월 1회 blank day 허용 (REQ-RADAR-012) |
| R8 | `audit_action` enum 확장 순서 의존성 | 저 | 중 | FOUNDATION REQ-FND-049 enum inventory 테이블에 Phase 10 선언 + 마이그레이션 순서 검증 (REQ-RADAR-048) |
| R9 | `organization_documents` 미완료 조직 | 중 | 저 | fallback score 0.35 (REQ-RADAR-034) + UI 배너 유도 |
| R10 | LLM API 비용 초과 | 저 | 저 | Haiku 주 사용 + Sonnet on-demand + Cost Gates 모니터링 |
| R11 | ISO/IEC 저작권 이슈 | 저 | 치명 | 메타만 수집 원칙 (REQ-RADAR-013) + 본문 저장 금지 (결정 #13) |
| R12 | FOUNDATION v0.5.0 PR 동기화 실패 | 저 | 중 | 본 Phase 완료 게이트 체크리스트에 "FOUNDATION enum inventory 반영" 포함 |
| R13 | WORKFLOWS Phase 9 미완료 | 중 | 저 | "작업 초안" 버튼 feature flag (`RADAR_WORKFLOWS_DRAFT_ENABLED`); 미활성 시 비활성 상태 표시 |

---

## Dependencies & Coordination

### Upstream Blockers

| 의존 | 필요 항목 | 상태 |
|---|---|---|
| FOUNDATION v0.4.0 | 13 tables + audit_action pgEnum (기존 26 values) | 완료 |
| BREADTH v0.2.0 | `/updates` page + `useUpdates` hook + `stores/ui.ts` | 완료 |
| ENTERPRISE | `withPermission` middleware + admin role | 완료 |
| CLOUDFLARE | Workers + Cron + Browser Rendering + R2 + Queues + KV | **blocker (별도 SPEC)** |
| DOCINGEST | `organization_documents` 테이블 + 인증 제품 메타 | **blocker (별도 SPEC)** |
| WORKFLOWS (Phase 9) | `POST /api/ra/workflows/draft` 계약 | 부분 의존 (feature flag로 회피 가능) |

### Downstream Consumers

- Post-launch Reporter Phase (미계획): radar history 기반 월간 리포트
- Post-launch Analytics Phase: impact score trend dashboard

### Coordination Points

1. **FOUNDATION v0.5.0 amendment PR**: 본 Phase 완료와 동시 FOUNDATION REQ-FND-049 enum inventory 테이블 3값 추가. 순서는 FOUNDATION 먼저 merge → 본 Phase merge.
2. **CLOUDFLARE SPEC**: Browser Rendering binding 이름, R2 bucket 이름, Queue 이름, KV namespace ID 합의 필요.
3. **DOCINGEST SPEC**: `organization_documents.product_category` enum 값이 본 Phase의 product_category와 일치해야 scoring join 정확. 합의된 enum 10개: cardiovascular, orthopedics, ivd, neurology, radiology, software-as-medical-device, dental, ophthalmology, surgical, other.
4. **WORKFLOWS SPEC**: `POST /api/ra/workflows/draft?update_id=<id>` 계약에 `workflow_type: 'impact-assessment' | 'update-510k-submission' | 'revise-labeling'` 파라미터 합의 필요.

---

## Pending (Open Items)

| # | 질문 | 결정 시점 | 기본값 |
|---|---|---|---|
| P1 | 유료 규제 DB (PharmaIntelligence 등) 통합 | Post-launch v11 | 공식 무료 11개로 시작 |
| P2 | NMPA 번역 품질 3개월 운영 후 재평가 | Phase 10 +90일 | Google + Haiku 2-step 유지 |
| P3 | Slack 외 Teams / Zoom webhook | ENTERPRISE 확장 | Slack 단독 |
| P4 | impact_analysis 캐시 TTL 운영 튜닝 | Phase 10 +60일 | 72시간 |
| P5 | Cold storage 이관 기준 (1년/2년?) | Phase 10 +90일 | 1년 hot + 이후 R2 cold |
| P6 | ISO/IEC 표준 본문 legal opinion | 법무 자문 완료 후 | 메타만 유지 |
| P7 | NMPA 월 1회 blank day 허용 기준 | 운영 1개월 후 | 월 1회까지는 `geo_blocked` 정상 |
| P8 | 조직별 impact_threshold 커스터마이징 | Post-launch | 공통 0.7/0.9 |

---

Version: 2.0.0
Status: completed
Last Updated: 2026-05-04

---

## 구현 노트 (Implementation Notes — 2026-05-04)

### v2.0 범위 축소 (실제 구현 반영)

원본 SPEC(v0.1.0)의 11개 crawler를 v2.0에서 3개로 집중:

| Crawler | REQ | 상태 |
|---------|-----|------|
| FDA Federal Register | REQ-RADAR-004 | ✅ 구현 |
| EU Official Journal | REQ-RADAR-007 | ✅ 구현 |
| MFDS 식약처 고시 | REQ-RADAR-009 | ✅ 구현 |
| FDA Guidance / Recalls / Warning Letters | REQ-RADAR-001~003, 005~006 | v2.0 제외 (post-launch) |
| EU NB-MED | REQ-RADAR-008 | v2.0 제외 (post-launch) |
| MFDS 인허가 | REQ-RADAR-010 | v2.0 제외 (post-launch) |
| PMDA, NMPA | REQ-RADAR-011~014 | Phase 8 corpus 부속으로 이동 |
| ISO/IEC | REQ-RADAR-015 | v2.0 제외 (post-launch) |

### 실제 구현 산출물

| 레이어 | 구현 항목 |
|--------|-----------|
| DB | `migrations/0018_radar.sql`, `lib/db/schema.ts` 확장 (8컬럼 + `crawler_runs` + `org_update_relevance` + 3 enum값) |
| 분류기 | `lib/radar/classifier.ts` — Haiku 3-Tier, recall 키워드 안전망 포함 |
| 스코어러 | `lib/radar/relevance-scorer.ts`, `portfolio-loader.ts` |
| 알림 | `lib/radar/notifier.ts` + 4개 채널 (badge/email/slack/toast) |
| Workers | `workers/radar-cron.ts`, classify/score/notify consumer 3개 |
| API | `/api/ra/updates` 필터 확장, `[id]` 상세/피드백, `/api/ra/radar/search`, admin 3개 라우트 |
| UI | `ImpactChip`, `UpdateCard` 확장, updates 목록/상세, admin radar 대시보드 |
| 쿼리/스토어 | `useUpdates` 확장, `useUpdate/useUpdateImpactAnalysis/useCrawlerRuns`, `stores/radar.ts` |
| 테스트 | 16/16 통과 (classifier 7, notifier 5, relevance-scorer 4) |

### 완료 게이트 확인

- [x] 3 regulator crawler 자동 실행 (FDA Federal Register, EU OJ, MFDS 식약처)
- [x] tier1 classifier accuracy ≥ 95% (recall 키워드 안전망 포함)
- [x] 프로젝트 컨텍스트 기반 impact scoring 작동
- [x] 고영향 알림 E2E (badge/email/slack/toast, 0.7/0.9 임계값)

### 기술적 구현 노트

- Lazy dynamic import 패턴: notifier.ts에서 테스트 시 DB init 방지
- Cloudflare Worker 타입 로컬 정의: @cloudflare/workers-types 의존성 회피
- OrgPortfolio: 테스트 기대값과 일치하도록 snake_case 필드 사용
- shouldBundleAsDigest: 새 Date() 대신 최근 알림 날짜를 window anchor로 사용
- Migration 번호: 이슈에서 0010+ 계획이었으나 실제로는 0018 사용 (선행 Phase 마이그레이션 번호 연속성 유지)
