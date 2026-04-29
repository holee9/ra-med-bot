---
id: SPEC-REGULA-WORKFLOWS-001
title: Regula Phase 9 Advanced Regulatory Workflows — 510(k) Submission Drafter · Audit Response Drafter · Indication Impact Analyzer
status: draft
created: 2026-04-22
updated: 2026-04-22
author: manager-spec
phase: 9
skill: regula
version: 0.1.0
priority: High
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-CHAT-001 (v0.2.0+)
  - SPEC-REGULA-STRUCTURED-001 (v0.2.0+)
  - SPEC-REGULA-BREADTH-001 (v0.2.0+)
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0+)
  - SPEC-REGULA-LAUNCH-001 (v0.1.0+)
  - SPEC-REGULA-CLOUDFLARE-001 (Phase 7, 병렬 — Cloudflare Workflows runtime)
  - SPEC-REGULA-DOCINGEST-001 (Phase 8, 병렬 — 조직 문서 corpus)
related_handoff_sections:
  - "§11.2"
  - "§11.9"
  - "§16"
  - "§19"
  - "§20"
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial draft (Phase 9 Advanced Regulatory Workflows).
      68 REQ-WF across 5 groups (A Submission Drafter / B Audit Response /
      C Indication Impact / D Common Infrastructure / E UI).
      6 technical decisions (Cloudflare Workflows runtime, Sonnet+Haiku model mix,
      FDA Open API + Vectorize predicate finder, Markdown→MDX→PDF pipeline,
      review gate server-side enforcement, workflow_runs persistence).
      New table: workflow_runs (14th table, +2 pgEnum workflow_type/status).
      audit_action pgEnum 확장 — Phase 9 10 actions 선제 등록 필요
      (FOUNDATION REQ-FND-049 inventory table).
      Depends on Phase 7 CLOUDFLARE Workflows runtime and Phase 8 DOCINGEST
      organization corpus. All workflows enforce review_required=true regardless
      of confidence (제약 #3 원칙 준수). All draft outputs carry Part 11
      disclaimer. 100% citation coverage enforced on draft body.
---

# SPEC-REGULA-WORKFLOWS-001 — Regula Phase 9 Advanced Regulatory Workflows

## 목적 (Purpose)

Regula의 Phase 1~8에서 축적된 규제 지식 인프라(13-table schema, append-only audit_logs, citation enforcement, structured blocks, expert-review 큐, RBAC, Cloudflare Workflows 런타임, 조직 문서 corpus)를 조합하여, 의료기기 RA 전문가의 **고부가가치 업무 3종**을 AI-보조 워크플로우로 자동화한다:

1. **510(k) / CE MDR Technical Documentation Draft Generator** — 21 CFR 807.87 20 sections 및 EU MDR Annex II + Annex I GSPR 23-checklist 구조에 정렬된 제출 서류 초안 생성. Predicate 검색(FDA openFDA API + Vectorize rerank) + subject vs predicate 비교표 + gap analysis + section-별 draft + review checklist.
2. **FDA 483 / EU NB-MED 감사 지적사항 응답 초안 생성기** — FDA Form 483 또는 EU Notified Body deficiency letter를 입력 받아 observation 파싱 → root cause + CAPA(Corrective And Preventive Action) 7-field draft + 조직 과거 response + 공개 warning letter response 유사 precedent 검색 + 법무 검토 필요 구간 highlight.
3. **Indication Use 변경 영향 분석기** — 현재 indication과 확장 indication을 입력 받아 (a) FDA pathway tree (510(k) / De Novo / PMA / Letter to File) 결정, (b) 추가 필요 데이터(bench / animal / clinical) 예상, (c) 5 jurisdiction 동시 전략 비교표(US/EU/KR/JP/CN) 생성.

본 Phase는 Phase 1~5(코어 챗봇)와 Phase 7 CLOUDFLARE(Workflows runtime) + Phase 8 DOCINGEST(조직 corpus)의 완결을 전제로 하며, 완전 자동 제출(FDA ESG 업로드)·전자서명·eCTD 변환은 **명시적으로 scope 외**로 남겨 법적·절차적 복잡성과 인간 최종 승인 구조를 유지한다.

본 Phase가 활성화하는 Non-Obvious Product Constraints:
- **제약 #3 Expert-review 자동 게이팅:** 모든 workflow 결과는 confidence 관계없이 `review_required=true` 강제 — 게이팅 우회 불가 (server-side enforcement)
- **제약 #4 Audit 완전성:** workflow 단계별 audit_logs 기록, 10개 신규 audit_action enum(workflow.start / step.complete / step.fail / pause / resume / pending_review / approve / reject / download / edit)
- **제약 #1 Citation 강제:** draft body 내 모든 규제 인용에 `<sup class="cite">` 강제 (CHAT의 post-processing 재사용)

---

## 범위 (Scope)

### In Scope

#### Workflow A — 510(k) Submission Drafter

| 구분 | 산출물 |
|---|---|
| API Route | `app/api/ra/workflows/draft-submission/route.ts` (POST — workflow 트리거), `app/api/ra/workflows/[runId]/events/route.ts` (SSE progress), `app/api/ra/workflows/[runId]/route.ts` (GET 결과), `app/api/ra/workflows/[runId]/download/route.ts` (PDF — review gate enforced) |
| Orchestrator | `lib/workflows/draft-submission/orchestrator.ts` — Cloudflare Workflows 인스턴스 생성, 20 steps 정의, step-level retry/backoff, state persistence |
| Predicate Finder | `lib/workflows/draft-submission/predicate-finder.ts` — openFDA 510(k) API 호출 (device name → product code → panel cascade), Vectorize FDA corpus rerank (indications for use 유사도), top-5 후보 반환 |
| Section Generators | `lib/workflows/draft-submission/section-generators/*.ts` — 20 section별 generator 모듈 (3/5/9/10/11/12/14/15/18 High Sonnet, 4/8/13/16/17/19 Medium Haiku→Sonnet fallback, 1/2/6/7/20 Low 템플릿) |
| Comparison Builder | `lib/workflows/draft-submission/comparison-builder.ts` — subject vs predicate 다차원 비교 (intended use, indications, technological characteristics, materials, performance), Phase 3 STRUCTURED `comparison` block 재사용 |
| Gap Analyzer | `lib/workflows/draft-submission/gap-analyzer.ts` — subject에 predicate 대비 누락·상이 차원 식별, section 별 review_required 플래그 결정 |
| EU Mode Adapter | `lib/workflows/draft-submission/eu-mode.ts` — `jurisdiction: 'EU'` 경로 시 Annex II + Annex I GSPR 23-row 체크리스트 생성 (MEDDEV 2.7/1 Rev4 CER 10 stages 참고) |

#### Workflow B — Audit Response Drafter

| 구분 | 산출물 |
|---|---|
| API Route | `app/api/ra/workflows/audit-response/route.ts` (POST), `app/api/ra/workflows/[runId]/events/route.ts` (공통), `app/api/ra/workflows/[runId]/route.ts` (공통) |
| Orchestrator | `lib/workflows/audit-response/orchestrator.ts` — observation 별 pipeline fan-out, 결과 aggregate |
| Observation Parser | `lib/workflows/audit-response/observation-parser.ts` — 입력 FDA 483 또는 MDSAP deficiency (PDF/텍스트) Haiku parser로 structured JSON 추출 (observation_number, text, cited_regulation, device_or_process_area, severity_estimate, keywords) |
| Regulatory Mapper | `lib/workflows/audit-response/regulatory-mapper.ts` — observation의 cited_regulation을 corpus(FDA 21 CFR 820 / EU MDR Annex) citation과 1:1 매핑, 규정 원문 snippet 주입 |
| CAPA Generator | `lib/workflows/audit-response/capa-generator.ts` — Sonnet 기반 7-field CAPA 초안 생성 (observation summary / root cause / immediate corrections / corrective actions / preventive actions / effectiveness verification / timeline + responsible) |
| Precedent Finder | `lib/workflows/audit-response/precedent-finder.ts` — 공개 FDA warning letter response corpus + 조직 DOCINGEST 문서에서 유사 response 검색, 문체 reference로 CAPA에 주입 |
| Legal Review Flagger | `lib/workflows/audit-response/legal-review-flagger.ts` — 자동 flag 조건(critical severity / admission of liability 어휘 / long timeline / Class III safety) 탐지, 해당 구간 UI highlight + expert_review 큐 연동 |

#### Workflow C — Indication Impact Analyzer

| 구분 | 산출물 |
|---|---|
| API Route | `app/api/ra/workflows/indication-impact/route.ts` (POST), 공통 events/result routes 재사용 |
| Orchestrator | `lib/workflows/indication-impact/orchestrator.ts` — pathway → data estimate → jurisdiction 3-step pipeline |
| Current State Analyzer | `lib/workflows/indication-impact/current-state-analyzer.ts` — project의 현재 DMR/510(k) 상태(product class, cleared indications, target markets)를 DOCINGEST corpus + FDA API로 재구성 |
| Pathway Tree | `lib/workflows/indication-impact/pathway-tree.ts` — 규칙 엔진 기반 decision tree (Chart A/B/C/D 코딩), LLM 아님 (determinism, auditability), FDA Guidance "Deciding When to Submit a 510(k) for a Change" 반영 |
| Additional Data Estimator | `lib/workflows/indication-impact/additional-data-estimator.ts` — 경로별 필요 데이터 heuristic (510(k) → bench/biocompat, De Novo → clinical likely, PMA → full clinical trial), 과거 SSED 요약 참조 |
| Jurisdiction Strategy | `lib/workflows/indication-impact/jurisdiction-strategy.ts` — US/EU/KR/JP/CN 5-jurisdiction 비교표 생성 (pathway, timeline estimate 범위, additional data, cost estimate 범위), Phase 3 `comparison` block 재사용 |

#### 공통 Infrastructure

| 구분 | 산출물 |
|---|---|
| Template Engine | `lib/workflows/common/template-engine.ts` — section skeleton(Markdown with placeholders) 렌더, placeholder 치환, MDX 컴포넌트 임베드 |
| Confidence Aggregator | `lib/workflows/common/confidence-aggregator.ts` — 여러 LLM step의 confidence 합성(weighted average + min floor), workflow_runs.confidence_aggregate 기록 |
| Human Handoff | `lib/workflows/common/human-handoff.ts` — 중간 검토 포인트 삽입 (각 High-impact section 종료 시 pause 가능), 사용자 resume 승인 |
| Review Queue | `lib/workflows/common/review-queue.ts` — ENTERPRISE expert_reviews 테이블 확장: `target_type='workflow_run'` + `target_id=workflow_runs.id`, 기존 큐 UI 재사용 |
| Workflow Types | `lib/workflows/types.ts` — Zod 스키마 공유 (WorkflowType, WorkflowStatus, WorkflowInput, WorkflowResult per type) |
| Citation Enforcer Extension | `lib/ai/citation-enforce.ts` 확장 (CHAT에서) — draft body 컨텍스트에도 적용, meta-whitelist 유지 |
| Workflow DB Schema | `lib/db/schema.ts` 확장 — `workflow_runs` 테이블(14th) + `workflow_type` / `workflow_status` pgEnum (2개 추가), `message_blocks.block_type` pgEnum에 `'workflow_result'` 값 추가, `audit_action` pgEnum에 Phase 9 10개 값 추가 |
| Migration | `migrations/0009_workflow_runs.sql` (가칭, 번호는 Phase 9 진입 시 확정) — 14th table create + pgEnum 확장 + block_type/audit_action ADD VALUE |
| Audit Wiring | workflow lifecycle 10개 이벤트에 `writeAudit()` 호출 (ENTERPRISE audit-completeness CI gate 통과) |

#### UI

| 구분 | 산출물 |
|---|---|
| Workflow Gallery | `app/(app)/workflows/page.tsx` — 3 workflow 진입 카드, 최근 실행 목록 |
| Submission Drafter UI | `app/(app)/workflows/draft-submission/page.tsx` — 입력 폼(제품명, predicate 후보 선택, device class, indications, jurisdiction) → 진행 상태 → 결과 미리보기 |
| Audit Response UI | `app/(app)/workflows/audit-response/page.tsx` — FDA 483 / MDSAP 파일 업로드 → observation 목록 → CAPA draft 리뷰 → legal flag 확인 |
| Indication Impact UI | `app/(app)/workflows/indication-impact/page.tsx` — 현재/확장 indication 입력 → pathway + additional data + 5-jurisdiction 표 표시 |
| Progress Steps | `components/workflows/ProgressSteps.tsx` — long-running 진행 표시 (step 1/20, current step name, elapsed time) |
| Draft Preview | `components/workflows/DraftPreview.tsx` — 생성된 draft Markdown/MDX 렌더, section 단위 편집, Part 11 disclaimer modal |
| Review Gate | `components/workflows/ReviewGate.tsx` — 'pending_review' 상태에서 reviewer action(approve/reject/request-change) UI, admin/ra-lead 전용 |
| Workflow Run History | `app/(app)/workflows/runs/page.tsx` — 사용자 실행 이력, 상태별 필터 |
| Message Block Renderer | `components/chat/blocks/WorkflowResultBlock.tsx` — 채팅 대화에 임베드된 `workflow_result` block 렌더 (compact summary + "전체 보기" 링크) |

### Out of Scope

| 항목 | 사유 |
|---|---|
| FDA ESG(Electronic Submissions Gateway) 직접 업로드 | 법적·절차적 복잡성. 인간 최종 승인 + eCopy/eSTAR 수동 제출 구조 유지 (post-launch 재평가) |
| DocuSign / Adobe Sign 전자서명 | 21 CFR Part 11 §11.50/§11.70 full compliance는 post-launch scope |
| EU eCTD (electronic Common Technical Document) 포맷 자동 변환 | 별도 SPEC 필요 (ICH eCTD v4 XML 복잡성) |
| 임상시험 프로토콜 자동 생성 | FDA IDE / EU CTR 영역, 별도 SPEC |
| PMA 전체 automation (Class III) | Workflow A는 510(k) + De Novo + EU MDR Tech Doc만 지원. PMA는 임상 데이터 요구 특성상 별도 SPEC |
| Workflow 결과의 FDA 513(g) Request for Information 자동화 | Product classification 요청은 Workflow D (후속 Phase) |
| 다국어 draft 생성 (ko 초안) | 초기 모드: en 전용. ko draft는 post-launch 확장 가능 |
| Watermark / 조직 브랜딩 PDF 커스텀 | Phase 9 기본 Puppeteer 템플릿만 제공, 커스터마이즈는 post-launch |
| Predicate finder가 2004년 이전 510(k) 커버 | openFDA API 커버리지 제약, PDF 스크래핑 경로 미제공 |
| PDF 직접 LLM 생성 | Markdown → MDX → PDF pipeline 강제 (편집 가능성 확보) |
| Workflow 결과의 실시간 collaboration (여러 reviewer 동시 수정) | 1 reviewer at-a-time lock 모델, multi-user collab은 post-launch |

---

## 기술 결정 (Technical Decisions)

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | Long-running runtime | **Cloudflare Workflows** (durable execution) | Inngest (SaaS), Temporal (자체 클러스터), Durable Objects(수동 orchestration) | CLOUDFLARE 생태계 통합(Phase 7 의존), step-level retry/backoff 내장, R2/KV state persist, free tier 충분 | Cloudflare Workflows Beta→GA 시점 이후에도 GA 지연 시 Durable Objects manual orchestration fallback |
| 2 | LLM 모델 mix | **Sonnet (복합 reasoning) + Haiku (parsing)** | Sonnet 전용 (비용 ~5x), Haiku 전용 (품질 불충분) | Observation parser / Low-Medium section은 Haiku로 비용·지연 절감, Gap analyzer / High section / CAPA generator는 Sonnet (deep reasoning 필요) | Submission draft 품질 eval rubric < 75% 시 High section 전량 Sonnet 재평가 |
| 3 | Predicate 검색 | **FDA openFDA API + Vectorize FDA corpus rerank** | Vectorize only (K-number 불확실), openFDA only (textual similarity 약함) | 공식 K-number 매칭 정확성(openFDA exact) + textual indications for use similarity(Vectorize) 양면 활용, top-5 후보 사용자 명시 선택 강제 | FDA API 변경(rate limit / schema) 시 Vectorize 전용 fallback + Type 경고 |
| 4 | 초안 출력 포맷 | **Markdown → MDX → PDF via Puppeteer** | Direct PDF (LLM → PDF), HTML 만 | 편집 가능성(DraftPreview), structured block(comparison/checklist) MDX 컴포넌트 임베드, Puppeteer headless PDF 표준 | PDF 요구사항 변경(VPAT/ADA 준수 등) 시 alternative renderer 평가 |
| 5 | 인간 검토 강제 | **모든 draft review_required=true (server-side enforcement)** | optional (confidence 기반 분기), client-side flag 만 | Part 11 safe harbor 확보, bypass 불가 원칙 유지, E&O 리스크 최소화 | 규제 완화 시 재평가 (post-launch) |
| 6 | 작업 상태 영속화 | **workflow_runs 신규 테이블 + Cloudflare Workflow instance binding** | in-memory only, audit_logs 에 직접 저장 | retry 지원(resume), audit + workflow 분리(append-only vs UPDATE 허용), reviewer lookup, 7-year retention | 테이블 row 수 10M 초과 시 파티셔닝 도입 (post-launch) |

**pgEnum / audit_action inventory 선제 등록 주의:**
- Phase 9는 FOUNDATION v0.4.0 REQ-FND-049 `audit_action` enum inventory table에 **Phase 9 10개 값이 선제 선언되어 있다고 가정**한다.
- 선언되어 있지 않은 경우 Phase 9 RUN 단계 착수 시 ALTER TYPE ADD VALUE 마이그레이션을 우선 실행한다(`migrations/00XX_workflow_audit_actions.sql`). FOUNDATION SPEC은 수정하지 않는다(master-roadmap §5.2 금지 원칙 준수).

---

## EARS 인수 기준 (Acceptance Criteria)

모든 요구사항은 `REQ-WF-NNN` ID로 식별하며, EARS 5개 패턴 중 적절한 형태로 기술한다. 모든 요구사항은 테스트 가능(testable)하다.

총 **68개 REQ-WF** (Group A: 20, Group B: 15, Group C: 13, Group D: 10, Group E: 10).

**EARS 패턴 분포:**
- Ubiquitous (The system SHALL ...): 40개 — 항상 참인 구조적 요구
- Event-driven (WHEN ... THEN ...): 14개 — workflow 트리거 / step completion
- Conditional (IF ... THEN ...): 9개 — 입력 상태 / jurisdiction / severity 분기
- State-driven (WHILE ... SHALL ...): 2개 — status가 running / pending_review
- Unwanted (SHALL NOT ...): 3개 — review gate bypass / scope breach

모든 REQ는 자동화 가능 검증 방법을 포함하며, Phase 9 완료 판정 전 Vitest 또는 통합 테스트(MSW + Cloudflare Workers mini flare)로 회귀 가능해야 한다.

---

### Group A: Workflow A — 510(k) Submission Drafter (REQ-WF-001 ~ REQ-WF-020)

**그룹 목적:** 21 CFR 807.87 20 sections에 정렬된 510(k) / De Novo / EU MDR Technical Documentation 초안 생성. Predicate 검색·비교·gap 분석·section draft·review checklist 완결. Cloudflare Workflows durable execution 활용. 관련 research 섹션: A, B, C.

#### REQ-WF-001 — 워크플로우 트리거 API Contract

The system SHALL expose `POST /api/ra/workflows/draft-submission` accepting a Zod-validated body `{ product_name: string, device_class: 'I'|'II'|'III', indications_for_use: string, target_jurisdiction: 'US_FDA'|'EU_MDR'|'KR_MFDS', predicate_k_numbers?: string[], project_id: uuid }` and returning `202 Accepted` with `{ runId: uuid, streamEventsUrl: string }` within 500ms of request arrival.

**검증:** Vitest + MSW `POST /api/ra/workflows/draft-submission` with valid body returns 202 + runId UUID v7; invalid body returns 400 with Zod error details; elapsed < 500ms in 10-iteration median.

#### REQ-WF-002 — Predicate Finder Cascade 검색

WHEN a submission workflow is triggered with `target_jurisdiction='US_FDA'` and `predicate_k_numbers` is absent or empty, THEN the system SHALL execute a 3-step cascade against openFDA: (step 1) device_name substring match, (step 2) product_code match, (step 3) review_advisory_committee fallback, collecting top-25 candidates per step.

**검증:** Vitest + MSW stub openFDA responses, each step 확인(cascade 종료 조건: step 1이 5개 이상 반환 시 step 2/3 skip), top-25 per step enforced.

#### REQ-WF-003 — Predicate Vectorize Rerank

The system SHALL rerank predicate candidates by cosine similarity between subject's `indications_for_use` embedding(OpenAI text-embedding-3-small 1536-dim) and each candidate predicate's IFU embedding from Vectorize FDA corpus, returning top-5 final candidates with similarity scores in descending order.

**검증:** Integration test with seeded Vectorize FDA corpus (50 sample predicates), subject IFU "blood pressure monitor for home use" returns BP-related predicates in top-5.

#### REQ-WF-004 — Predicate 사용자 명시 선택 강제

IF `predicate_k_numbers` is absent from input and Predicate Finder returns candidates, THEN the workflow SHALL pause at status `pending_predicate_selection` and emit SSE event `predicate_candidates` with top-5 list; the workflow SHALL NOT proceed to gap analysis until user resumes with `PATCH /api/ra/workflows/[runId]/resume` specifying 1-2 selected K-numbers.

**검증:** Integration test triggers workflow w/o predicate input, observes SSE `predicate_candidates` event, PATCH resume with selection, workflow resumes.

#### REQ-WF-005 — Gap Analyzer Step

WHEN predicate(s) are finalized, THEN the system SHALL execute gap analysis comparing subject and predicate(s) across 5 dimensions (intended_use, indications_for_use, technological_characteristics, materials, performance_specifications) using Sonnet LLM, producing `gap_report: { dimension, subject_value, predicate_value, difference_level: 'identical'|'similar'|'different', review_required: boolean }[]`.

**검증:** Vitest on seeded subject + predicate JSON, gap_report entries ≥ 5, each dimension covered.

#### REQ-WF-006 — Section Generator Routing

The system SHALL route each of the 20 sections to a section generator module based on a static routing map: sections 3/5/9/10/11/12/14/15/18 to Sonnet generator, sections 4/8/13/16/17/19 to Haiku-first with Sonnet fallback on Zod parse failure, sections 1/2/6/7/20 to template engine only.

**검증:** Unit test: routing map covers all 20 sections, Sonnet vs Haiku vs Template call counts match expected distribution on mock generation.

#### REQ-WF-007 — Section Coverage SLO

The system SHALL produce non-empty draft content for at least 17 of 20 sections (85% coverage) for any valid submission input, where "non-empty" is defined as `section.body.trim().length >= 200 characters AND has at least one citation`.

**검증:** Eval harness with 5 subject devices, each run produces ≥ 17 non-empty sections (LAUNCH promptfoo integration).

#### REQ-WF-008 — Substantial Equivalence Discussion Must-Have

The system SHALL always produce non-empty content for Section 11 (Substantial Equivalence Discussion) and Section 12 (Substantial Equivalence Comparison Table); IF generation fails after 3 retries, THEN the workflow SHALL mark status `failed` with reason `se_section_unavailable` rather than proceed.

**검증:** Fault injection test: stub Sonnet to return empty on section 11, observe workflow transitions to `failed` status with correct reason.

#### REQ-WF-009 — Comparison Builder Output

WHEN gap analysis completes, THEN the comparison-builder SHALL produce a STRUCTURED-compatible `comparison` block payload with columns `[subject, predicate_1, predicate_2?]` and rows covering at minimum the 5 gap dimensions; the payload SHALL validate against `lib/ai/structured-schema.ts` comparison schema.

**검증:** Vitest: comparison output parses successfully through STRUCTURED Zod comparison schema; column count ≥ 2, row count ≥ 5.

#### REQ-WF-010 — Workflow Execution Time Upper Bound

WHILE a submission workflow is in `running` state, it SHALL complete all 20 section generation steps within 20 minutes wall-clock; if not, the Cloudflare Workflow SHALL automatically pause and emit `workflow_timeout_pending_resume` SSE event.

**검증:** Load test with 10 concurrent workflows, P95 completion < 20 minutes; timeout behavior verified via artificial step slow-down.

#### REQ-WF-011 — Section-level Retry Policy

The system SHALL retry each section generation up to 3 times with exponential backoff (1s, 4s, 16s) on transient errors (LLM rate limit, network timeout, Zod parse failure); on 3rd failure, section is marked `review_required: true` with empty body and workflow continues to next section.

**검증:** Fault injection: LLM returns 429 twice then succeeds; assert section final status = success with retry_count=2.

#### REQ-WF-012 — EU Mode Annex Mapping

IF `target_jurisdiction='EU_MDR'`, THEN the workflow SHALL replace FDA 20-section generator set with EU-specific structure: Annex II Technical Documentation 6 sections + Annex III Post-Market Surveillance 2 sections + Annex I GSPR 23-row checklist(rendered as comparison block).

**검증:** Integration test with EU jurisdiction input, result contains `annex_ii_sections`, `annex_iii_sections`, `gspr_checklist` keys; GSPR row count = 23.

#### REQ-WF-013 — Review Checklist Generation

The system SHALL generate a review checklist for every submission draft listing: (1) all sections with `review_required=true`, (2) all citations requiring manual verification, (3) gap dimensions with `difference_level='different'`, (4) reviewer action items. The checklist is exposed as `message_blocks.block_type='checklist'` embedded in the workflow result.

**검증:** Unit test: review checklist contains all review_required sections + different gap items.

#### REQ-WF-014 — Markdown Post-Processing Citation Enforcement

The system SHALL post-process all section bodies through `lib/ai/citation-enforce.ts` (reused from CHAT Phase 2) extending its meta-whitelist to include regulatory draft disclaimers; any section exceeding 20% uncited sentences SHALL be flagged `review_required: true`.

**검증:** Unit test: body with 30% uncited sentences triggers review_required; body with 10% passes.

#### REQ-WF-015 — MDX Rendering Validation

WHEN section bodies are converted to MDX (for DraftPreview component embedding), THEN the system SHALL validate all MDX imports resolve to whitelisted components (`ComparisonTable`, `Checklist`, `Timeline`, `Callout`, `Citation`); unknown imports SHALL be stripped before render.

**검증:** MDX compiler integration test: custom import `<UnknownComponent />` is stripped and replaced with plain text warning.

#### REQ-WF-016 — PDF Generation via Puppeteer

The system SHALL render approved MDX to PDF via Puppeteer headless(v22+) with A4 page size, 20mm margins, serif body font(Source Serif 4 fallback Noto Serif KR if ko content), Part 11 footer on every page ("AI-assisted draft. Human review required. Run ID: {id}. Generated: {ISO8601}").

**검증:** Integration test: PDF buffer contains Part 11 footer on all pages(pdf-parse library extract); file size between 50KB-5MB.

#### REQ-WF-017 — Submission Download Review Gate

The system SHALL NOT allow PDF download via `GET /api/ra/workflows/[runId]/download` unless `workflow_runs.status='approved'`; any attempt with `status!='approved'` SHALL return `403 WorkflowPendingReview` with reason detail.

**검증:** Integration test: status='pending_review' + GET download → 403; status='approved' + GET → 200 with PDF content-type.

#### REQ-WF-018 — Submission Workflow Audit Trio per Step

The system SHALL record `writeAudit(action='workflow.step.complete', ...)` for every successful step completion and `writeAudit(action='workflow.step.fail', ...)` for failures, with `meta_json` containing `{ step_id, step_name, duration_ms, retry_count }`.

**검증:** audit-completeness static analysis (ENTERPRISE CI gate) reports 0 missing writeAudit on submission orchestrator files.

#### REQ-WF-019 — Predicate Cache Persistence

The system SHALL persist predicate candidate search results in Cloudflare KV with 7-day TTL keyed by `(subject_device_name_hash, product_code, search_step)` to avoid re-querying openFDA on workflow re-runs for same subject.

**검증:** Integration test: two sequential workflow runs with same subject share predicate results; openFDA API call count on 2nd run = 0.

#### REQ-WF-020 — Submission Export Metadata

The system SHALL embed PDF metadata fields: `/Producer="Regula AI-assisted"`, `/Creator="Regula vX.Y.Z"`, `/CreationDate=ISO8601`, `/Keywords="510k draft,AI-assisted,pending-review"`, `/Title="510(k) Draft — {product_name}"`.

**검증:** Integration test: pdf-parse extracts metadata, all 5 fields present.

---

### Group B: Workflow B — Audit Response Drafter (REQ-WF-021 ~ REQ-WF-035)

**그룹 목적:** FDA Form 483 또는 EU NB-MED deficiency letter 입력 → observation 파싱 → CAPA 7-field draft → precedent 검색 → legal flag → 전체 response draft. 관련 research 섹션: D.

#### REQ-WF-021 — Audit Response 워크플로우 트리거

The system SHALL expose `POST /api/ra/workflows/audit-response` accepting `{ input_type: 'fda_483'|'mdsap_deficiency'|'eu_nb_med', input_format: 'pdf'|'text', input_content: string|base64pdf, project_id: uuid, establishment_fei?: string }` returning `202 Accepted` with `{ runId, streamEventsUrl }`.

**검증:** Vitest + MSW: valid PDF input returns 202 + runId; text input ≥ 100 chars required; PDF input max 10MB.

#### REQ-WF-022 — PDF to Text Extraction

WHEN `input_format='pdf'`, THEN the system SHALL extract text via pdf-parse(Node.js) or PDF.js worker, preserving observation numbering and line breaks; extraction failure triggers `failed` status with reason `pdf_extraction_failed`.

**검증:** Integration test with real FOIA-released 483 PDF sample: extract observation texts, numbered 1..N, line breaks preserved.

#### REQ-WF-023 — Observation Parser Precision SLO

The Haiku-based observation parser SHALL achieve ≥ 90% precision on cited_regulation extraction(21 CFR §...) measured against a labeled test set of 30 FDA 483 observations; precision below this threshold fails Phase 6 LAUNCH promptfoo eval gate.

**검증:** promptfoo eval: labeled 30-observation test set, precision scorer returns ≥ 0.90; below → fail regression.

#### REQ-WF-024 — Observation Structured Output Schema

The system SHALL validate parser output against Zod schema `{ observation_number: int ≥ 1, observation_text: string ≥ 50 chars, cited_regulation: string matching /^21 CFR |^EU MDR /, device_or_process_area: enum, severity_estimate: 'critical'|'high'|'medium'|'low', keywords: string[] ≥ 2 }`; parse failure retries up to 3 times.

**검증:** Unit test with malformed parser output (missing cited_regulation) triggers retry; after 3 failures, observation is marked `review_required: true` with raw_text preserved.

#### REQ-WF-025 — Regulatory Mapper Citation Injection

WHEN observation cited_regulation is extracted, THEN the regulatory-mapper SHALL fetch the corresponding regulation snippet from Vectorize FDA corpus (21 CFR 820) or EU MDR corpus and inject it into CAPA generation context as primary source citation.

**검증:** Integration test: cited_regulation='21 CFR 820.100' retrieves CAPA subpart snippet, citation inserted into observation_summary section.

#### REQ-WF-026 — CAPA 7-Field Template Completeness

For each observation, the CAPA generator SHALL produce all 7 fields: (1) observation_summary, (2) root_cause_analysis, (3) immediate_corrections, (4) corrective_actions, (5) preventive_actions, (6) effectiveness_verification, (7) timeline_and_responsible. Any missing field triggers Sonnet retry.

**검증:** Unit test: CAPA output has all 7 keys, each field length ≥ 50 chars.

#### REQ-WF-027 — Root Cause Analysis Method Disclosure

The CAPA generator SHALL disclose the RCA methodology used (5-Why, Fishbone/Ishikawa, or combined) in the `root_cause_analysis.method` field; generated RCA steps SHALL be traceable to the methodology (e.g., 5-Why output has 5 why-because chain entries).

**검증:** Unit test: 5-Why output contains 5 sequential why/because pairs.

#### REQ-WF-028 — Precedent Finder Dual Source

The precedent-finder SHALL query both (a) public FDA warning letter response corpus(Vectorize index, ~500 documents) and (b) organization DOCINGEST corpus for similar observation response precedents; results SHALL be merged and dedup'd by content hash, top-3 returned.

**검증:** Integration test: observation "CAPA inadequate..." returns at least 1 public + 1 org precedent when both corpora contain matches; dedup behavior verified.

#### REQ-WF-029 — Legal Review Auto-Flag Conditions

IF observation severity_estimate='critical' OR CAPA body contains admission-of-liability lexicon(['guilty', 'violation', 'failure to comply', 'non-compliant']) OR timeline_and_responsible.days > 180, THEN legal-review-flagger SHALL emit `legal_review_required: true` in observation result and enqueue expert_review row with category='legal'.

**검증:** Unit test: observations with each trigger condition emit legal flag; observations without triggers do not flag.

#### REQ-WF-030 — CAPA Confidence Calibration

The CAPA generator SHALL attach a confidence score [0.0, 1.0] per observation based on (a) citation coverage, (b) precedent match strength, (c) Sonnet self-reported confidence; workflow_runs.confidence_aggregate is weighted average across observations.

**검증:** Unit test: confidence formula: `0.4 * citation + 0.3 * precedent + 0.3 * llm_self`; bounds verified; aggregate weighted by observation severity.

#### REQ-WF-031 — FDA 483 vs MDSAP vs NB-MED Format Routing

The system SHALL route parser behavior by `input_type`: fda_483 uses FDA 483 numbering convention(1., 2., ...), mdsap_deficiency uses MDSAP Companion Document format, eu_nb_med uses Notified Body observation letter format; each format has its own regex parser.

**검증:** Unit test: 3 format samples parse successfully, each routing invokes correct regex parser.

#### REQ-WF-032 — Audit Response Document Assembly

WHEN all observations are processed, THEN the orchestrator SHALL assemble a complete response document with: cover letter, per-observation response section(observation_text, CAPA 7 fields, cited_regulation, precedent references), appendix(supporting documents list).

**검증:** Integration test: complete document Markdown includes all sections; observation count matches parsed input count.

#### REQ-WF-033 — Audit Response PDF Output Structure

The assembled response SHALL be rendered to PDF with table-of-contents, per-observation page breaks, Part 11 footer, signature placeholder(not auto-signed); document SHALL be reviewable via DraftPreview before download approval.

**검증:** Integration test: PDF has TOC page, page breaks at observation boundaries, footer on all pages, signature placeholder marker text present.

#### REQ-WF-034 — Audit Response Review Gate

WHEN audit-response workflow completes all observations, THEN the workflow SHALL set status='pending_review' and emit SSE `workflow_pending_review`; download is blocked until reviewer(admin/ra-lead) PATCHes status='approved'.

**검증:** Integration test: status transitions queued→running→pending_review; reviewer PATCH approved transitions to approved; download allowed only after approved.

#### REQ-WF-035 — Audit Response Audit Wiring

The system SHALL record audit_logs entries for `workflow.start` (input hash), `workflow.step.complete` per observation, `workflow.pending_review`, `workflow.approve`/`reject`, `workflow.download`, `workflow.edit`; total SHALL equal 5 + observation_count + edit_count.

**검증:** audit-completeness static analysis (ENTERPRISE): 0 missing writeAudit; runtime integration test counts audit rows for sample 3-observation run matches expected formula.

---

### Group C: Workflow C — Indication Impact Analyzer (REQ-WF-036 ~ REQ-WF-048)

**그룹 목적:** 현재/확장 indication 입력 → FDA pathway tree + additional data estimate + 5-jurisdiction 전략 비교. 관련 research 섹션: E, G.

#### REQ-WF-036 — Indication Impact 워크플로우 트리거

The system SHALL expose `POST /api/ra/workflows/indication-impact` accepting `{ project_id: uuid, current_indication: string, proposed_indication: string, target_markets: ('US'|'EU'|'KR'|'JP'|'CN')[] }` returning `202 Accepted` with `{ runId, streamEventsUrl }`.

**검증:** Vitest + MSW: valid input returns 202; empty target_markets returns 400; current/proposed indication text ≥ 20 chars each.

#### REQ-WF-037 — Current State Reconstruction

WHEN workflow starts, THEN current-state-analyzer SHALL reconstruct project's current regulatory state from (a) DOCINGEST organization corpus DMR/DHF files, (b) openFDA 510(k) existing clearance lookup by project.k_number, within 10s wall-clock.

**검증:** Integration test: seeded project with k_number, analyzer fetches existing indications in < 10s.

#### REQ-WF-038 — Pathway Tree Rule Engine Determinism

The pathway-tree SHALL be implemented as a rule-based decision tree(YAML/JSON rules) without LLM invocation; given identical inputs, the tree SHALL produce identical outputs across runs(determinism verified via snapshot test).

**검증:** Unit test: 20 input fixtures each produce stable output across 10 runs; no randomness.

#### REQ-WF-039 — Pathway Decision Chart Coverage

The pathway-tree SHALL implement all 4 FDA Guidance charts: Chart A(Labeling), Chart B(Technology/Engineering/Performance), Chart C(Materials), Chart D(Environment of Use); each chart has entry conditions detected from input diff.

**검증:** Unit test: 4 diff scenarios (one per chart) routed correctly; chart coverage = 4/4.

#### REQ-WF-040 — Pathway Output Structure

The pathway-tree SHALL produce output `{ chart_used: 'A'|'B'|'C'|'D', path_taken: Node[], final_recommendation: '510(k)'|'De Novo'|'PMA'|'Letter to File'|'Special 510(k)', rationale: string, regulatory_citations: string[], confidence: number }`.

**검증:** Unit test: all schema keys present for all 4 charts; final_recommendation enum enforced.

#### REQ-WF-041 — Additional Data Estimator Categories

WHEN pathway is determined, THEN additional-data-estimator SHALL estimate data needs across 5 categories: bench testing, biocompatibility (per ISO 10993-1 if materials change), animal studies, clinical data, software V&V (if software modification); each category has effort estimate(low/medium/high).

**검증:** Unit test: for 510(k) pathway with material change, biocompat category = 'high'; for LtF pathway, all categories = 'low'.

#### REQ-WF-042 — 5-Jurisdiction Table Generation Time SLO

The jurisdiction-strategy comparator SHALL produce a 5-jurisdiction (US/EU/KR/JP/CN) comparison table within 60 seconds wall-clock from pathway determination; exceeding SLO triggers SLO breach log but workflow continues.

**검증:** Load test: 10 concurrent indication impact workflows, P95 jurisdiction table generation < 60s.

#### REQ-WF-043 — Jurisdiction Table Columns

The jurisdiction comparison table SHALL have columns: `[pathway, timeline_estimate_range, additional_data, cost_estimate_range, regulatory_body, submission_format, key_considerations]` for each jurisdiction row.

**검증:** Unit test: output comparison block has exactly 7 columns and 5 rows(one per jurisdiction in target_markets, otherwise placeholder "N/A — not in target markets").

#### REQ-WF-044 — Timeline Estimate Range Format

The timeline_estimate_range column SHALL be formatted as string like `"3-6 months"` or `"12-24 months"` with min-max month values; exact single-value estimates are NOT permitted, range format enforced by Zod regex `/^\d{1,2}-\d{1,2} months$/`.

**검증:** Unit test: "3-6 months" passes; "4 months" fails Zod validation.

#### REQ-WF-045 — Jurisdiction Data Insufficiency Warning

IF `target_markets` contains KR, JP, or CN AND DOCINGEST corpus for that jurisdiction contains < 10 reference documents, THEN the jurisdiction row SHALL include warning flag `data_confidence: 'low'` and display note "insufficient corpus, expert consultation recommended".

**검증:** Integration test with KR corpus populated to 5 docs triggers warning; 50 docs does not trigger.

#### REQ-WF-046 — Indication Impact Result Assembly

WHEN pathway + additional data + jurisdiction table complete, THEN the orchestrator SHALL assemble result `{ pathway: PathwayOutput, additional_data: DataEstimate, jurisdiction_table: ComparisonBlock, summary_recommendation: string }` within 2 minutes wall-clock from trigger.

**검증:** Integration test: complete workflow run P95 < 2 minutes for 3-jurisdiction input.

#### REQ-WF-047 — Indication Impact Review Requirement

IF `final_recommendation='PMA'` OR any jurisdiction has `data_confidence='low'`, THEN review_required=true is enforced with additional `review_reason='high_risk_pathway' OR 'low_data_confidence'`.

**검증:** Unit test: PMA recommendation triggers review_reason='high_risk_pathway'; KR low-data triggers review_reason='low_data_confidence'.

#### REQ-WF-048 — Indication Impact Audit Events

The workflow SHALL emit audit events: `workflow.start` (input diff hash), `workflow.step.complete` for each of (pathway/additional-data/jurisdiction) steps, `workflow.pending_review`, `workflow.approve`/reject; total = 5 audit events minimum per run.

**검증:** Runtime integration test: seeded workflow run produces exactly 5 audit_logs rows.

---

### Group D: Common Workflow Infrastructure (REQ-WF-049 ~ REQ-WF-058)

**그룹 목적:** 3 workflow 공통 기반 — Cloudflare Workflows binding, confidence aggregator, human-handoff, review queue, workflow_runs schema, audit enum extension, SSE events, citation enforcement, template engine, review gate enforcement. 관련 research 섹션: H, I, J, K, L, M.

#### REQ-WF-049 — workflow_runs 테이블 스키마

The Drizzle schema SHALL add `workflow_runs` table with columns: `id uuid PK(v7)`, `user_id uuid NOT NULL FK users`, `organization_id uuid NOT NULL FK organizations`, `project_id uuid NULL FK projects`, `workflow_type workflow_type_enum NOT NULL`, `status workflow_status_enum NOT NULL DEFAULT 'queued'`, `input_json jsonb NOT NULL`, `result_json jsonb NULL`, `step_progress jsonb NULL`, `confidence_aggregate numeric(3,2) NULL`, `review_required boolean NOT NULL DEFAULT true`, `reviewer_user_id uuid NULL FK users`, `reviewed_at timestamptz NULL`, `started_at timestamptz NOT NULL DEFAULT now()`, `completed_at timestamptz NULL`, `cloudflare_workflow_instance_id text NULL`, `created_at / updated_at timestamptz`.

**검증:** Drizzle introspection test: all 15 columns present with exact types; default values verified via INSERT without override.

#### REQ-WF-050 — workflow_type / workflow_status pgEnum

The migration SHALL create `workflow_type` pgEnum with values `{submission_drafter, audit_response, indication_impact}` and `workflow_status` pgEnum with values `{queued, running, paused, pending_review, approved, rejected, failed}`.

**검증:** `pg_type` SELECT verifies enum values exactly match; INSERT with unknown enum value fails.

#### REQ-WF-051 — message_blocks.block_type 'workflow_result' Value

The migration SHALL `ALTER TYPE message_block_type ADD VALUE 'workflow_result'` to allow embedding workflow summaries in chat conversations.

**검증:** INSERT message_blocks row with block_type='workflow_result' succeeds; structured-schema.ts validator updated.

#### REQ-WF-052 — audit_action pgEnum Phase 9 Extension

The migration `00XX_workflow_audit_actions.sql` SHALL add values `{workflow.start, workflow.step.complete, workflow.step.fail, workflow.pause, workflow.resume, workflow.pending_review, workflow.approve, workflow.reject, workflow.download, workflow.edit}` (10 values) to `audit_action` pgEnum via ALTER TYPE ADD VALUE.

**검증:** Post-migration: all 10 values exist in pg_enum; INSERT audit_logs with each new action succeeds.

#### REQ-WF-053 — Cloudflare Workflow Binding

The system SHALL bind Cloudflare Workflow instances per workflow trigger via env.WORKFLOWS.create(workflowType, { id: runId, params: input_json }); instance ID SHALL be persisted in `workflow_runs.cloudflare_workflow_instance_id`.

**검증:** Integration test(Cloudflare MiniFlare simulator): trigger workflow, assert instance created + ID persisted.

#### REQ-WF-054 — SSE Event Channel per Workflow Run

The system SHALL expose `GET /api/ra/workflows/[runId]/events` as SSE stream emitting events: `workflow_start`, `step_start`, `step_complete`, `step_fail`, `workflow_progress` (percent), `workflow_pending_review`, `workflow_done`, `workflow_failed`, `predicate_candidates` (submission only), workflow-specific custom events.

**검증:** Integration test: trigger workflow, subscribe SSE, receive all expected event types in correct order; SSE reconnect handled with `Last-Event-ID`.

#### REQ-WF-055 — Confidence Aggregator Formula

The confidence-aggregator SHALL compute `workflow_runs.confidence_aggregate` as weighted average of step-level confidences: `aggregate = sum(step.confidence * step.weight) / sum(step.weight)`, floored at minimum step confidence; formula SHALL be deterministic and unit-tested.

**검증:** Unit test: inputs [(0.9, 5), (0.7, 3), (0.6, 2)] → aggregate = (4.5 + 2.1 + 1.2) / 10 = 0.78, floored at min(0.6) → final 0.6 enforced.

#### REQ-WF-056 — Review Gate Server-Side Enforcement

The system SHALL NOT serve PDF download or final result JSON to any user when `workflow_runs.status != 'approved'`; enforcement SHALL be implemented in `lib/auth/with-workflow-review.ts` middleware wrapping all download/result routes; client-side bypass via JS SHALL not be possible.

**검증:** Integration test: direct fetch to `/api/ra/workflows/[runId]/download` with status='pending_review' returns 403; curl-level check without any client code confirms server enforcement.

#### REQ-WF-057 — Review Queue Integration with ENTERPRISE

The system SHALL extend ENTERPRISE `expert_reviews` table usage: when workflow enters `pending_review`, a new expert_reviews row is inserted with `target_type='workflow_run'`, `target_id=workflow_runs.id`, `category=workflow_type`, `auto_flagged=true`; existing ENTERPRISE review UI at `/expert-review` page SHALL render workflow_run targets alongside message targets.

**검증:** Integration test: workflow transitions to pending_review → expert_reviews row INSERTed with correct target_type/id; /expert-review page renders the row in admin/ra-lead view.

#### REQ-WF-058 — Draft Part 11 Disclaimer Injection

The system SHALL inject the standardized Part 11 disclaimer footer into every draft output (Markdown, MDX, PDF): "이 문서는 Regula AI 시스템이 생성한 보조 초안입니다. 규제 제출 전 반드시 자격을 갖춘 RA 전문가의 검토 및 수정이 필요합니다. Regula는 법적·규제적 책임을 지지 않습니다. 생성일: {ISO8601} | 워크플로우 실행 ID: {runId}" — THE SYSTEM SHALL NOT allow disclaimer removal or modification by users.

**검증:** Unit test: disclaimer present in PDF(every page footer), Markdown(end of document), MDX(final component); no API endpoint exposes disclaimer mutation.

---

### Group E: UI Components (REQ-WF-059 ~ REQ-WF-068)

**그룹 목적:** Workflow Gallery, 3 workflow entry pages, ProgressSteps, DraftPreview, ReviewGate, WorkflowResultBlock. 관련 research 섹션: J, K.

#### REQ-WF-059 — Workflow Gallery Page

The system SHALL render `/workflows` page displaying 3 workflow entry cards(Submission Drafter, Audit Response, Indication Impact) with description, icon(lucide-react), primary CTA button; page SHALL honor dark-mode tokens and serif headings per handoff §6.

**검증:** Playwright + axe-core: 3 cards visible, axe-core violations = 0, dark-mode CSS class applied; keyboard Tab order correct.

#### REQ-WF-060 — Submission Drafter Entry Form

The system SHALL render `/workflows/draft-submission` page with Zod-validated form fields: product_name(text), device_class(radio), indications_for_use(textarea min 20 chars), target_jurisdiction(select), predicate_k_numbers(chip input, optional), project_id(select from user's projects via BREADTH project-context); form submit triggers workflow and navigates to `/workflows/runs/[runId]`.

**검증:** Playwright: fill form, submit, observe navigation to runs/[runId]; Zod validation rejects empty indications.

#### REQ-WF-061 — Audit Response Upload UI

The system SHALL render `/workflows/audit-response` page with file upload (drag-drop + click)(PDF max 10MB) or textarea input switch; file SHALL be validated(mime-type, size) client-side before POST; upload progress indicator displayed.

**검증:** Playwright: drag 483 PDF sample, submit, observe workflow start; >10MB file rejected with error message.

#### REQ-WF-062 — Indication Impact Dual Indication Form

The system SHALL render `/workflows/indication-impact` page with side-by-side current/proposed indication textareas(each min 20 chars), target_markets multi-select checkbox(US/EU/KR/JP/CN), project_id select; form visually differentiates additive vs substitutive changes via diff highlighting(using a lightweight diff library client-side).

**검증:** Playwright: fill both indications differing text, observe diff highlight; submit triggers workflow.

#### REQ-WF-063 — ProgressSteps Component

`components/workflows/ProgressSteps.tsx` SHALL render current step N of M with step name, elapsed time, spinner for in-progress step, check mark for completed steps, error icon for failed steps; SHALL consume SSE `step_start`/`step_complete` events via useStreamingAnswer-like hook.

**검증:** Storybook story + Vitest: component receives SSE events, renders correct step state transitions.

#### REQ-WF-064 — DraftPreview MDX Rendering

`components/workflows/DraftPreview.tsx` SHALL render draft result as MDX with whitelisted components (ComparisonTable, Checklist, Timeline, Callout, Citation); section-level "Edit" button opens inline editor (TipTap or MDXEditor); edits persisted via `PATCH /api/ra/workflows/[runId]/sections/[sectionId]` with audit event `workflow.edit` fired.

**검증:** Playwright: render draft, click Edit on section 11, modify text, save; assert PATCH fired + audit event in audit_logs.

#### REQ-WF-065 — ReviewGate Component Access Control

`components/workflows/ReviewGate.tsx` SHALL display approve/reject/request-change actions only when current user role is admin OR ra-lead; users with ra-member or viewer role SHALL see read-only status banner; component integrates with ENTERPRISE RBAC middleware.

**검증:** Playwright + test users: login as ra-member → see read-only banner; login as ra-lead → see action buttons; action click triggers PATCH.

#### REQ-WF-066 — WorkflowResultBlock in Chat

`components/chat/blocks/WorkflowResultBlock.tsx` SHALL render `message_blocks` with block_type='workflow_result' as compact card: workflow_type icon, status badge, workflow summary sentence(≤200 chars), "View full result" link to `/workflows/runs/[runId]`; card honors serif/sans typography per handoff §6.

**검증:** Storybook + Vitest: block renders compact summary; click link navigates to runs page.

#### REQ-WF-067 — Workflow Run History Page

The system SHALL render `/workflows/runs` page listing all user's workflow runs(paginated 20 per page) with columns: workflow_type, status badge, started_at, completed_at, duration, confidence_aggregate, primary action(view/download/review); filters by workflow_type and status; default sort by started_at DESC.

**검증:** Playwright: seeded 50 runs, paginate, filter by type='submission_drafter', observe filtered list; axe-core violations = 0.

#### REQ-WF-068 — Workflow UI noindex Compliance

WHILE the current URL pathname starts with `/workflows`, the page SHALL render `<meta name="robots" content="noindex, nofollow">` via Next.js metadata API, inheriting from `(app)` layout group; robots.txt disallow for `/workflows/*` is NOT required(auth-wall suffices).

**검증:** Playwright curl-level check: each /workflows/* page response HTML contains `<meta name="robots" content="noindex, nofollow">`.

---

## 완료 기준 (Definition of Done)

### 정량 기준

- **68 REQ-WF 전원 구현** (Group A: 20, B: 15, C: 13, D: 10, E: 10)
- **Workflow A Section Coverage:** 5 subject devices × 17/20 sections non-empty(85%) 달성(promptfoo eval)
- **Workflow B Observation Parsing Precision:** 30-observation labeled test set ≥ 90% precision
- **Workflow C 5-Jurisdiction Table Generation:** P95 < 60s
- **Citation Coverage:** draft prose + body + tables 100% (promptfoo scorer)
- **Review Gate Bypass:** 0건 (integration test + direct curl 검증)
- **Workflow Run UUID Collision:** 0 (UUID v7 enforced + UNIQUE constraint)
- **audit-completeness 정적 분석(ENTERPRISE CI gate):** 0 violations on new workflow Route Handlers
- **axe-core Violations:** 0 on all `/workflows/*` pages (Phase 5 ENTERPRISE CI gate 유지)
- **14th Table Migration 적용 성공:** workflow_runs create + 2 pgEnum + ALTER TYPE ADD VALUE (message_block_type + audit_action) 모두 적용
- **Phase 5 ENTERPRISE RBAC 통합:** admin/ra-lead만 approve/reject, ra-member/viewer는 read-only(Playwright role-based E2E)
- **Phase 6 LAUNCH promptfoo eval 확장:** 120 신규 eval cases 등록 + regression green

### 정성 기준

- 모든 draft에 Part 11 disclaimer 존재(제거 불가)
- 모든 workflow 결과 review_required=true(confidence 관계없이, server-side enforcement)
- Part 11 safe harbor 준수: 인간 reviewer 승인 전 download 불가
- Legal review flag 발동 시 expert_review 큐 연동 확인
- Cloudflare Workflows step-level retry 동작 확인(artificial 실패 주입 테스트)
- 조직 DOCINGEST corpus 연동 확인(precedent-finder / current-state-analyzer)
- FDA openFDA API rate limit(240/min) 내 동작(rate limit 테스트)
- Prompt caching 활성화로 section generator 비용 ~90% 절감 확인(Langfuse cost dashboard)

### 문서화 기준

- `docs/workflows/user-guide.md` 작성 — 3 workflow 사용법
- `docs/workflows/architecture.md` 작성 — Cloudflare Workflows orchestration 구조
- `docs/workflows/compliance.md` 작성 — Part 11 준수, review gate enforcement, E&O 정책
- `docs/workflows/review-rubric.md` 작성 — reviewer가 draft 검토 시 체크리스트
- CHANGELOG.md — Phase 9 신규 기능, breaking changes 없음, audit_action enum 확장만

### TRUST 5 Quality Gates

- **Tested:** Vitest coverage ≥ 85% for `lib/workflows/**`, integration tests for all 3 workflows, 120 promptfoo eval cases
- **Readable:** TypeScript strict mode, biome lint 0 warnings, JSDoc for public APIs
- **Unified:** Reuses FOUNDATION schema conventions, CHAT SSE patterns, STRUCTURED block schemas, ENTERPRISE RBAC middleware
- **Secured:** OWASP review (injection via observation text, SSRF via openFDA, XSS in DraftPreview MDX); PDF generation sandbox; rate-limit on workflow trigger routes(10 per user per hour per workflow_type)
- **Trackable:** Git commits reference REQ-WF-NNN; `.moai/specs/SPEC-REGULA-WORKFLOWS-001/progress.md` iteration state updated; workflow_runs table queryable for all audit questions

---

## 위험 및 완화 (Risks & Mitigations)

cross-Phase 위험은 `.moai/plans/master-roadmap.md` §9 Risk Register 확장 후보로 등록 권장 (research.md §N.1 참조):

| ID | Risk | 영향 | 완화 |
|---|---|---|---|
| R-X16 | Draft 품질이 미달 (규제 전문가 신뢰 상실) | High | LAUNCH promptfoo eval harness 확장(5 subject devices × 17 sections 정합 rubric), 점진 런치(internal alpha → pilot 3-5명 → GA), reviewer feedback loop |
| R-X17 | Predicate 잘못 매칭으로 전체 draft 무의미 | Critical | top-5 후보 제시 + 사용자 명시 선택 강제(REQ-WF-004), Vectorize rerank validation, 사용자 confirm 이후에만 gap analysis 진행 |
| R-X18 | 법적 책임(잘못된 draft로 인한 손실, 소송) | Critical | 명시적 Part 11 disclaimer(REQ-WF-058), review gate 우회 불가(REQ-WF-056), legal-review-flagger(REQ-WF-029), E&O 보험 가입(post-launch 결정) |
| R-X19 | FDA openFDA API 변경(schema / rate limit) | Medium | Predicate API stub layer(REQ-WF-019 KV cache), 계약 테스트(CI에서 API schema validation), 변경 시 Vectorize 전용 fallback |
| R-X20 | MFDS/PMDA/NMPA 자료 부족 | Medium | DOCINGEST seed corpus 확대(research §G.5), 부족 시 data_confidence='low' 경고 emit(REQ-WF-045), expert consultation 권유 |
| R-X21 | Long-running workflow LLM 비용 초과 | High | Prompt caching 활용(~90% 절감), Haiku 우선 fallback, 월간 budget alert($1000 threshold, Langfuse 대시보드), 사용자당 rate limit(10/hr/type) |
| R-X22 | Cloudflare Workflows Beta→GA 전환 불안정 | Medium | Durable Objects manual orchestration fallback 설계 유지, MiniFlare 로컬 테스트, GA 전환 일정 monitoring |
| R-X23 | concurrent workflow runs의 race condition | Low | UUID v7(sortable) PK, workflow_runs INSERT UNIQUE constraint, 사용자당 동시 실행 상한 3건 enforce |

---

## 의존성 (Dependencies)

### SPEC 의존성

- **SPEC-REGULA-FOUNDATION-001 v0.4.0+** — workflow_runs 14th table migration 수용, audit_action enum inventory에 Phase 9 10개 값 선제 등록 가정(없으면 ALTER TYPE ADD VALUE 선행)
- **SPEC-REGULA-CHAT-001 v0.2.0+** — SSE transport, citation enforcement post-processing 재사용
- **SPEC-REGULA-STRUCTURED-001 v0.2.0+** — comparison / checklist / timeline block schema, message_blocks.block_type 'workflow_result' ADD VALUE
- **SPEC-REGULA-BREADTH-001 v0.2.0+** — project-context switching, current project 기반 workflow 필터
- **SPEC-REGULA-ENTERPRISE-001 v0.2.0+** — expert_reviews 테이블 확장(target_type='workflow_run'), RBAC(admin/ra-lead download/approve 권한), audit-completeness CI gate
- **SPEC-REGULA-LAUNCH-001 v0.1.0+** — promptfoo eval harness 확장(120 신규 cases), k6 load test workflow 트리거 시나리오 추가
- **SPEC-REGULA-CLOUDFLARE-001 (Phase 7)** — Workflows runtime binding, R2/KV storage, MiniFlare dev simulation
- **SPEC-REGULA-DOCINGEST-001 (Phase 8)** — 조직 DMR/DHF/SOP/과거 CAPA corpus ingest, Vectorize index, precedent-finder / current-state-analyzer 소스

### 외부 의존성

- **FDA openFDA API Key** (무료, https://open.fda.gov/apis/authentication/) — Phase 9 RUN 전 operator 등록 필수, `.env.example`에 FDA_API_KEY 추가
- **Cloudflare Workflows** — GA 상태 확인 or Durable Objects fallback 결정
- **Puppeteer v22+** with Chromium binary — PDF 생성
- **pdf-parse** / PDF.js — PDF → text 추출
- **TipTap / MDXEditor** — DraftPreview 인라인 편집(선택)
- **Anthropic Prompt Caching** — Sonnet/Haiku system prompt 캐시 활용

### 선결 조건 체크리스트 (Phase 9 RUN 착수 전 검증)

- [ ] Phase 1~8 SPEC 전원 `compliance-qa` PASS verdict
- [ ] FDA_API_KEY 등록 완료 + `lib/env.ts` zod 스키마 반영
- [ ] Cloudflare Workflows GA 또는 Durable Objects fallback 결정 문서화
- [ ] DOCINGEST corpus ≥ 30% populated(Workflow B precedent 및 Workflow C current-state 기반)
- [ ] FOUNDATION audit_action enum inventory에 Phase 9 10개 값 선언 확인(미선언 시 ALTER TYPE 마이그레이션 우선)
- [ ] ENTERPRISE expert_reviews target_type column에 'workflow_run' 값 수용 확인
- [ ] LAUNCH promptfoo eval harness에 120 신규 cases 추가 계획 확정

---

## Non-Obvious Constraints 적용 매트릭스

CLAUDE.md의 7개 Non-Obvious Product Constraints 중 Phase 9 적용 방식:

| # | Constraint | Phase 9 적용 |
|---|---|---|
| 1 | Citation 강제 | draft body 내 모든 규제 인용 `<sup class="cite">` 강제. CHAT의 `lib/ai/citation-enforce.ts` post-processing 재사용(REQ-WF-014). 20% 초과 uncited 시 review_required 강제. |
| 2 | SSE 다단계 | workflow progress SSE event 채널은 CHAT의 3-phase(trace/prose/structured)와 **별도** channel(`/api/ra/workflows/[runId]/events`). workflow-specific 이벤트 9종(REQ-WF-054). |
| 3 | Expert-review 자동 게이팅 | **모든 workflow 결과 review_required=true 강제**(confidence 관계없이). ENTERPRISE expert_reviews 큐 통합(REQ-WF-057). review gate server-side enforcement(REQ-WF-056). |
| 4 | Audit 완전성 (21 CFR Part 11) | workflow lifecycle 10개 이벤트 audit_action enum 선제 등록(REQ-WF-052). workflow_runs는 UPDATE 허용(status 전이)이나 주요 이벤트는 audit_logs append-only 기록(REQ-WF-018, 035, 048). |
| 5 | Serif/Sans 타이포 | DraftPreview MDX rendering + PDF rendering 시 serif 본문 유지(Source Serif 4 우선, ko 컨텐츠는 Noto Serif KR fallback). WorkflowResultBlock card heading serif(REQ-WF-066). |
| 6 | ko/en 이중언어 | 초기 draft 생성 locale은 `target_jurisdiction` 기반(`US_FDA/EU_MDR`→en, `KR_MFDS`→ko). prompt locale branching은 Run 단계 정교화. UI는 ENTERPRISE i18n runtime 적용. |
| 7 | noindex 전역 | `/workflows/*` 전 페이지 `<meta name="robots" content="noindex,nofollow">` 상속(REQ-WF-068). auth-wall 뒤, robots.txt 추가 disallow 불필요. |

---

## Open Questions / Pending Decisions (Run 단계 이월)

research.md §P의 7개 open question을 요약 이월:

| Q-ID | 질문 | Run 단계 결정 방향 |
|---|---|---|
| Q-WF-1 | Submission PDF → eSTAR XML 추출 자동화 | 초기 수동 import 권장, Run에서 Puppeteer eSTAR XFA 내보내기 가능성 재평가 |
| Q-WF-2 | CAPA effectiveness verification 통계적 방법 자동 생성 범위 | 템플릿 수준만 LLM, SPC 방법 등은 reviewer 완성 |
| Q-WF-3 | De Novo pathway에 FDA Breakthrough Device 프로그램 포함 | 범위 외 유지(pathway tree 확장 candidate, post-launch) |
| Q-WF-4 | workflow_runs.step_progress 의 granularity | 20 section 각각 step 또는 10 step 묶음 — Run 단계 성능 테스트 후 결정 |
| Q-WF-5 | Markdown → MDX 변환 시 LLM hallucination guard | whitelist-only MDX imports(REQ-WF-015), 추가 post-processing 검토 |
| Q-WF-6 | Cloudflare Workflows 비용 모니터 대시보드 | Langfuse 통합 vs 별도 CF dashboard — Run 단계 관측 후 결정 |
| Q-WF-7 | Workflow retry 시 이전 LLM 결과 부분 재사용 | step 단위 cache 정책 Run 단계 정교화 |

### 추가 사용자 결정 필요 항목 (Plan 단계 confirm 필요)

1. **Jurisdiction 지원 범위:** 초기 런칭에 US+EU만 포함할 것인지, KR/JP/CN 포함할 것인지(corpus 부족 리스크) — 사용자 AskUserQuestion
2. **Workflow 동시 실행 상한:** 사용자당 3건 기본 제시, 기업 고객 요청 시 상향 가능 여부
3. **E&O 보험 가입:** 초기 launch 전 여부 또는 post-launch 3개월 내 결정 — 법무 팀 컨설트 필요
4. **draft 결과 retention:** 7-year(Part 11 기본) vs 10-year(조직 QMS 요건) — organization별 config 지원 여부
5. **workflow 결과 PDF 워터마크:** "AI-assisted DRAFT" 워터마크 강제 vs optional — reviewer 승인 후 해제 가능?

---

## 참조 (References)

### Primary Sources
- 21 CFR 807.87 — Information required in a 510(k) submission
- 21 CFR 820.100 — Corrective and Preventive Action
- 21 CFR Part 11 — Electronic Records; Electronic Signatures
- 21 CFR 860 Subpart D — De Novo Classification Process
- FDA Guidance: Deciding When to Submit a 510(k) for a Change to an Existing Device (2017.10)
- FDA Guidance: eSTAR Program
- EU MDR 2017/745 Annex I (GSPR), Annex II, Annex III
- MEDDEV 2.7/1 Rev 4 — Clinical Evaluation

### Technical References
- openFDA API documentation: https://open.fda.gov/apis/device/510k/
- Cloudflare Workflows documentation
- Anthropic Claude prompt caching guide
- Puppeteer PDF generation reference

### Internal References
- `.moai/specs/SPEC-REGULA-WORKFLOWS-001/research.md` — this SPEC's research artifact
- `.moai/plans/master-roadmap.md` v1.0.0 — cross-Phase strategy
- `CLAUDE.md` — Non-Obvious Product Constraints 원본
- `RA-bot-design/design_handoff_regula/README.md` §11.9, §19, §20 — original handoff Phase 9/10 hints

---

## 부록 A — Workflow Lifecycle State Machine

### A.1 workflow_runs.status 상태 전이

```
          ┌──────────────┐
POST ───> │   queued     │  (초기 상태, Cloudflare Workflow instance 생성 전)
          └──────┬───────┘
                 │ instance.create 성공
                 v
          ┌──────────────┐
          │   running    │  (step 실행 중)
          └──────┬───────┘
                 │
          ┌──────┴───────────────────────────────────────┐
          │                                              │
          v (user interaction 필요 e.g. predicate 선택)     v (모든 step 성공)
    ┌──────────┐                                    ┌──────────────────┐
    │  paused  │                                    │ pending_review   │
    └────┬─────┘                                    └────────┬─────────┘
         │ PATCH resume                                      │
         v                                                   │ reviewer decision
    ┌──────────┐                                   ┌─────────┼──────────┐
    │ running  │                                   v         v          v
    └──────────┘                              approved   rejected   (revision)
                                                  │          │          │
                                                  │          │          │ reviewer
                                                  │          │          │ requests
                                                  │          │          │ edit
                                                  v          v          v
                                            [download]   [archive]   [running]
                                            permitted    queued      re-entered

    (any step failure exceeds retry)
                 │
                 v
          ┌──────────────┐
          │   failed     │  (workflow 종료, audit 기록, 사용자에 알림)
          └──────────────┘
```

### A.2 상태 전이 허용 매트릭스

| From → To | queued | running | paused | pending_review | approved | rejected | failed |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| queued | — | 허용(instance bind) | — | — | — | — | 허용(init fail) |
| running | — | — | 허용(user input 필요) | 허용(all steps success) | — | — | 허용(retry exhausted) |
| paused | — | 허용(resume) | — | — | — | — | 허용(timeout) |
| pending_review | — | 허용(reviewer requests edit) | — | — | 허용(approve) | 허용(reject) | — |
| approved | — | — | — | — | — | — | — (terminal) |
| rejected | — | — | — | — | — | — | — (terminal) |
| failed | — | — | — | — | — | — | — (terminal) |

### A.3 상태 전이 audit event 매핑

| Transition | audit_action | meta_json 필수 필드 |
|---|---|---|
| (new) → queued | `workflow.start` | `{ workflow_type, input_hash }` |
| running → pending_review | `workflow.pending_review` | `{ workflow_type, confidence_aggregate }` |
| pending_review → approved | `workflow.approve` | `{ reviewer_user_id, review_notes }` |
| pending_review → rejected | `workflow.reject` | `{ reviewer_user_id, rejection_reason }` |
| running → paused | `workflow.pause` | `{ paused_step_id, pause_reason }` |
| paused → running | `workflow.resume` | `{ resumed_step_id, user_input_hash }` |
| any → failed | `workflow.step.fail` (final) | `{ failed_step_id, error_code, retry_count }` |
| (per step success) | `workflow.step.complete` | `{ step_id, step_name, duration_ms }` |
| approved → (download) | `workflow.download` | `{ artifact_type: 'pdf', byte_size }` |
| any (after approved) → (edit) | `workflow.edit` | `{ section_id, diff_hash }` |

---

## 부록 B — API Contract Detail

### B.1 POST /api/ra/workflows/draft-submission

**Request:**
```
Content-Type: application/json
Authorization: Bearer <session>

{
  "product_name": "string (min 3, max 200)",
  "device_class": "I" | "II" | "III",
  "indications_for_use": "string (min 20, max 4000)",
  "target_jurisdiction": "US_FDA" | "EU_MDR" | "KR_MFDS",
  "predicate_k_numbers": ["K123456", ...] (optional, 0-3 items),
  "project_id": "uuid"
}
```

**Response (202 Accepted):**
```
{
  "runId": "uuid v7",
  "streamEventsUrl": "/api/ra/workflows/{runId}/events",
  "estimatedDurationSeconds": 600
}
```

**Response (400 Bad Request):**
```
{
  "error": "ValidationError",
  "issues": [{ "path": "indications_for_use", "message": "Too short" }]
}
```

**Response (403 Forbidden):** — user lacks `workflow:create` permission or rate limit hit
**Response (429 Too Many Requests):** — user exceeds 10 workflows/hour of same type

### B.2 POST /api/ra/workflows/audit-response

**Request (multipart/form-data):**
```
input_type: "fda_483" | "mdsap_deficiency" | "eu_nb_med"
input_format: "pdf" | "text"
input_content: File (max 10MB, PDF) OR string (min 100 chars)
project_id: uuid
establishment_fei: string (optional)
```

**Response schema identical to B.1.**

### B.3 POST /api/ra/workflows/indication-impact

**Request (application/json):**
```
{
  "project_id": "uuid",
  "current_indication": "string (min 20, max 2000)",
  "proposed_indication": "string (min 20, max 2000)",
  "target_markets": ["US"|"EU"|"KR"|"JP"|"CN"] (min 1, max 5)
}
```

### B.4 GET /api/ra/workflows/[runId]/events (SSE)

**Request:** `Last-Event-ID: <id>` (optional, for resume)

**Response:** `text/event-stream`

**Event Types:**
```
event: workflow_start
data: {"runId":"...","workflow_type":"...","started_at":"ISO8601"}

event: step_start
data: {"step_id":"...","step_name":"...","step_number":1,"total_steps":20}

event: step_complete
data: {"step_id":"...","duration_ms":2341,"confidence":0.85}

event: step_fail
data: {"step_id":"...","error":"...","retry_count":2}

event: workflow_progress
data: {"percent":35,"current_step":"...","elapsed_seconds":123}

event: workflow_pending_review
data: {"runId":"...","confidence_aggregate":0.78,"review_url":"/workflows/runs/..."}

event: workflow_done
data: {"runId":"...","status":"approved","result_url":"..."}

event: workflow_failed
data: {"runId":"...","reason":"...","failed_step":"..."}

event: predicate_candidates (submission drafter only)
data: {"candidates":[{"k_number":"K123456","similarity":0.89,"ifu":"..."}, ...]}
```

### B.5 GET /api/ra/workflows/[runId]

**Response (200):**
```
{
  "id": "uuid",
  "workflow_type": "...",
  "status": "...",
  "started_at": "ISO8601",
  "completed_at": "ISO8601 | null",
  "confidence_aggregate": 0.85,
  "result": { ... } (only if status === 'approved'),
  "review_required": true,
  "reviewer_user_id": "uuid | null"
}
```

**Response (403):** if result requested but status != 'approved'

### B.6 GET /api/ra/workflows/[runId]/download

Response: PDF stream (Content-Type: application/pdf) only if status === 'approved'; else 403 WorkflowPendingReview

### B.7 PATCH /api/ra/workflows/[runId]/resume

**Request:**
```
{
  "user_input": { /* workflow-specific resume payload */ },
  "resume_reason": "string (optional)"
}
```

**Response:** 200 OK with new status

### B.8 PATCH /api/ra/workflows/[runId]/review

**Request (admin/ra-lead only):**
```
{
  "action": "approve" | "reject" | "request_change",
  "notes": "string (optional, max 2000 chars)",
  "requested_changes": [{ "section_id": "...", "comment": "..." }] (optional)
}
```

**Response:** 200 OK with updated status

### B.9 PATCH /api/ra/workflows/[runId]/sections/[sectionId]

**Request (reviewer only):**
```
{
  "body_md": "updated Markdown content",
  "edit_reason": "string (optional)"
}
```

**Response:** 200 OK with section snapshot

---

## 부록 C — Acceptance Scenarios (Given-When-Then)

### C.1 Submission Drafter Happy Path

**Scenario: Submit 510(k) for Class II glucose monitor with predicate**
- GIVEN a logged-in ra-member with project "GlucoMonitor Pro"
- AND the project has corresponding openFDA clearance data (K#)
- WHEN the user POSTs draft-submission with product_name="GlucoMonitor Pro", device_class="II", indications_for_use describing home glucose monitoring, target_jurisdiction="US_FDA", predicate_k_numbers=["K123456"]
- THEN the system responds 202 Accepted within 500ms with runId
- AND SSE stream emits workflow_start within 2s
- AND workflow completes 20 sections within 20 minutes P95
- AND workflow transitions to pending_review
- AND an expert_reviews row is created with category="submission_drafter"

**Scenario: Submit 510(k) without specifying predicate**
- GIVEN ... (same)
- WHEN user POSTs without predicate_k_numbers
- THEN workflow pauses after predicate finder step
- AND SSE emits predicate_candidates with top-5 k-numbers
- AND workflow status = paused
- WHEN user PATCHes resume with selected predicate
- THEN workflow resumes from gap analyzer step
- AND status = running

**Scenario: Review gate prevents download before approval**
- GIVEN a workflow with status='pending_review'
- WHEN a user (any role) GETs /download
- THEN response is 403 WorkflowPendingReview
- WHEN admin PATCHes /review with action='approve'
- THEN status transitions to 'approved'
- WHEN user GETs /download
- THEN response is 200 with PDF content

### C.2 Audit Response Parsing Precision

**Scenario: Parse real FDA 483 with 5 observations**
- GIVEN a sample FDA 483 PDF with 5 labeled observations (cited_regulation known)
- WHEN user uploads via POST /audit-response
- THEN parser produces 5 structured observations within 30s
- AND cited_regulation precision = 5/5 = 100% (above 90% SLO)
- AND each observation passes Zod schema validation

**Scenario: Parser handles malformed input**
- GIVEN a PDF with unclear observation text
- WHEN parser runs
- THEN 3 retries attempt with different prompts
- AND on final failure, observation preserved as raw_text with review_required=true
- AND workflow continues to remaining observations

### C.3 Indication Impact Pathway Determinism

**Scenario: Same input produces same pathway output**
- GIVEN input { current: "adults", proposed: "pediatric" }, target_markets: ["US"]
- WHEN workflow runs 10 times sequentially
- THEN all 10 runs produce identical pathway_output.final_recommendation
- AND pathway_output.chart_used is identical across runs
- AND confidence values are identical (no LLM randomness)

**Scenario: Insufficient corpus triggers warning**
- GIVEN KR corpus has 5 reference documents for target_markets=["KR"]
- WHEN workflow C runs
- THEN jurisdiction_table.KR.data_confidence = "low"
- AND summary_recommendation includes warning text about KR expert consultation

### C.4 Legal Review Auto-Flag

**Scenario: Critical observation triggers legal flag**
- GIVEN observation with severity_estimate="critical" (Class III device safety issue)
- WHEN CAPA generator produces response
- THEN legal-review-flagger emits legal_review_required=true
- AND expert_reviews row created with category="legal"
- AND DraftPreview UI highlights the observation with amber Callout

**Scenario: Long timeline triggers legal flag**
- GIVEN CAPA timeline.days = 270 (> 180 threshold)
- WHEN legal-review-flagger runs
- THEN legal_review_required=true
- AND reason="long_commitment"

### C.5 Non-Obvious Constraint Integration

**Scenario: Citation enforcement on draft body**
- GIVEN submission workflow completes draft with 100 sentences
- WHEN citation-enforce post-processor runs on section 11 (SE Discussion)
- THEN sentences without inline `<sup class="cite">` are counted
- AND if uncited_ratio > 20%, section.review_required = true
- AND audit_logs.writeAudit records citation ratio in meta_json

**Scenario: Part 11 disclaimer on all outputs**
- GIVEN draft is approved and downloaded
- WHEN PDF is extracted (pdf-parse)
- THEN every page footer contains disclaimer text
- AND MDX output contains disclaimer component at end
- AND Markdown output contains disclaimer paragraph at end

---

## 부록 D — Milestones (Priority-Based)

본 Phase 9 SPEC은 시간 예측을 사용하지 않으며, 우선순위 및 실행 순서(phase ordering)로만 마일스톤을 정의한다.

### Milestone M1 — Foundational Infrastructure (Priority High)

1. workflow_runs 14th table migration `00XX_workflow_runs.sql` 작성 및 적용
2. workflow_type / workflow_status pgEnum 정의
3. message_blocks.block_type에 'workflow_result' 값 추가
4. audit_action pgEnum에 Phase 9 10개 값 추가 (FOUNDATION inventory 선제 등록 확인)
5. `lib/workflows/types.ts` Zod 스키마 공유 정의
6. Cloudflare Workflows runtime binding 및 MiniFlare 로컬 테스트 환경

### Milestone M2 — Common Infrastructure (Priority High)

1. `lib/workflows/common/template-engine.ts`
2. `lib/workflows/common/confidence-aggregator.ts`
3. `lib/workflows/common/human-handoff.ts`
4. `lib/workflows/common/review-queue.ts` — ENTERPRISE expert_reviews 확장 연결
5. SSE events channel `/api/ra/workflows/[runId]/events` 구현
6. `lib/auth/with-workflow-review.ts` review gate middleware
7. `lib/ai/citation-enforce.ts` 확장 (draft body 컨텍스트 지원)

### Milestone M3 — Workflow A: Submission Drafter (Priority High)

1. `predicate-finder.ts` — openFDA API integration + Vectorize rerank
2. `gap-analyzer.ts` — 5-dimension comparison
3. 20 `section-generators/*.ts` — Sonnet/Haiku routing
4. `comparison-builder.ts` — STRUCTURED comparison block payload
5. `eu-mode.ts` — Annex II/III/GSPR adapter
6. `orchestrator.ts` — Cloudflare Workflow definition (20 steps)
7. UI: `/workflows/draft-submission/page.tsx` + ProgressSteps
8. PDF rendering pipeline — Markdown → MDX → PDF via Puppeteer
9. Integration tests covering REQ-WF-001 ~ 020

### Milestone M4 — Workflow B: Audit Response Drafter (Priority Medium)

1. `observation-parser.ts` — PDF→text + Haiku structured output
2. `regulatory-mapper.ts` — citation injection
3. `capa-generator.ts` — 7-field template + Sonnet
4. `precedent-finder.ts` — dual source merge
5. `legal-review-flagger.ts` — auto-flag conditions
6. `orchestrator.ts` — observation fan-out
7. UI: `/workflows/audit-response/page.tsx`
8. Integration tests covering REQ-WF-021 ~ 035

### Milestone M5 — Workflow C: Indication Impact Analyzer (Priority Medium)

1. `current-state-analyzer.ts` — DMR + openFDA lookup
2. `pathway-tree.ts` — YAML/JSON rule engine (deterministic)
3. `additional-data-estimator.ts` — heuristic data needs
4. `jurisdiction-strategy.ts` — 5-jurisdiction comparison
5. `orchestrator.ts` — 3-step pipeline
6. UI: `/workflows/indication-impact/page.tsx`
7. Integration tests covering REQ-WF-036 ~ 048

### Milestone M6 — UI Polish & Telemetry (Priority High)

1. `/workflows` gallery page
2. `/workflows/runs` history page with filters
3. DraftPreview MDX rendering + inline editor (TipTap or MDXEditor)
4. ReviewGate component + RBAC enforcement
5. WorkflowResultBlock for chat embedding
6. Langfuse integration for workflow step-level traces
7. Cost dashboard for LLM usage per workflow run

### Milestone M7 — Quality Gates (Priority High)

1. Vitest coverage ≥ 85% for `lib/workflows/**`
2. 120 promptfoo eval cases added to LAUNCH harness
3. axe-core 0 violations on all /workflows/* pages
4. audit-completeness CI gate 0 violations
5. Load test 10 concurrent workflows under k6
6. Security review — OWASP Top 10 mapping for new routes
7. Documentation: user-guide, architecture, compliance, review-rubric

---

## 부록 E — Telemetry and Observability

### E.1 Langfuse Trace Structure

각 workflow run은 Langfuse의 trace와 1:1 대응하며, trace name = `workflow.{workflow_type}.{runId}`. Trace 내부:

```
Trace: workflow.submission_drafter.{runId}
├── Span: validate_input (< 100ms)
├── Span: predicate_finder
│   ├── Sub-span: openfda_search_step1
│   ├── Sub-span: openfda_search_step2
│   ├── Sub-span: openfda_search_step3
│   └── Sub-span: vectorize_rerank
├── Span: gap_analyzer (Sonnet call)
├── Span: section_generator.3 (Sonnet)
├── Span: section_generator.5 (Sonnet)
├── ... (17 more section spans)
├── Span: comparison_builder
├── Span: markdown_render
├── Span: mdx_compile
├── Span: pdf_render (Puppeteer)
└── Span: audit_wiring
```

각 LLM span은 input/output token count, cost, latency, model version 자동 기록.

### E.2 Sentry Error Categorization

Workflow 관련 에러는 Sentry tag로 분류:

- `workflow_type: submission_drafter | audit_response | indication_impact`
- `workflow_step: predicate_finder | section_generator | ...`
- `error_category: llm_rate_limit | openfda_api_error | pdf_render_fail | validation_fail | ...`

### E.3 PostHog Product Analytics Events

PII-free events:
- `workflow_triggered` (type, target_jurisdiction, has_predicate)
- `workflow_completed` (type, duration_seconds, confidence_aggregate, section_count)
- `workflow_approved` (type, reviewer_role, notes_length)
- `workflow_rejected` (type, rejection_category)
- `workflow_downloaded` (type, byte_size_kb)
- `workflow_edited` (type, sections_edited, total_diff_chars)

### E.4 Cost Monitoring

Langfuse + Cloudflare Analytics combined:

| Metric | Threshold Alert |
|---|---|
| Monthly LLM cost (aggregate) | > $1000 triggers email alert |
| Per-workflow cost average (submission) | > $3.00 triggers investigation |
| Per-workflow cost average (audit response) | > $1.50 triggers investigation |
| Cloudflare Workflows execution count | > 50K/month triggers budget review |
| R2 storage usage | > 50GB triggers archival review (7-year retention plan) |

---

## 부록 F — Security Considerations

### F.1 OWASP Top 10 2025 Mapping

| OWASP ID | Risk | Phase 9 Mitigation |
|---|---|---|
| A01 Broken Access Control | Unauthorized workflow access | RBAC on all /api/ra/workflows/* routes via ENTERPRISE `with-permission.ts`; download/approve requires admin/ra-lead |
| A02 Cryptographic Failures | Draft contents exposed | PDF stored in R2 with encryption-at-rest; signed URLs with short TTL |
| A03 Injection | SQL injection via input_json | Drizzle parameterized queries; Zod validation on all inputs |
| A04 Insecure Design | Review gate bypass | Server-side enforcement(REQ-WF-056); client-side cannot override |
| A05 Security Misconfiguration | PDF with metadata leaks | Puppeteer sandbox; explicit metadata whitelist(REQ-WF-020) |
| A06 Vulnerable Components | Puppeteer / pdf-parse CVEs | pnpm audit CI gate (LAUNCH); dependabot |
| A07 Identification and Auth Failures | Session hijack | Inherit from FOUNDATION Auth.js v5 sessions; SameSite=Lax cookies |
| A08 Software and Data Integrity | PDF tampering | Audit log download events(who, when); content hash in workflow_runs.result_json |
| A09 Security Logging | Missing audit trail | workflow 10 events all in audit_logs append-only |
| A10 SSRF | openFDA URL injection | Hardcoded openFDA base URL; allowlist only api.fda.gov |

### F.2 Input Sanitization

- PDF upload: mime-type check, size ≤ 10MB, virus scan(ClamAV or Cloudflare sandbox)
- Text input: HTML/Markdown sanitized via DOMPurify before persistence
- indication_for_use: max 4000 chars enforced by Zod; no executable content
- predicate_k_numbers: regex `/^K\d{6}$/` enforced

### F.3 Rate Limiting

Per user, per workflow_type:
- 10 workflow creations per hour (HTTP 429 on exceed)
- 3 concurrent workflows in non-terminal states (new creation rejected)
- Per-organization monthly budget alert (operator configurable)

### F.4 Audit Log Immutability

workflow 이벤트 audit_logs row는 FOUNDATION append-only trigger로 UPDATE/DELETE/TRUNCATE 차단. workflow_runs table은 UPDATE 허용(status 전이 필요)이나 INSERT/UPDATE 자체도 audit_logs에 기록되어 immutable trace 확보.

---

## 부록 G — Glossary 및 약어 (Phase 9 특화)

- **Submission Drafter:** Workflow A — 510(k) / De Novo / EU MDR technical documentation 초안 생성 워크플로우
- **Audit Response Drafter:** Workflow B — FDA 483 / MDSAP deficiency 응답 초안 생성 워크플로우
- **Indication Impact Analyzer:** Workflow C — indication 변경 시 pathway + jurisdiction 영향 분석 워크플로우
- **Predicate:** subject device와 substantial equivalence 판단 기준이 되는 legally marketed device (21 CFR 807.92)
- **SE (Substantial Equivalence):** 510(k) 승인의 핵심 기준 (same intended use + technological characteristics similar or as safe and effective)
- **Letter to File (LtF):** 제조사 내부 change control 문서, FDA 제출 불요한 변경사항 기록 (21 CFR 820.30)
- **eSTAR:** FDA electronic Submission Template And Resource, 510(k) 제출 표준 포맷
- **eCopy:** FDA Electronic Copy Program (CDRH 제출 물리적 보조)
- **DMR:** Device Master Record (21 CFR 820.181) — 조직 제품 공식 스펙
- **DHF:** Design History File (21 CFR 820.30(j)) — 설계 history 기록
- **CAPA:** Corrective and Preventive Action — 483 response의 핵심 4-component(containment/correction/prevention/verification)
- **FEI:** FDA Establishment Identifier — FDA 등록 제조 시설 고유번호
- **NB (Notified Body):** EU MDR 인정 제3자 인증 기관 (e.g., BSI, TÜV, DEKRA)
- **GSPR:** General Safety and Performance Requirements (MDR Annex I, 23개 항목)
- **CER:** Clinical Evaluation Report (MEDDEV 2.7/1 Rev4)
- **MDSAP:** Medical Device Single Audit Program — 5개국(US/EU/JP/CA/BR) 통합 감사
- **MFDS:** Ministry of Food and Drug Safety (Korea, 한국 식약처)
- **PMDA:** Pharmaceuticals and Medical Devices Agency (Japan)
- **NMPA:** National Medical Products Administration (China)
- **Shonin (承認):** PMDA full approval (Class III/IV)
- **Ninsho (認証):** PMDA third-party certification (Class II)
- **SSED:** Summary of Safety and Effectiveness Data — PMA 공개 review summary
- **Review Gate:** 인간 reviewer 승인 전 draft download 금지하는 server-side enforcement 메커니즘
- **Part 11 Disclaimer:** 모든 AI-보조 draft에 자동 삽입되는 법적 경고 footer

---

## 부록 H — Traceability Matrix

요구사항 ↔ research ↔ handoff ↔ test 매핑.

| REQ-WF | Research Section | Handoff Ref | Test Type |
|---|---|---|---|
| 001 | H.4 | §11.9 | Vitest + MSW |
| 002, 003, 004 | B | §11.9 | Integration (openFDA stub) |
| 005, 006, 007 | A | §11.9 | Eval harness(promptfoo) |
| 008 | A.3 | §11.9 | Fault injection |
| 009 | C.3 | §8.5 | Unit + STRUCTURED schema import |
| 010, 011 | H.3 | §11.9 | Load test + fault injection |
| 012 | C, F | §11.9 | Integration (EU mode) |
| 013 | A.3 | §8.5 | Unit |
| 014 | M.1 | §16 | Unit (citation post-processing) |
| 015 | J.3 | — | MDX compiler test |
| 016 | J.2 | §19 | Integration (PDF extract) |
| 017 | K | §16 | Integration + curl-level |
| 018 | L, M.1 | §16 | audit-completeness static |
| 019 | B.2 | — | Integration (KV cache) |
| 020 | J.2 | §19 | pdf-parse extract |
| 021, 022 | D.1 | §11.9 | Vitest + MSW + PDF sample |
| 023 | D.2, D.3 | §19 | promptfoo labeled set |
| 024 | D.3 | — | Unit (Zod schema) |
| 025 | D.5 | §16 | Integration (Vectorize seeded) |
| 026, 027 | D.4 | — | Unit (CAPA fields) |
| 028 | D.5 | §19 | Integration (dual corpus) |
| 029 | D.6 | §16 | Unit (flag conditions) |
| 030 | I.1, M.1 | — | Unit (confidence formula) |
| 031 | D.1 | — | Unit (format routing) |
| 032, 033 | J | — | Integration (doc assembly) |
| 034 | K | §16 | Integration (review gate) |
| 035 | L, M.1 | §16 | audit-completeness |
| 036 | E, G | §11.9 | Vitest + MSW |
| 037 | E | §11.9 | Integration (DMR + openFDA) |
| 038, 039, 040 | E.2, E.3 | — | Unit (rule engine determinism) |
| 041 | E.5 | §19 | Unit (data categories) |
| 042, 043, 044 | G | §11.9 | Integration + load |
| 045 | G.5 | — | Integration (seed corpus) |
| 046, 047 | E, G | — | Integration (result assembly) |
| 048 | L, M.1 | §16 | audit-completeness |
| 049, 050, 051, 052 | L | §12 | Drizzle introspection + pg_type SELECT |
| 053 | H | — | Cloudflare MiniFlare integration |
| 054 | H.4 | §11.1 | SSE integration |
| 055 | I.1 | — | Unit (formula verification) |
| 056 | K.2 | §16 | Integration + curl-level |
| 057 | K.3 | §16 | Integration (expert_reviews join) |
| 058 | K.4 | §16 | Unit (disclaimer enforcement) |
| 059, 068 | J | §14, §15 | Playwright + axe-core |
| 060, 061, 062 | J | §7 | Playwright |
| 063, 064, 065 | J, K | §11.1 | Playwright + Storybook |
| 066 | L.3 | §8 | Storybook + Vitest |
| 067 | J | §7.5 | Playwright |

---

## 부록 I — SPEC Version Policy

본 SPEC은 Phase 9 착수 이전 cross-spec-audit iteration을 거쳐 v0.2.0 이상으로 승격된 후에만 RUN 단계 진입을 허용한다. 변경 이력 정책은 FOUNDATION SPEC v0.4.0 revision_history 패턴을 따른다.

### I.1 Allowed Modifications Post-v0.1.0

- `revision_history` 추가(AUDN findings 적용 기록)
- `Dependencies` 선결 조건 세부 조정
- `Out of Scope` 항목 명확화(스코프 경계 강화만 허용)
- `Technical Decisions` 재평가 조건 추가

### I.2 Forbidden Modifications

- REQ-WF-NNN ID 재배치 또는 삭제 (audit trail 보존)
- 기존 REQ 의미 반전 (Testable 속성 훼손)
- 스코프 확대 (Out of Scope 축소) — 확대는 별도 SPEC 권장
- FOUNDATION / CHAT / STRUCTURED / ENTERPRISE / LAUNCH 의존성 제거

### I.3 Version Bump Rules

- Patch(v0.1.x): 오탈자, 링크 수정, 테스트 기법 구체화
- Minor(v0.x.0): AUDN/audit finding 반영, 새 REQ 추가(맨 뒤 번호 연결)
- Major(v1.0.0): Run 단계 완료 후 production ready 선언 시

---

*End of SPEC — SPEC-REGULA-WORKFLOWS-001 v0.1.0*
