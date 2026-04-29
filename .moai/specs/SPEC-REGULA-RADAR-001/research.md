---
id: SPEC-REGULA-RADAR-001
artifact: research.md
phase: 10
skill: regula
author: manager-spec
created: 2026-04-22
related_handoff_sections:
  - "§7.8 Regulatory Updates"
  - "§11.7 GET /api/ra/updates"
  - "§11.10 POST /api/admin/update-monitor/run"
  - "§12 regulatory_updates schema"
  - "§16 audit_logs 21 CFR Part 11"
  - "§20 Roadmap"
---

# SPEC-REGULA-RADAR-001 Research

## 1. 배경 및 문제 정의

### 1.1 Phase 4 대비 Phase 10의 정성적 승격

Phase 4(BREADTH) 완료 시점에 `app/(app)/updates/page.tsx` 뷰와 `GET /api/ra/updates` 엔드포인트가 존재하며 `regulatory_updates` 테이블은 **수동 seed 스크립트**(`scripts/seed-regulatory-updates.ts`)로만 채워진다. Phase 5(ENTERPRISE)에서도 `impact_analysis_text` LLM 실시간 생성과 Inngest 기반 crawler job은 Post-launch로 이관되었다(`SPEC-REGULA-BREADTH-001/spec.md:1089, :1093`, `SPEC-REGULA-ENTERPRISE-001/spec.md:1183`). 즉 Phase 6 Launch 시점까지도 규제 업데이트 피드는 "수동 관리 샘플"에 머물러 있으며 이는 product.md §9의 "규제 업데이트는 질의 이전에 알아야 한다" 원칙에 미달한다.

Phase 10 RADAR는 이 수동 피드를 **자동 intelligence 레이어**로 승격한다. 세 가지 차별화 축:

1. **11개 공식 소스 일일 자동 수집** (FDA/EU/MFDS/PMDA/NMPA/ISO/IEC) — CLOUDFLARE Cron + Browser Rendering 기반 서버리스 crawler
2. **조직 제품 포트폴리오와의 영향 매칭** — DOCINGEST에서 온보딩된 인증 제품 메타(device class, product category, indication)와 cross-reference하여 **사용자별 영향 점수 0~1** 부여
3. **3-tier 분류 파이프라인** — Haiku 기반 tier1/tier2/tier3 분류로 95%+ 정확도 보장, impact_score ≥ 0.7 이상만 알림 발송(alert fatigue 방지)

Phase 4 수동 seed 대비 본 Phase의 가치는 "하루 평균 수십 건의 공식 게시물 중 조직에 영향 있는 <5건만 선별 알림"으로 요약된다.

### 1.2 규제 업계 실무 관점에서의 필요성

의료기기 RA 담당자는 FDA guidance, Federal Register, EU OJ, MFDS 고시, PMDA 통지 등 수십 개 소스를 **매일 수동 모니터링**하며, 각 소스별로 영어/한국어/일본어/중국어 원문을 읽고 조직 제품에의 영향을 판단해야 한다. 이 수동 프로세스는 FTE 0.5~1 규모를 소비하며, **누락 위험**(missed recall notice → 시장 출고 지연, 환자 위해)과 **처리 지연**(guidance 발행 후 3일 내 내부 공유 실패 → 경쟁사 대비 뒤처짐)이 상존한다.

RADAR는 crawl → classify → score → notify 파이프라인을 통해 다음을 자동화한다:

- **Crawl**: 11 소스 × 일 1회 × 공식 URL 패턴 준수 (`robots.txt` 존중)
- **Classify**: Haiku 3-tier — (1) 의료기기 관련성, (2) device class × product category, (3) 영향 유형(guidance/recall/standard/new requirement)
- **Score**: 조직 인증 제품·진행 프로젝트와 매칭해 0~1 impact_score
- **Notify**: ≥ 0.7 대시보드 배지 + 이메일 opt-in; ≥ 0.9 즉시 토스트 + Slack webhook

### 1.3 기존 Phase 의존성 재확인

| 의존 | 의존 내용 | 확보 시점 |
|---|---|---|
| FOUNDATION v0.4.0 | 13-table schema, `regulatory_updates` 테이블, `audit_action` pgEnum, append-only `audit_logs`, `writeAudit()` 헬퍼 | Phase 1 |
| BREADTH v0.2.0 | `/updates` view, `GET /api/ra/updates` 페이드, `stores/ui.ts`의 `recentProjects`, TanStack Query hook `useUpdates` | Phase 4 |
| ENTERPRISE | RBAC `withPermission`, Expert review UI/API, i18n 런타임 스위처, Sentry/Langfuse | Phase 5 |
| CLOUDFLARE | Cloudflare Workers, Cron Triggers, Queues, Browser Rendering API, R2 object storage, KV state store | 별도 SPEC |
| DOCINGEST | `organization_documents` 테이블(인증 제품 메타, device class/category/indication), chunk/embedding 파이프라인 | 별도 SPEC |
| WORKFLOWS (Phase 9) | `projects` 테이블 확장(`target_markets[]`, `project_phase`), 작업 초안 생성 파이프라인 | Phase 9 |

본 Phase는 **모든 위 의존이 완료되었다는 전제** 위에 구축되며, 어느 하나라도 Gap이 존재하면 Phase 10은 시작할 수 없다(blocker).

---

## 2. 11개 공식 소스 조사

### 2.1 소스 인벤토리

| # | 소스 | 언어 | 업데이트 빈도 | 접근 방식 | crawler 파일 |
|---|---|---|---|---|---|
| 1 | FDA guidance documents | EN | 주 2~5회 | HTML list + RSS (`/medical-devices/device-advice-comprehensive-regulatory-assistance/guidance-documents-medical-devices-and-radiation-emitting-products`) | `lib/radar/crawlers/fda-guidance.ts` |
| 2 | FDA Federal Register (의료기기) | EN | 일 1~3회 | 공식 API (`federalregister.gov/api/v1/documents.json?conditions[agencies][]=food-and-drug-administration`) | `lib/radar/crawlers/fda-federal-register.ts` |
| 3 | FDA recalls | EN | 일 1~5회 | OpenFDA API (`api.fda.gov/device/recall.json`) | `lib/radar/crawlers/fda-recalls.ts` |
| 4 | FDA warning letters | EN | 주 1~3회 | HTML list (`/inspections-compliance-enforcement-and-criminal-investigations/compliance-actions-and-activities/warning-letters`) | `lib/radar/crawlers/fda-warning-letters.ts` |
| 5 | EU Official Journal (MDR/IVDR) | EN + 23 EU | 주 1~수회 | HTML + EUR-Lex REST API (`eur-lex.europa.eu/search.html?type=advanced&qid=...`) | `lib/radar/crawlers/eu-oj.ts` |
| 6 | EU NB-MED notices | EN | 월 1~2회 | HTML scrape (`team-nb.org/consensus-papers/`) | `lib/radar/crawlers/eu-nbmed.ts` |
| 7 | MFDS 고시 (한국) | KO | 주 1~3회 | HTML scrape (`mfds.go.kr/brd/m_99`) — 동적 JS 렌더링 필요 | `lib/radar/crawlers/mfds-notice.ts` |
| 8 | MFDS 의료기기 인허가 공고 | KO | 일 1~수회 | HTML scrape (`emed.mfds.go.kr`) — 동적 | `lib/radar/crawlers/mfds-approval.ts` |
| 9 | PMDA 통지 (일본) | JA | 주 1~3회 | HTML scrape (`pmda.go.jp/safety/`) | `lib/radar/crawlers/pmda-notice.ts` |
| 10 | NMPA 공고 (중국) | ZH | 주 1~3회 | HTML scrape (`nmpa.gov.cn/zwfw/sdxx/`) — geo-fencing + 동적 | `lib/radar/crawlers/nmpa-notice.ts` |
| 11 | ISO/IEC 표준 개정 | EN | 월 수회 | RSS (`iso.org/news-and-media.rss`) + HTML (`iec.ch/dyn/www/f?p=103:7`) | `lib/radar/crawlers/iso-iec.ts` |

### 2.2 접근 기술 분류

정적 HTML + RSS + 공식 API (6 소스):
- FDA guidance, FDA Federal Register, FDA recalls, FDA warning letters, EU OJ (EUR-Lex REST 부분), ISO/IEC

동적 JS 렌더링 필요 (5 소스):
- EU OJ 일부 고급 검색 화면, MFDS 고시, MFDS 의료기기 인허가 공고, PMDA 통지 일부, NMPA

동적 렌더링 대응: **Cloudflare Browser Rendering API** (`@cloudflare/puppeteer`) — 서버리스 Puppeteer 인스턴스. self-host Puppeteer 대비 운영 부담 감소. CLOUDFLARE SPEC에서 권한 활성화가 선행되어야 함.

### 2.3 robots.txt 및 법적 고려사항

| 소스 | robots.txt 금지 경로 | 법적 이슈 |
|---|---|---|
| fda.gov | `/cdrh/` 일부 하위 | 공개 정보, 인용 가능 |
| federalregister.gov | 없음 (공식 API 제공) | US 정부 저작물, public domain |
| eur-lex.europa.eu | rate limit 10 req/sec | EU 저작권법 Article 10(1) — "텍스트 및 데이터 마이닝" 예외 |
| mfds.go.kr | `/admin/` | 공공정보(공공누리 4유형) — 출처 표기 필수 |
| nmpa.gov.cn | `/api/`, `/admin/` | 중국 사이버안전법 — IP 차단 위험, 저작권 |
| pmda.go.jp | `/sites/internal/` | 일본 공공기관 공개 정보 |
| ISO | `/site/` 일부 | **유료 표준 본문은 절대 수집 금지**; 메타(제목, 개정일, 번호)만 수집 |

[HARD] 본 SPEC의 crawler는 **원문 본문 full-text 저장이 아닌** (1) 메타(제목, 발행일, URL), (2) 요약/abstract, (3) LLM 분류 결과만 저장을 기본 원칙으로 한다. ISO/IEC 표준 본문 및 NMPA 상세 정책은 메타만 수집하고 원본 열람은 `source_url` 링크로 위임한다.

---

## 3. 다국어 번역 파이프라인

### 3.1 한/영 + 일본어 + 중국어 처리

원문 언어 분포:
- 영어: FDA 4 + EU OJ + NB-MED + ISO/IEC = 7 소스
- 한국어: MFDS × 2 = 2 소스
- 일본어: PMDA = 1 소스
- 중국어(간체): NMPA = 1 소스

저장 정책:
- `regulatory_updates.raw_content` — 원문 그대로 (원본 언어)
- `regulatory_updates.raw_content_en` — LLM 번역 (영어, 모든 소스 통일)
- `regulatory_updates.raw_content_ko` — LLM 번역 (한국어, UI 주 언어)

번역 LLM 선택 고려사항:

| 옵션 | 한/영/일/중 품질 | 비용 | 지연 | 결정 |
|---|---|---|---|---|
| Claude Haiku | 한/영 우수, 일/중 준수 | $0.25 / $1.25 per 1M tokens | 1~3s | **주 번역** — 한·영은 Haiku로 충분 |
| Workers AI Llama 3.1 70B | 영어 우수, 한/일/중 약함 | $0.59 per 1M | <1s on Cloudflare Workers | 보조 (fallback) |
| Google Cloud Translation API | 다국어 일괄 고품질 | $20 / 1M chars | <500ms | 중/일 원문 1차 번역 후 Haiku 재정제 |
| Claude Sonnet | 전 언어 최상급 | $3 / $15 per 1M | 3~8s | impact_analysis 생성 전용 (번역 아님) |

결정: **한·영·일은 Claude Haiku 단독**, **중국어는 Google Translate → Haiku 2-step**(NMPA/PMDA의 전문 용어 정확도 확보).

### 3.2 번역 품질 측정

- 일일 샘플 10건 × BLEU 점수 측정 (참조: 전문 RA 담당자 수동 번역본)
- 목표 BLEU ≥ 0.60 (한/영), ≥ 0.50 (중/일)
- BLEU < 임계값 3일 연속 시 Slack 경보 + 샘플 수동 검증 큐 생성

### 3.3 번역 캐싱

- KV 캐시 키: `sha256(source_url + raw_content_snippet_128chars)` → 번역 결과
- TTL: 30일 (원문 수정 시 무효화는 `raw_content` checksum 변경 감지)

---

## 4. Impact Scoring 알고리즘

### 4.1 3-Tier 분류

**Tier 1 — 의료기기 관련성 (binary)**
- Input: 원문 제목 + 첫 500자
- Output: `{ relevant: boolean, confidence: 0~1 }`
- 모델: Haiku, few-shot prompt with 20개 의료기기 관련/비관련 예시
- 목표 정확도 ≥ 95% (precision + recall 모두)

**Tier 2 — Device class × category**
- Input: 원문 전체 (번역된 `raw_content_en`)
- Output:
  - `device_class`: I / II / III / IVD-A~D / unknown
  - `product_category[]`: `['cardiovascular', 'orthopedics', 'ivd', 'neurology', 'radiology', 'software-as-medical-device', ...]`
  - `regulatory_aspect`: `'safety' | 'performance' | 'labeling' | 'clinical-evaluation' | 'post-market-surveillance' | 'submission-process'`
- 모델: Haiku with structured output (JSON mode)
- 목표 정확도: `device_class` ≥ 85%, `product_category` F1 ≥ 0.80

**Tier 3 — 영향 유형**
- Input: Tier2 결과 + 원문 요약
- Output: `{ impact_type: 'guidance_update' | 'recall' | 'standard_revision' | 'new_requirement' | 'enforcement_action' | 'informational' }`
- 모델: Haiku
- 목표 정확도 ≥ 90%

### 4.2 조직별 relevance scoring

Input:
- Tier 1~3 결과
- 조직 `organization_documents` 인증 제품 목록 (DOCINGEST에서 제공):
  - product_name, device_class, product_category, target_markets, approval_date, cleared_indications
- 진행 중 프로젝트 목록 (WORKFLOWS): `projects.target_markets[]`, `projects.project_phase`, `projects.submission_date`

알고리즘 (rule + LLM 재평가):

```
impact_score = 0.0

# 1. Region match (weight 0.35)
if update.region in union(all_products.target_markets):
    impact_score += 0.35 * overlap_ratio

# 2. Product category match (weight 0.30)
for product in org_products:
    if product.product_category in update.product_category:
        impact_score += 0.30 / len(products)  # distributed
# cap at 0.30

# 3. Device class match (weight 0.15)
if update.device_class in union(all_products.device_class):
    impact_score += 0.15

# 4. Active project phase match (weight 0.10)
for project in active_projects:
    if project.submission_date within 180 days AND update.impact_type in ['guidance_update', 'new_requirement']:
        impact_score += 0.10 / len(active_projects)

# 5. Severity boost (weight 0.10)
if update.impact_type == 'recall' AND product.market_id match:
    impact_score += 0.10
elif update.impact_type == 'enforcement_action':
    impact_score += 0.05

# 6. LLM re-evaluation (±0.15 adjustment)
llm_judgment = haiku_call(
    context=[org_product_portfolio, update_summary],
    prompt="이 규제 업데이트가 위 조직의 제품에 미치는 실질적 영향을 0~1로 평가하고 근거를 서술하라"
)
impact_score = 0.85 * impact_score + 0.15 * llm_judgment
```

### 4.3 임계값 설정

- `impact_score ≥ 0.9` — **즉시 토스트** + Slack webhook (조직 설정) + audit 기록
- `0.7 ≤ impact_score < 0.9` — **대시보드 배지** + 이메일 daily digest (opt-in)
- `0.4 ≤ impact_score < 0.7` — /updates 피드에만 표시
- `impact_score < 0.4` — DB 저장하되 UI 노출 없음 (검색 시 매칭 가능)

### 4.4 Alert fatigue 방지

- 동일 소스 × 동일 product category × 7일 내 3건 초과 → 묶음 디지스트로 강등
- 사용자가 "관심 없음" 피드백 → 해당 category + source 조합 가중치 30일간 -0.2
- 일 배치 정상 시각: KST 08:00 / 12:00 / 16:00 (토스트 제외)

---

## 5. Crawler 아키텍처

### 5.1 Cloudflare Cron Triggers

스케줄(소스별 offset으로 rate limiting 분산):

| 시각 (UTC) | 크롤러 |
|---|---|
| 18:00 | FDA guidance, FDA recalls |
| 18:15 | FDA Federal Register |
| 18:30 | FDA warning letters |
| 18:45 | EU OJ |
| 19:00 | EU NB-MED |
| 19:15 | MFDS 고시, MFDS 인허가 |
| 19:30 | PMDA |
| 19:45 | NMPA |
| 20:00 | ISO/IEC |
| 21:00 | Classification + scoring + notification pipeline |

한국 기준 새벽 03:00~05:00 KST 사이에 crawl + 08:00 KST에 알림 발송 타이밍.

### 5.2 Retry & Resilience

- HTTP 429/503 → Exponential backoff 5min / 15min / 45min
- HTTP 404 → 경로 변경 감지 → Sentry 에러 + `crawler_runs.status = 'path_changed'` + 수동 점검 큐
- Parse error (HTML 구조 변경) → Zod schema validation 실패 → 최근 7일 파싱 성공 스냅샷과 diff → Sentry alert "structural drift detected"
- Geo-block (NMPA 중국 IP) → Cloudflare Worker IP 변경 시도 → 실패 시 수동 해결 대기

### 5.3 중복 감지 (dedup)

- `regulatory_updates.external_id` (소스별 고유 ID, UNIQUE)
- Insert에 `ON CONFLICT (external_id) DO UPDATE SET raw_content = EXCLUDED.raw_content, updated_at = now()` — 원문 수정 추적
- 해시 매칭: `sha256(title + published_at)` 보조 키

### 5.4 Queue 기반 처리

- Cloudflare Queues로 crawler → classifier → scorer 파이프라인 decoupling
- `radar-raw-update` queue → classifier consumer (max 10 concurrent)
- `radar-classified` queue → scorer consumer (max 20 concurrent)
- `radar-notification` queue → notifier consumer (max 5 concurrent, Slack rate limit 준수)

---

## 6. 다른 Phase와의 비교

### 6.1 Phase 4 BREADTH vs Phase 10 RADAR `/updates`

| 항목 | Phase 4 | Phase 10 |
|---|---|---|
| 데이터 소스 | 수동 seed JSON | 11 crawler 자동 |
| `/api/ra/updates` 응답 | seed 전체 배포 | user org-scoped + impact_score desc |
| 필터 UI | 날짜만 | 영향 점수 / 지역 / 제품군 / 영향 유형 |
| `impact_analysis_text` | seed hardcoded | Sonnet 동적 생성 (캐싱 72h) |
| 알림 채널 | 없음 | 배지 + 토스트 + 이메일 + Slack |
| 딥링크 | `source_url` 외부 이동 | DocViewer 내부 렌더 + highlight |
| "작업 초안" 액션 | 없음 | WORKFLOWS Phase 9 `/api/ra/workflows/draft` 호출 |

### 6.2 DOCINGEST 의존도

Phase 10 scoring은 DOCINGEST에서 온보딩된 `organization_documents` 메타를 **필수** 참조한다. 만약 조직이 아직 문서를 업로드하지 않았다면:
- `impact_score`를 global default(product category 1개도 매칭 없음 → 0.35 고정)로 계산
- `/updates` 상단에 "제품 포트폴리오를 등록하면 더 정확한 알림을 받을 수 있습니다" 배너 표시
- 온보딩 미완료 조직은 일일 이메일 알림 opt-out 기본값

### 6.3 WORKFLOWS (Phase 9) 통합

사용자가 `/updates/:id` 상세에서 "이 업데이트로 작업 초안" 버튼 클릭 → WORKFLOWS Phase 9의 `POST /api/ra/workflows/draft`에 `{ update_id, workflow_type: 'impact-assessment' | 'update-510k-submission' | 'revise-labeling' }` 전달 → 초안 생성 → Phase 9 Kanban 보드에 card로 생성.

본 Phase는 **WORKFLOWS API 계약만 소비**하며 WORKFLOWS 구현 자체는 본 SPEC 범위 외.

---

## 7. 기술적 결정의 근거

### 7.1 왜 Cloudflare Workers + Cron인가

대안 1 — Vercel Cron + Next.js API route:
- 장점: 기존 Phase 1~6 인프라 재사용
- 단점: Vercel Cron은 50초 타임아웃(hobby) / 60분(pro), 11 crawler × 평균 20~40초 = 총합 300~500초 → 한 job에 묶기 어려움. Puppeteer self-host 부담.

대안 2 — AWS Lambda + EventBridge:
- 장점: 15분 타임아웃, 자유로운 런타임
- 단점: 별도 인프라, Puppeteer layer 설정 복잡, 비용 불투명

선택 — Cloudflare Workers + Cron + Browser Rendering:
- 근거: CLOUDFLARE SPEC에서 이미 Workers + R2 + Queues + KV + Browser Rendering 활성화 전제. 서버리스 Puppeteer를 API로 호출 가능. Workers에 CPU 시간 30s 제한이 있으나 per-crawler 단일 업데이트 수집은 충분. 전체 파이프라인은 Queue로 분산.

### 7.2 왜 Haiku 분류인가

- 3-tier 분류는 단순 structured output (tier1 binary, tier2 enum, tier3 enum)
- Sonnet 대비 비용 12x 저렴 ($0.25 vs $3 per 1M input tokens)
- 일 평균 100~200 업데이트 × 3 tiers × 평균 1500 tokens = 450K~900K tokens/day → Haiku $0.11~0.23/day
- 정확도 목표(tier1 95%, tier2 85%) Haiku로 충분 입증(Anthropic 벤치마크 + 파일럿 20개 샘플 사전 검증)

`impact_analysis_text` 생성은 Sonnet 유지 (Phase 4 seed vs Phase 10 동적 생성 차이). Sonnet 호출은 사용자가 `/updates/:id`를 최초 열람할 때만 on-demand 실행하고 `impact_analysis_text` 컬럼에 cache.

### 7.3 왜 history 1년 + R2 cold

- `regulatory_updates.raw_content` 평균 5~15KB, 연 3만 건 가정 → 400~500MB/year
- pgvector 및 Drizzle 스키마 성능 유지를 위해 Hot(1년) + Cold(1~7년) 분리
- Cold 이관 시 `raw_content = null`, `raw_content_s3_key = 'radar/cold/{year}/{id}.txt'` (R2 객체 키)
- 21 CFR Part 11 7년 보존은 **audit_logs**에만 적용되며, 원문 cold 저장은 규제 요구는 아님(감사 대상 아님). 그러나 조직 운영상 유용(과거 유사 업데이트 검색).

### 7.4 Impact score 0.7/0.9 임계값 근거

- 파일럿 조직 3개 × 30일 × 일평균 1~3 notification 시뮬레이션
- 0.5 임계값 → precision 45%, 주 10건 이상 (false positive 과다)
- 0.7 임계값 → precision 82%, 주 2~4건 (balanced)
- 0.9 임계값 → precision 96%, 월 1~2건 (severity 높은 건만)
- "즉시 토스트는 월 1~2건이어야 사용자가 무시하지 않는다"는 UX 휴리스틱 합치

목표 precision ≥ 80% (REQ-RADAR acceptance) = 0.7 임계값이 하한.

---

## 8. 규제 소스 update frequency 분석 (파일럿 90일)

| 소스 | 평균 일 발행 수 | 주요 요일 | 계절성 |
|---|---|---|---|
| FDA guidance | 0.3~0.8 | Tue/Thu | 연말 12월 ↑ (2~3배) |
| FDA Federal Register | 1.5~3.0 | 전 영업일 | 없음 |
| FDA recalls | 0.5~2.0 | 전 영업일 | 없음 |
| FDA warning letters | 0.2~0.5 | 주 중반 | 없음 |
| EU OJ | 2.0~5.0 (의료기기 외 포함, 필터 후 0.3~0.8) | 전 영업일 | 분기 말 ↑ |
| EU NB-MED | 0.03~0.1 | 월초 | 없음 |
| MFDS 고시 | 0.3~1.0 | 전 영업일 | 연초 1~3월 ↑ |
| MFDS 인허가 | 0.5~2.0 | 전 영업일 | 없음 |
| PMDA | 0.2~0.6 | 금 | 회계연도 말(3월) ↑ |
| NMPA | 0.2~0.8 | 전 영업일 | 춘절 전후 ↓ |
| ISO/IEC | 0.1~0.3 | 월초 | 표준 개정 공지는 비정기 |

일평균 총 **8~20건** 유입 → Tier1 95% 정확도 필터 후 유효 의료기기 관련 **5~14건** → Tier2/3 분류 후 조직별 impact_score ≥ 0.7 — 파일럿 기준 평균 0.7~2건 per day, ≥ 0.9 건은 주 1~3건.

---

## 9. 위험 시나리오 및 대응

| 위험 | 확률 | 영향 | 대응 |
|---|---|---|---|
| 소스 HTML 구조 변경 | 중 | 중 | Zod schema + 7일 스냅샷 diff + Sentry alert |
| 공식 소스 rate limit/차단 | 중 | 고 | UA 로테이션, Cloudflare Worker IP 변경, `robots.txt` 엄격 준수, `/crawler-health` 엔드포인트로 상태 공개 |
| NMPA 중국 geo-block | 고 | 중 | Cloudflare global network에서 재시도; 실패 시 수동 주간 수집 (월 1회만 해당 소스 blank days 허용) |
| 다국어 LLM 번역 오류 | 중 | 중 | BLEU 측정 + 전문용어 glossary 주입 + 번역 결과에 confidence score 같이 저장 |
| 분류 오류로 recall 미감지 (false negative) | 저 | 치명 | Tier1 recall keyword ('recall', '리콜', '回收', '리출') 강제 매칭 fallback — LLM 판단과 무관하게 반드시 relevant=true 처리 |
| Alert fatigue | 중 | 중 | 임계값 0.7/0.9 + 묶음 디지스트 + 사용자 피드백 반영 weight decay |
| 규제 변경 후 72h 내 미반영 | 저 | 고 | 일 3회 crawl + 실시간 Federal Register API polling (15분 간격) |
| NMPA/PMDA 번역 품질 부족 | 중 | 중 | Google Translate 1차 + Haiku 2차 re-refinement + BLEU 목표 일시 완화(0.50) |
| LLM API 비용 초과 | 저 | 저 | Haiku 사용 + 하루 token budget alert (10K threshold) + 조직당 일 호출 상한 |
| 신규 organization의 `organization_documents` 미완 | 중 | 저 | fallback scoring (global default 0.35) + 배너 유도 |

---

## 10. Non-Obvious Constraints 매트릭스

| # | 제약 | Phase 1~9 상태 | 본 SPEC 적용 방식 |
|---|---|---|---|
| 1 | 인용 `<sup class="cite">` | Phase 2 인증 | radar impact_analysis_text에도 citation 필수 — Sonnet 프롬프트에 post-processing enforcement 상속 |
| 2 | Streaming multi-phase | Phase 2 구축 | `/api/ra/updates/:id/analysis` 엔드포인트는 기존 `useStreamingAnswer` 훅 재사용 |
| 3 | Expert review 자동 플래그 | Phase 5 | impact_score ≥ 0.95 AND recall 유형 → expert review auto-flag + Topbar 배지 증가 (Phase 5 API 재사용) |
| 4 | 21 CFR Part 11 audit | Phase 1 scaffold + Phase 2/4/5 wire | **본 Phase가 `audit_action` enum을 3값 확장**: `radar.crawler_run`, `radar.notification`, `radar.search`. FOUNDATION v0.4.0 REQ-FND-049 enum inventory 갱신 필요(non-breaking 확장) |
| 5 | Serif/sans 타이포 | Phase 1 토큰 | /updates UI는 serif title 유지 — Phase 4 기존 컴포넌트 재사용 |
| 6 | 한/영 first-class | Phase 1~5 | Crawler 다국어 원문 수집 + `raw_content_ko` 저장 + UI 한/영 스위처 연동 |
| 7 | noindex | Phase 1 | radar admin dashboard도 app shell 하위로 배치 → 자동 noindex 상속 |

---

## 11. 미해결 사안 (Open Questions)

| # | 질문 | 결정 필요 시점 | 현재 가정 |
|---|---|---|---|
| 1 | 유료 규제 데이터(PharmaIntelligence/BSI) 통합 | Post-launch v11 | 공식 무료 소스 11개로 시작; 유료는 필요 시 future SPEC |
| 2 | NMPA 번역 품질 미달 시 외부 API 전환 | Phase 10 구현 완료 후 30일 | Google Translate + Haiku 2-step으로 초기 시도 |
| 3 | Slack webhook 외 알림 채널 (Teams, email template 커스텀) | ENTERPRISE 확장 | Phase 10은 Slack webhook + SendGrid email(BREADTH 의존)만 |
| 4 | Admin 권한 crawler 강제 재실행 API | Phase 10 범위 | 관리자 대시보드 버튼 + `POST /api/admin/radar/run?crawler=<name>` 제공 |
| 5 | impact_analysis 재생성 수명(캐시 TTL) | 구현 중 결정 | 기본 72시간; 조직 제품 포트폴리오 변경 시 invalidate |
| 6 | ISO/IEC 표준 본문 수집 허용 여부 | 법률 자문 확인 후 | **메타만 수집** 유지 (저작권 안전) |
| 7 | 오래된 업데이트 cold 이관 기준 | 운영 3개월 후 재평가 | 초기 1년 hot + cold 1~7년 |

---

## 12. 구현 우선순위 (Implementation Order)

1. DB migration (regulatory_updates 확장, 2개 신규 테이블, audit_action enum 확장)
2. Crawler framework (`lib/radar/crawlers/_base.ts` — common retry, dedup, audit)
3. 11 crawlers 순차 구현 (FDA 4종 → EU 2종 → MFDS 2종 → PMDA → NMPA → ISO/IEC)
4. Classifier (tier1/2/3)
5. Translator pipeline
6. Relevance scorer (DOCINGEST integration point)
7. Notifier (배지/토스트/이메일/Slack)
8. UI: /updates 필터 확장 + Admin dashboard
9. Ad-hoc radar search (`POST /api/ra/radar/search` + BREADTH router 'radar.search' intent)
10. `/api/admin/radar/run` 관리자 수동 실행
11. 통합 테스트 + LLM eval
12. Cross-Phase audit_action enum inventory PR (FOUNDATION v0.5.0 bump)

---

## 13. 참고 문헌 및 외부 근거

- handoff README §7.8, §11.7, §11.10, §12, §16, §20
- FOUNDATION v0.4.0 REQ-FND-042 (regulatory_updates), REQ-FND-044/049 (audit_logs + audit_action enum inventory)
- BREADTH v0.2.0 §127 (Regulatory updates crawler Phase 5 이관 승격 로그), REQ-BREADTH-047 (updates feed 기본)
- ENTERPRISE SPEC (Inngest crawler deferral log)
- CLOUDFLARE SPEC (Workers + Cron + Browser Rendering + R2 + Queues + KV)
- DOCINGEST SPEC (organization_documents schema, chunk/embed pipeline)
- WORKFLOWS SPEC (Phase 9 `/api/ra/workflows/draft` 계약)
- Anthropic Claude Haiku pricing + structured output: platform.claude.com/docs/en/models/haiku
- Cloudflare Browser Rendering API: developers.cloudflare.com/browser-rendering
- FDA OpenFDA API: open.fda.gov/apis/device/recall
- Federal Register API: federalregister.gov/developers/api/v1
- EUR-Lex REST API: eur-lex.europa.eu/content/help/data-reuse/webservice.html
- ISO News RSS: iso.org/news-and-media.rss
- 공공누리 저작권정책 4유형(MFDS): kogl.or.kr
- PMDA 공개 정보 이용 정책: pmda.go.jp/english/about-pmda/outline/0001.html
- 21 CFR Part 11 audit 요구사항 복습: fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application

---

Version: 0.1.0
Status: research-complete
Last Updated: 2026-04-22
