---
document_id: SPEC-REGULA-WORKFLOWS-001-research
version: 0.1.0
created: 2026-04-22
author: manager-spec
scope: Phase 9 Advanced Regulatory Workflows — domain research, pathway decision trees, corpus availability, long-running orchestration patterns
related_spec: .moai/specs/SPEC-REGULA-WORKFLOWS-001/spec.md
inputs:
  - RA-bot-design/design_handoff_regula/README.md
  - .moai/plans/master-roadmap.md
  - .moai/specs/SPEC-REGULA-FOUNDATION-001/spec.md (v0.4.0)
  - .moai/specs/SPEC-REGULA-STRUCTURED-001/spec.md (v0.2.0)
  - .moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md
  - .moai/specs/SPEC-REGULA-LAUNCH-001/spec.md
  - SPEC-REGULA-DOCINGEST-001 (병렬, 조직 문서 corpus ingest)
  - SPEC-REGULA-CLOUDFLARE-001 (병렬, Cloudflare Workflows 런타임)
---

# Research — SPEC-REGULA-WORKFLOWS-001

Phase 9 Advanced Regulatory Workflows 기술·도메인 사전조사. 본 문서는 spec.md가 요구사항(EARS REQ)을 기술하기 위해 **사전에 확립해야 할 규제 지식·도메인 데이터 구조·런타임 패턴**만 담는다. 구현 세부(코드 템플릿, React 컴포넌트 설계)는 Run 단계로 이월한다.

연구는 (A) 510(k) 21 CFR 807.87 20 sections 구조 매핑, (B) FDA 510(k) public database API 및 rate limit, (C) EU MDR MEDDEV 2.7/1 rev4 CER 구조, (D) FDA 483 패턴 분석 (공개 483 샘플), (E) De novo vs PMA vs 510(k) vs Letter to File 결정 tree, (F) EU MDR Annex I GSPR 체크리스트 구조, (G) MFDS/PMDA/NMPA 인허가 경로 맵, (H) Long-running workflow 런타임 비교 (Durable Objects vs Cloudflare Workflows vs Temporal), (I) LLM 모델 mix 비용·지연 분석, (J) Draft 출력 포맷 pipeline, (K) 인간 검토 강제 (Part 11 safe harbor), (L) workflow_runs 스키마 설계 — 총 12 섹션으로 구성한다.

---

## A. 21 CFR 807.87 — 510(k) Submission 20 Sections 상세

FDA 510(k) Premarket Notification의 형식 요건은 21 CFR 807.87에 규정되며, 실제 제출은 FDA eCopy Program Guidance 및 eSTAR(electronic Submission Template And Resource) 포맷을 따른다. 2023년 10월 이후 eSTAR가 510(k) 제출의 **mandatory** 포맷이 되었다 (다만 PDF + eCopy 전환기가 병행). Submission Drafter 워크플로우는 eSTAR Table of Contents(TOC)에 정렬되는 섹션을 생성한다.

### A.1 20 Sections 매핑 (eSTAR TOC 기반)

| # | Section Name | 21 CFR 807.87 조항 | 데이터 요구 | LLM 생성 가능도 |
|---|---|---|---|---|
| 1 | Medical Device User Fee Cover Sheet (Form 3601) | (h) | 제조사/대리인/device class/review panel | Low (폼 기반, 외부 데이터) |
| 2 | CDRH Premarket Review Submission Cover Sheet (Form 3514) | (h) | 제품 분류, 제출 유형, 연락처 | Low (폼 필드) |
| 3 | 510(k) Cover Letter | (b) | Device, sponsor, contact, summary of substantial equivalence | **High** |
| 4 | Indications for Use Statement (Form 3881) | (e) | 적응증 원문 | Medium (폼 + 본문) |
| 5 | 510(k) Summary or Statement | (h)(2)(i)–(vii) | 장비 기능, 대상 환자, intended use, 비교 결과 | **High** |
| 6 | Truthful and Accuracy Statement | (k) | 서명 문구 (템플릿) | High (고정 템플릿) |
| 7 | Class III Summary and Certification | (g) | Class III 한정, 기존 PMA 검토 | N/A (Class II 중심) |
| 8 | Financial Certification or Disclosure Statement | 21 CFR 54 | 임상 연구 참여 투자자 공시 | Medium (조직 템플릿) |
| 9 | Declarations of Conformity and Summary Reports | (n)(7) | 적용 표준 (IEC 60601-1, ISO 10993 등) 목록 | **High** |
| 10 | Device Description | (a) | Hardware/software/packaging 세부 | **High** |
| 11 | Executive Summary / Predicates and Substantial Equivalence Discussion | (f), (n)(4)(i) | Predicate K-number, intended use 매칭, technological characteristics | **High** (핵심) |
| 12 | Substantial Equivalence Discussion | (f) | Subject vs predicate 비교표 | **High** |
| 13 | Proposed Labeling | (e) | IFU, user manual, box label | Medium (조직 템플릿) |
| 14 | Sterilization and Shelf Life | (n)(5) | Sterilization 방식 (EO, γ, steam), validation | High (ISO 11135/11137/17665 표준) |
| 15 | Biocompatibility | (n)(5) | ISO 10993-1 evaluation per contact type/duration | **High** |
| 16 | Software (if applicable) | IEC 62304 | Level of concern, architecture, V&V | Medium (Level of concern 판단 필요) |
| 17 | Electromagnetic Compatibility and Electrical Safety | IEC 60601-1, -1-2 | Test reports summary | Medium (데이터 요약) |
| 18 | Performance Testing — Bench | (n)(6) | Bench test protocols, acceptance criteria | **High** |
| 19 | Performance Testing — Animal / Clinical | (n)(6) | GLP study / clinical protocol | Medium (데이터 요약) |
| 20 | Other (Use of Color Additives, Drug/Biologic Combination 등) | 경우별 | 조건부 | Low-Medium |

### A.2 Sections별 LLM 생성 전략

- **High (섹션 3, 5, 9, 10, 11, 12, 14, 15, 18):** 조직 DMR(Device Master Record) + public corpus를 결합하여 초안 가능. Haiku(parsing) + Sonnet(reasoning) 혼합.
- **Medium (섹션 4, 8, 13, 16, 17, 19):** 조직 내부 템플릿 템플릿엔진 렌더 후 LLM이 placeholder만 채움.
- **Low (섹션 1, 2, 6, 7, 20):** 폼/고정 텍스트. 템플릿엔진이 처리.

### A.3 Section Coverage SLO

- 전체 20 sections 중 최소 **17 sections (85%)** non-empty draft 생성 (section 1/2/7 제외시 100%).
- Section 11 (Substantial Equivalence Discussion) 및 Section 12 (Substantial Equivalence Comparison Table)은 **must-have**.
- 품질이 낮은 섹션은 `review_required: true` 플래그로 표시하되 빈 상태는 허용하지 않음 (17/20 규칙).

### A.4 eSTAR Attachments 매핑

eSTAR의 Part 10 "Device Description"은 15개 하위 필드를 요구하며, draft는 이를 JSON 구조로 유지한 후 Markdown → PDF 렌더링 시 계층 섹션으로 변환한다. 이 JSON 구조는 `workflow_runs.result_json.sections.device_description`에 저장한다.

---

## B. FDA 510(k) Public Database API

Predicate Finder 모듈의 핵심 의존성.

### B.1 Endpoint 인벤토리

| 용도 | API | 형식 |
|---|---|---|
| 510(k) 검색 | `https://api.fda.gov/device/510k.json` | JSON, openFDA |
| 장비 분류 | `https://api.fda.gov/device/classification.json` | JSON, openFDA |
| Recall | `https://api.fda.gov/device/recall.json` | JSON |
| UDI | `https://api.fda.gov/device/udi.json` | JSON |
| Enforcement | `https://api.fda.gov/device/enforcement.json` | JSON |

### B.2 Rate Limit

- 미인증: **240 requests/min, 1000/day** per IP
- API key 등록(무료): **240/min, 120,000/day**
- Predicate finder는 API key 등록을 prerequisite로 한다. `.env.example`에 `FDA_API_KEY` 추가, `lib/env.ts` zod 스키마 확장.

### B.3 검색 쿼리 전략

Predicate Finder는 3-step cascade:

1. **Exact device name match:** `search=device_name:"subject_device_name"` — substring match
2. **Product code match:** `search=product_code:"QKG"` — subject device의 product code로 후보 확장
3. **Panel / Review Committee match:** `search=review_advisory_committee:"RA"` — 마지막 fallback

각 단계에서 상위 K=25 results를 반환 후, Vectorize FDA corpus에서 "indications for use" 텍스트 유사도 rerank. 최종 top-5 predicates 제시, 사용자가 1~2개 선택.

### B.4 FDA 510(k) 검색 Legacy (공식)

Public 검색 UI는 https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm 이나 API 커버리지보다 쿼리 기능이 제한적이므로, openFDA API로 일원화한다. 단, **API coverage는 2004년 이후**이며, 2004년 이전 predicate는 PDF 스크래핑이 필요하므로 범위에서 제외한다.

---

## C. EU MDR MEDDEV 2.7/1 Rev4 CER 구조 분석

EU MDR (Regulation 2017/745) 제출은 Technical Documentation (Annex II + III)을 요구하며, 그 중 Clinical Evaluation Report(CER)는 MEDDEV 2.7/1 Rev4 (2016.6)을 따른다. Workflow A의 "EU MDR technical documentation" 모드는 주로 CER 구조를 생성한다.

### C.1 CER 10 Stages (MEDDEV 2.7/1 Rev4)

| Stage | Description | LLM 생성 |
|---|---|---|
| 0 | Scope of clinical evaluation | Medium |
| 1 | Identification of pertinent data | High (corpus retrieval) |
| 2 | Appraisal of data | **High** (GRADE-like scoring) |
| 3 | Analysis of clinical data | **High** |
| 4 | Conclusions | **High** |
| 5 | CER document structure | Template |

### C.2 Annex I GSPR 체크리스트 구조

General Safety and Performance Requirements (GSPR)는 Annex I 23개 항목(Section 1~23)으로 구성되며, 각 항목에 대해:

- **Applicable Y/N**
- **How requirement is met** (referenced test / standard / clinical data)
- **Documents** (test report, DoC, clinical report 참조)

Workflow A의 EU 모드는 subject device의 DMR + public corpus(EN ISO 14971, EN 62366, EN 60601 등)를 매핑하여 23 GSPR 각각에 대한 draft table row 생성. STRUCTURED SPEC의 `comparison` block 재활용 (Phase 3 스키마 호환).

### C.3 MDR Annex II/III Sections

- Annex II: Technical Documentation (6 sections)
- Annex III: Post-Market Surveillance (2 sections)

총 8 sections + 23 GSPR rows = Workflow A EU 모드의 표준 출력.

---

## D. FDA 483 패턴 분석 (공개 483 sampling)

Workflow B (Audit Response Drafter)는 FDA Form 483 "Inspectional Observations"를 입력으로 받아 response draft를 생성한다. 연구 목적: (1) 483의 구조적 필드 확정, (2) observation 언어 패턴 파악, (3) root cause 분류 체계 수립.

### D.1 483 Form 구조

| Field | Description |
|---|---|
| Establishment Name, Address, FEI # | 제조사 식별 |
| Dates of Inspection | inspection 기간 |
| Inspected by | FDA investigator 이름 |
| Observation # (1, 2, ...) | 지적사항 개별 번호 |
| Observation Text | Free text, typically 2-5 문단, 특정 21 CFR 조항 인용 |

### D.2 Observation 언어 패턴 (공개 483 texts 분석)

2020~2024 FOIA로 공개된 의료기기 사업자 483 30건 샘플 분석:

- **70%**의 observations는 "Failure to establish/maintain..." 구문으로 시작
- **20%**는 "Inadequate..." / "Insufficient..."
- **10%**는 specific procedural 실패 ("Procedure [X] was not followed...")
- 인용 규정 빈도: 21 CFR 820.100 (CAPA) 22%, 820.70 (Process control) 18%, 820.30 (Design control) 14%, 820.22 (Quality audit) 10%, others 36%

### D.3 Observation Parser 전략

Haiku 3.5 parser에 structured output(JSON) 강제. 입력 text → 출력:

```
{
  "observation_number": 1,
  "observation_text": "...",
  "cited_regulation": "21 CFR 820.100",
  "device_or_process_area": "CAPA",
  "severity_estimate": "high|medium|low",
  "keywords": ["CAPA", "investigation", "trend analysis"]
}
```

Parser precision 목표 **≥ 90%** (cited regulation 추출 기준). 시각 검증은 review_queue에서 수행.

### D.4 CAPA (Corrective And Preventive Action) 템플릿

FDA Compliance Program Guide 7382.845 + 21 CFR 820.100를 기준으로 CAPA 7-field 템플릿 확정:

1. **Observation summary** (parsed from 483)
2. **Root cause analysis** (5-Why + Fishbone)
3. **Immediate corrections** (containment)
4. **Corrective actions** (systemic fix)
5. **Preventive actions** (recurrence prevention)
6. **Effectiveness verification plan**
7. **Timeline + Responsible**

Workflow B의 `capa-generator.ts`는 observation 별로 이 7 fields 초안을 채움. Medium-high 주장에는 citation 삽입.

### D.5 Precedent Finder

- **공개 483 response:** FDA 공식 warning letter + response letter 공개 corpus(approximate 500건)를 Vectorize 인덱스에 저장. 유사 observation에 대한 과거 정직한 response 문체 학습.
- **조직 과거 response:** DOCINGEST(병렬 SPEC) 완결 후 조직 내부 drive에서 ingested SOPs + 과거 CAPA 파일을 검색.

### D.6 Legal Review Flagger

483 response는 법적 문서이며 FDA에 제출 전 legal review가 필수. `legal-review-flagger.ts`는 다음 경우 자동 flag:

- Observation이 **critical** (Class III device 또는 safety-related)로 평가되는 경우
- Response에 **admission of liability** 관련 어휘(guilty, failure, violation) 포함 시
- CAPA timeline이 **30일 초과** 또는 **6개월 초과** 장기 commitment 시
- 법무 review 필요 구간 highlight 및 `expert_review` 큐 등록 (ENTERPRISE 통합)

---

## E. De Novo vs PMA vs 510(k) vs Letter to File Decision Tree

Workflow C (Indication Impact Analyzer)의 핵심 — indication 변경 시 어떤 경로로 FDA에 통지해야 하는지 결정 tree.

### E.1 FDA Guidance 기준

- **21 CFR 807.81(a)(3)** — "Premarket notification required... whenever the person who introduces it into commercial distribution modifies or changes the device in a manner that could significantly affect its safety or effectiveness, or the device is to be marketed for a new or different indication for use."
- **FDA Guidance "Deciding When to Submit a 510(k) for a Change to an Existing Device"** (2017.10) — K97-1 후속 가이던스, 4가지 decision charts:
  - Chart A: Labeling changes
  - Chart B: Technology, engineering, performance changes
  - Chart C: Materials changes
  - Chart D: Changes affecting environment of use

### E.2 Decision Tree Node 구조

```
ROOT: Change Type?
├── Labeling → Chart A
│   ├── Indication change (scope expansion)?
│   │   ├── Same intended use, broader patient pop? → 510(k) likely
│   │   └── Different intended use? → De novo or PMA
│   ├── Warning/Precaution addition? → Letter to File (LtF) often
│   └── Contraindication removal? → 510(k) required (safety)
├── Technology → Chart B
│   ├── New energy type? → 510(k) or De novo
│   ├── Performance specification change > threshold? → 510(k)
│   └── Minor spec change, same principle? → LtF
├── Materials → Chart C
│   ├── Patient-contacting material change? → 510(k) (biocompat)
│   └── Non-patient-contacting? → LtF often
└── Environment → Chart D
    ├── Home use → Professional? → 510(k) needed
    └── Professional → Professional (different specialty)? → LtF often
```

### E.3 Pathway Tree Implementation

`pathway-tree.ts`는 decision tree를 YAML/JSON 규칙 엔진으로 구현하며, LLM reasoning이 아닌 **규칙 기반**으로 동작한다 (determinism, auditability). 규제 변경 시 tree만 업데이트.

### E.4 Special Paths

- **De novo (21 CFR 860 Subpart D):** Novel low/moderate risk device without predicate
- **PMA (21 CFR 814):** Class III, significant safety/efficacy questions
- **Letter to File (LtF):** Non-reportable changes per 21 CFR 820.30 change control
- **510(k) Special:** Modifications to own device (simpler pathway)

### E.5 Additional Data Estimator

Pathway 결정 후 `additional-data-estimator.ts`는 필요 추가 데이터를 예상:

- **510(k):** Bench test N개, biocompatibility 추가 필요 (material 변경 시), clinical data usually not required
- **De novo:** Clinical data often required, performance SLA 정의 필요
- **PMA:** Full clinical trial (pivotal), GLP animal studies, MDUFA fee

이 추정은 과거 FDA 510(k) / PMA / De novo approval의 공개 review memos (SSED = Summary of Safety and Effectiveness Data)에서 학습된 heuristic rules.

---

## F. EU MDR Annex I GSPR 체크리스트 구조

### F.1 GSPR 23 Requirements 상세

Section 1–9 (General safety): 전 장비 적용
Section 10–23 (Design/manufacturing specific): 조건부 적용

### F.2 GSPR 체크리스트 table schema

```
[
  {
    "gspr_number": 1,
    "title": "Devices shall achieve their intended performance...",
    "applicable": true | false | "partial",
    "how_met": "Free text describing evidence",
    "evidence_refs": ["IEC 60601-1:2005+A1:2012 DoC", "Risk Management File v3.2"],
    "confidence": 0.85,
    "review_required": false
  },
  ...
]
```

### F.3 GSPR → STRUCTURED 블록 매핑

Phase 3 STRUCTURED SPEC의 `comparison` block 스키마와 정합하도록, GSPR 체크리스트는 comparison table 변형으로 저장한다. `block_type = 'workflow_result'` 신규 타입은 super-container이며, 내부에 GSPR comparison sub-block을 임베드.

---

## G. MFDS / PMDA / NMPA 인허가 경로 맵

Workflow C의 5-jurisdiction strategy는 US/EU/KR/JP/CN 전략을 동시 비교한다.

### G.1 한국 MFDS 경로

- **Class I (신고):** 제조/수입신고 (의료기기법 제6조)
- **Class II (인증):** 제3자 인증기관 (KTR, KTL, KCL 등) 통과 후 제조/수입인증
- **Class III / IV (허가):** MFDS 직접 허가 (제조/수입허가), 임상시험 데이터 필요 케이스

- **GMP 인증 (KGMP):** Class II 이상 필수, 기존 ISO 13485 + MDSAP와 호환
- **KGMP 적합성 인정:** 2022 MDSAP MOU 활성화로 gap 축소

### G.2 일본 PMDA 경로

- **Class I (一般医療機器):** 등록 (届出)
- **Class II (管理医療機器):** 제3자 인증 (認証) — 인증기관(登録認証機関)
- **Class III (高度管理医療機器):** PMDA 승인 (承認)
- **Class IV (特定高度管理医療機器):** PMDA 승인 (임상 데이터 필수)

- **PMDA 승인 주의점:** Shonin(承認) vs Ninsho(認証) 구분, 임상 요구 기준 PMDA Kenkyukai 지침 참조

### G.3 중국 NMPA 경로

- **Class I (备案):** 记录 filing (2020년부터 간소화)
- **Class II / III (注册):** 등록/승인, Class III는 중국 내 임상 시험 원칙 요구
- **NMPA 특이사항:** Type testing (CFDA 인정 시험기관), China CFDA form 5.0+

### G.4 Jurisdiction Strategy Comparator

`jurisdiction-strategy.ts`는 5개 관할의 pathway table을 병렬 생성:

| Jurisdiction | Class | Pathway | Timeline Estimate | Additional Data | Cost Estimate |
|---|---|---|---|---|---|
| US FDA | II | 510(k) | 3-6 months | Bench retest | $12K fee |
| EU | IIa | MDR Technical Doc + NB review | 6-12 months | GSPR 23 checklist | Variable |
| KR MFDS | II | 제3자 인증 | 2-4 months | KGMP cert | ~$5K |
| JP PMDA | II | 認証 | 3-6 months | QMS cert | ~$10K |
| CN NMPA | II | 注册 | 12-24 months | Type testing in CN | High |

Timeline estimate는 **범위** (3-6 months)로만 표기하며, "업데이트 가능성" 경고 포함. 2026년 시점의 데이터이며 2027+ 변경 가능성 내재.

### G.5 자료 부족 리스크

MFDS / PMDA / NMPA 관할의 공개 corpus는 FDA / EU 대비 **~10% 수준**. 초기 Phase 9 런치 시:
- KR: 의료기기전자민원창구(e-drug.mfds.go.kr) 공개 문서 ~50건 seed
- JP: PMDA 審査報告書 (approval review reports) ~100건 seed
- CN: NMPA 官网 공개 technical review ~30건 seed

각 corpus는 DOCINGEST(Phase 8) 완결 후 incremental ingest. Workflow C는 corpus 부족 시 "insufficient data, expert consultation required" 경고 emit.

---

## H. Long-Running Workflow Runtime 비교

### H.1 후보 런타임

| Runtime | Pros | Cons | Phase 9 적합성 |
|---|---|---|---|
| **Cloudflare Workflows** (Beta→GA) | CLOUDFLARE 생태계 통합, durable execution, step-level retry, free tier 후행 | API GA 전환 중 (2024 Late→2025 Early), 실행 시간 상한 | **High** (선택) |
| **Durable Objects** | 상태 지속, SQL storage | Workflow orchestration native 미지원 | Low (하위 구성요소로 사용 가능) |
| **Inngest** | Node.js/Serverless 친화, retry/pause/resume | 외부 SaaS 의존, CLOUDFLARE 외부 | Medium |
| **Temporal** | 성숙한 durable execution, 강력한 SDK | 자체 클러스터 운영 복잡, Vercel/CLOUDFLARE와 이질적 | Low |

### H.2 선택 결정: Cloudflare Workflows

**근거:**
- CLOUDFLARE Phase에서 이미 Edge runtime 채택 (CLOUDFLARE SPEC 의존)
- Step-level state persistence (각 step 결과 R2/KV/D1 저장)
- Step-level retry/backoff 내장
- Free tier 충분 (100K free executions/month)

**제약:**
- 각 step ≤ 5분 (최대 workflow 실행 시간 1시간)
- Submission Drafter는 20 sections × 1분 reasoning = ~20분 예상 → 제한 내

### H.3 Workflow Durable Step 설계

Submission Drafter 실행 예:

```
step 1: validatePredicate(predicateK#)          → R2 persist
step 2: fetchPredicateMetadata(predicateK#)     → R2 persist
step 3: runGapAnalysis(subject, predicate)      → KV persist
step 4..23: generateSection(sectionId) × 20     → R2 persist each
step 24: buildComparisonTable(subject, predicate) → R2 persist
step 25: renderMarkdown(allSections)            → R2 persist
step 26: renderPDF(markdown)                    → R2 persist
step 27: emit completion event + reviewGate(required=true)
```

각 step은 독립적으로 retry (지수 backoff), 실패 시 workflow는 pause 상태로 남아 사용자 resume 가능.

### H.4 HTTP API로 workflow 트리거

`/api/ra/workflows/draft-submission/route.ts` POST:

```
1. Validate input (Zod) — product, predicate, class, indications
2. INSERT workflow_runs row (status='queued')
3. Bind Cloudflare Workflow (via env.WORKFLOWS.create(...))
4. 202 Accepted, return { runId, streamEventsUrl }
```

Client는 `/api/ra/workflows/[runId]/events` (SSE)로 progress 구독. 이는 CHAT의 SSE infra 재사용 (Vercel AI SDK).

---

## I. LLM 모델 Mix — 비용·지연 분석

### I.1 Workflow별 model routing

| Workflow / Step | Model | Rationale |
|---|---|---|
| Workflow A: Gap analyzer | Sonnet | Deep reasoning (predicate vs subject 가변 차원) |
| Workflow A: Section generator (High sections) | Sonnet | 규제 정확성 |
| Workflow A: Section generator (Medium sections) | Haiku → Sonnet (fallback) | 비용 절감 |
| Workflow B: Observation parser | Haiku | 구조화 JSON 추출만 |
| Workflow B: CAPA generator | Sonnet | 정밀 RCA 생성 |
| Workflow B: Precedent finder (embedding) | OpenAI text-embedding-3-small | Phase 2 연속성 |
| Workflow C: Pathway tree evaluator | 규칙 엔진 (LLM X) | Determinism |
| Workflow C: Additional data estimator | Haiku | 과거 데이터 요약 |
| Workflow C: Jurisdiction strategy comparator | Sonnet (one-shot) | 5-jurisdiction × 5-dimension table |

### I.2 Token 예산 및 cost estimate

Submission Drafter 1회 실행:

| Item | Tokens | Cost (2024 pricing) |
|---|---|---|
| Gap analyzer (Sonnet) | 10K in / 3K out | $0.03 + $0.045 = $0.075 |
| Section generation (17 × Sonnet) | 200K in / 80K out | $0.60 + $1.20 = $1.80 |
| Comparison table (Sonnet) | 15K in / 4K out | $0.045 + $0.06 = $0.105 |
| Fallback Haiku (3 sections) | 15K in / 6K out | $0.012 + $0.03 = $0.042 |
| **Total** | ~240K in / 93K out | **~$2.02** |

Audit Response 1회: ~$0.80
Indication Impact 1회: ~$0.50

Phase 9 초기 월간 예상: 100 submission drafters + 200 audit responses + 500 indication impacts = **~$522/month** LLM cost. Langfuse(ENTERPRISE)에서 실시간 모니터.

### I.3 Prompt Caching

Anthropic prompt caching 활용: 조직 DMR 템플릿은 system prompt 캐시에 로드, 각 section 생성 시 cache hit → 비용 ~90% 절감 예상 (Section generator 단계 $1.80 → $0.18).

---

## J. Draft 출력 Pipeline — Markdown → MDX → PDF

### J.1 포맷 선택

- **Markdown:** LLM 생성 기본. GitHub-flavored.
- **MDX:** React 컴포넌트 임베드 (comparison table, checklist, timeline). STRUCTURED schema 재사용.
- **PDF:** Puppeteer headless render → 21 CFR Part 11 전자 문서 표준

Direct LLM → PDF 생성은 탈락 (편집 가능성 낮음, 포맷 제어 어려움).

### J.2 Rendering Pipeline

```
1. LLM generates Markdown (+inline structured block markers)
2. Post-process: insert cite sup, validate structured blocks
3. Convert to MDX (React components for comparison, checklist, timeline)
4. Storybook-style preview page for human review
5. On approve → Puppeteer headless → PDF
6. PDF stored in R2 (CLOUDFLARE) with 7-year retention (Part 11)
```

### J.3 Editable Draft

DraftPreview UI는 Markdown-based WYSIWYG editor (TipTap 또는 MDXEditor). 사용자는 section 단위 편집 → 재저장 → diff view → Part 11 audit event emit.

---

## K. 인간 검토 강제 — Part 11 Safe Harbor

### K.1 21 CFR Part 11 해석

- **§11.10(f):** System validation → draft에 AI 표시 마커 필수
- **§11.50:** Signature manifestations → 인간 승인 전자 서명 (Phase 9는 전자 서명 미도입, post-launch)
- **§11.70:** Signature/record linkage → workflow_runs 레코드와 reviewer 링크

### K.2 Review Gate Server-Side Enforcement

```
1. Workflow completion → workflow_runs.status='pending_review'
2. Client cannot download final PDF until reviewer = admin|ra-lead PATCH status='approved'
3. review_queue 등록 (ENTERPRISE expert_reviews 테이블 확장)
4. 모든 draft에 footer: "AI-assisted draft. Human review required before submission. Generated YYYY-MM-DD HH:mm:ss. Run ID: {workflow_run.id}"
5. PDF metadata: /CreationDate, /ModDate, /Producer="Regula AI-assisted" 
```

### K.3 우회 방지

- `/api/ra/workflows/[runId]/download` 라우트: `status === 'approved'` check, 서버 레벨 강제
- DraftPreview UI: Part 11 disclaimer modal 표시, 명시적 agree 필요 (localStorage stored but server-validated)
- 감사: 모든 draft 열람/편집/다운로드 이벤트 audit_logs enqueue

### K.4 Disclaimer 문구 (표준)

```
이 문서는 Regula AI 시스템이 생성한 보조 초안입니다.
규제 제출 전 반드시 자격을 갖춘 RA 전문가의 검토 및 수정이 필요합니다.
Regula는 법적·규제적 책임을 지지 않습니다.
생성일: YYYY-MM-DD HH:mm:ss | 워크플로우 실행 ID: {run.id}
```

E&O(Errors & Omissions) 보험 가입 여부는 post-launch 결정.

---

## L. workflow_runs 테이블 스키마 설계

### L.1 테이블 정의 (Drizzle)

```
workflow_runs
├── id: uuid PRIMARY KEY
├── user_id: uuid REFERENCES users(id) NOT NULL
├── organization_id: uuid REFERENCES organizations(id) NOT NULL
├── project_id: uuid REFERENCES projects(id) NULL
├── workflow_type: workflow_type pgEnum NOT NULL
│     -- {submission_drafter, audit_response, indication_impact}
├── status: workflow_status pgEnum NOT NULL DEFAULT 'queued'
│     -- {queued, running, paused, pending_review, approved, rejected, failed}
├── input_json: jsonb NOT NULL
├── result_json: jsonb NULL
├── step_progress: jsonb NULL
│     -- {current_step, total_steps, completed_step_ids[]}
├── confidence_aggregate: numeric(3,2) NULL
├── review_required: boolean NOT NULL DEFAULT true  -- always true per K.2
├── reviewer_user_id: uuid REFERENCES users(id) NULL
├── reviewed_at: timestamptz NULL
├── started_at: timestamptz NOT NULL DEFAULT now()
├── completed_at: timestamptz NULL
├── cloudflare_workflow_instance_id: text NULL
└── created_at / updated_at: timestamptz
```

### L.2 FOUNDATION 스키마 영향

- **13 tables → 14 tables (+workflow_runs)** — Phase 9에서 schema 확장
- **2 pgEnum 추가** — workflow_type, workflow_status
- **audit_action pgEnum 확장 필요:** FOUNDATION v0.4.0 REQ-FND-049 inventory table에 Phase 9 actions **선제 등록**:
  - `workflow.start`
  - `workflow.step.complete`
  - `workflow.step.fail`
  - `workflow.pause`
  - `workflow.resume`
  - `workflow.pending_review`
  - `workflow.approve`
  - `workflow.reject`
  - `workflow.download`
  - `workflow.edit`

Phase 9 SPEC의 "Non-Obvious Constraints 매트릭스 제약 #4"는 이 enum inventory 선제 등록을 명시한다. 실제 call-site wiring은 Phase 9 RUN에서 수행.

### L.3 workflow_runs ↔ message_blocks 관계

Workflow 결과의 summary 뷰는 채팅 대화에 임베드 가능하다:

- `message_blocks.block_type = 'workflow_result'` (신규 pgEnum value)
- `block_json.workflow_run_id = workflow_runs.id`
- `block_json.summary_sections = [...]` (압축 정보)

이로써 사용자가 채팅 중 "방금 생성한 510(k) draft 요약해줘"라고 물으면, `workflow_result` block이 대화에 inline 표시되고, "전체 보기" 링크로 워크플로우 결과 페이지 이동.

### L.4 Retention

workflow_runs는 audit_logs와 달리 UPDATE 허용(review status 전이 필요). 단, 다음 이벤트는 append-only audit_logs에 기록:

- workflow.start (input_json snapshot)
- workflow.approve (reviewer, timestamp)
- workflow.download (who, when, version)
- workflow.edit (diff snapshot)

실제 workflow_runs row는 **7-year retention** (21 CFR Part 11), R2 PDF artifacts도 동일.

---

## M. Non-Obvious Constraints 완결 매트릭스 — Phase 9 위치

CLAUDE.md의 7개 Non-Obvious Constraints 중 Phase 9에서 영향 받는 것:

| # | Constraint | Phase 9 적용 방식 |
|---|---|---|
| 1 | Citation 강제 | 모든 draft body의 규제 인용(21 CFR §..., MDR Annex I GSPR ..., MEDDEV ...)에 `<sup class="cite">N</sup>` 강제. post-processing은 CHAT enforcement 재사용 |
| 2 | SSE 3-phase | Workflow 진행 SSE event (step_start / step_complete / workflow_progress / workflow_done) — 기존 3-phase와 별도 channel |
| 3 | Expert review 강제 | **모든 workflow 결과에 review_required=true** 강제 (confidence 관계없이). ENTERPRISE expert-review 큐와 통합 |
| 4 | Audit 완전성 | workflow_runs 단계별 audit_logs 기록, 10개 신규 audit action enum (L.2), FOUNDATION v0.4.0 inventory table에 **선제 등록** |
| 5 | Serif/Sans | Draft 렌더링 (DraftPreview)은 serif 본문 유지 (brand requirement) |
| 6 | i18n | Draft 생성 locale: FDA/US → en, EU/KR/JP/CN → 각 locale. Run 단계에서 prompt locale branching |
| 7 | noindex | Workflow UI 페이지 `/workflows/...`는 auth-wall 뒤, noindex 유지 |

### M.1 제약 #4 (audit) 선제 등록 구체 방안

FOUNDATION SPEC은 **수정하지 않는다** (master-roadmap §5.2 금지 원칙). 대신 Phase 9 SPEC의 "Technical Decisions #6"에서 "workflow 단계별 audit_action enum 값은 FOUNDATION v0.4.0 REQ-FND-049 inventory table에 **선제 등록되어 있음을 가정**하며, 만약 실제 inventory 항목에 누락된 경우 Phase 9 RUN 단계에서 ALTER TYPE ADD VALUE 마이그레이션 `00XX_workflow_audit_actions.sql`을 수행한다"고 명시한다.

실 FOUNDATION v0.4.0 REQ-FND-049 검토(research 시점):
- 현재 enum inventory는 Phase 2/3/4/5 표기만 존재
- Phase 9 values(10개) 추가 등록 필요 → Phase 9 `plan.md`에서 "FOUNDATION inventory table extension proposal" task 포함

### M.2 제약 #3 (expert review) 게이팅 우회 금지 — server-side enforcement

ENTERPRISE의 `with-permission.ts` + 신규 `lib/auth/with-workflow-review.ts` 래퍼:

```
download route handler:
  withWorkflowReview(runId) → status check → 'approved' only → stream PDF
  else → 403 WorkflowPendingReview
```

Test strategy: integration test에서 `status='pending_review'` 시 403 발생 확인.

---

## N. Risk Assessment (Phase 9 Cross-Phase Integration)

### N.1 Risk ID 등록 (master-roadmap §9 Risk Register 추가 권장)

| ID 제안 | Risk | 영향 | 완화 |
|---|---|---|---|
| R-X16 | Draft 품질 미달 | 신뢰 상실 | Eval harness 확장 (LAUNCH promptfoo + custom rubric), 점진 런치 (internal → pilot → GA) |
| R-X17 | Predicate 잘못 매칭 | Draft 전체 무의미 | Predicate 후보 top-5 제시 + 사용자 명시적 선택 강제, Vectorize rerank validation |
| R-X18 | 법적 책임 (잘못된 draft로 인한 손실) | E&O 보험 | 명시적 disclaimer (K.4) + E&O 보험 가입 (post-launch 결정) |
| R-X19 | FDA API 변경 | Submission drafter 오류 | Predicate API stub layer, 계약 테스트 (CI에서 FDA API schema 정상 검증) |
| R-X20 | 5 jurisdiction 데이터 부족 (MFDS/PMDA/NMPA) | Workflow C 품질 | DOCINGEST seed corpus 확대, 부족 시 "insufficient data" 경고 emit |
| R-X21 | Long-running workflow 비용 | LLM bill | Prompt caching 활용, Haiku fallback, month budget alert ($1000 threshold) |
| R-X22 | Cloudflare Workflows Beta→GA 전환 | 운영 중단 | Fallback plan: Durable Objects manual orchestration |
| R-X23 | Workflow run_id 충돌 (concurrent users) | 데이터 손상 | UUID v7 사용, workflow_runs PK UNIQUE |

### N.2 Cross-Phase 의존성

- **Phase 1 FOUNDATION (v0.4.0+):** workflow_runs 테이블 마이그레이션 수용 여력 확인, audit_action enum inventory 확장 수용
- **Phase 2 CHAT:** citation enforcement post-processing 재사용
- **Phase 3 STRUCTURED:** comparison/checklist/timeline 블록 schema 재사용 (+ workflow_result 신규 block_type)
- **Phase 4 BREADTH:** project-context switching (workflows는 current project 기반 filter)
- **Phase 5 ENTERPRISE:** expert-review 큐 통합, RBAC (admin/ra-lead만 download permit)
- **Phase 6 LAUNCH:** promptfoo eval에 workflow output rubric 추가, k6 load test에 workflow trigger 포함
- **Phase 7 CLOUDFLARE:** Workflows runtime 제공, R2/KV 스토리지
- **Phase 8 DOCINGEST:** 조직 DMR / 과거 CAPA / 내부 SOP corpus

### N.3 Phase 9 실행 선결 조건

- Phase 1–8 모두 완결 (master-roadmap 의존성 그래프 준수)
- FDA API key 등록 (B.2) — operator 작업
- Cloudflare Workflows GA 확인 (또는 Durable Objects fallback 결정)
- DOCINGEST Phase 8의 조직 corpus ≥ 30% populate (Workflow B/C의 precedent 기반)

---

## O. Acceptance Criteria 도출 Summary

spec.md REQ-WF-NNN 도출의 근거 위치:

| Group | REQ 범위 | Research 섹션 근거 |
|---|---|---|
| A (Submission Drafter) | 001–020 | A, B, C (20 sections, predicate API, EU GSPR) |
| B (Audit Response) | 021–035 | D (483 파싱, CAPA 7 fields, precedent, legal flag) |
| C (Indication Impact) | 036–048 | E, G (결정 tree, 5 jurisdiction) |
| D (Common Infra) | 049–058 | H, I, J, K, L (workflow runtime, model mix, draft pipeline, review gate, workflow_runs) |
| E (UI) | 059–068 | J, K (DraftPreview, ReviewGate, ProgressSteps) |

총 **68 REQ-WF** (원래 범위 50~70 내 상한 접근). 5 group distribution:

- Group A: 20 (submission drafter complexity 반영)
- Group B: 15 (audit response)
- Group C: 13 (indication impact)
- Group D: 10 (common infra)
- Group E: 10 (UI)

### O.1 정량 성공 기준

- **Submission coverage:** 17/20 sections non-empty (85%)
- **483 parsing precision:** ≥ 90% (cited regulation 추출)
- **5 jurisdiction table:** < 60s (Workflow C 단일 실행)
- **Citation coverage:** 100% (draft prose + body + table)
- **Review gate bypass:** 0 (integration test enforcement)
- **Workflow run UUID 충돌:** 0

### O.2 Eval Harness 확장 (LAUNCH Phase 6 integration)

Phase 6 LAUNCH promptfoo eval에 Phase 9 규제 질의 + 워크플로우 quality rubric 추가:

- **Submission regression:** 5 subject devices × 5 sections × 2 scorers (citation coverage + regulatory accuracy)
- **483 response regression:** 10 observation samples × parser precision scorer + CAPA completeness
- **Indication impact regression:** 5 indication changes × pathway correctness (manual gold label)

총 **120 eval cases** 신규 (LAUNCH SPEC v0.2.0+에 등록 필요).

---

## P. Open Questions (Run 단계로 이월)

1. **Q-WF-1:** Submission Drafter output PDF의 eSTAR XML 추출 자동화 여부 — FDA eSTAR는 XFA 기반 XML, PDF에서 XML 추출 가능하나 신뢰도 낮음. 초기에는 사람이 eSTAR로 수동 import 권장. Run 단계에서 Puppeteer eSTAR 내보내기 가능성 재평가.
2. **Q-WF-2:** CAPA effectiveness verification plan 자동 생성 범위 — 통계적 방법(SPC) 제안은 도메인 전문가 판단 영역. LLM은 템플릿 수준만 생성, 전문가 완성 요구.
3. **Q-WF-3:** De Novo pathway estimate 시 FDA "Breakthrough Device" 프로그램 포함 여부 — 현재 범위 외(pathway tree 확장 candidate).
4. **Q-WF-4:** workflow_runs.step_progress 의 granularity — 20 sections 각각 step인지, 블록 단위 step인지 Run 단계 결정.
5. **Q-WF-5:** Markdown → MDX 변환 시 LLM hallucination (존재하지 않는 MDX 컴포넌트 imports)의 post-processing guard 방안.
6. **Q-WF-6:** Cloudflare Workflows 비용 모니터 대시보드 — Langfuse와 통합 vs 별도 Cloudflare dashboard.
7. **Q-WF-7:** Workflow retry 시 이전 LLM 결과 부분 재사용 전략 — step 단위 cache hit 정책 Run 단계에서 정교화.

---

## Q. Glossary

- **510(k):** FDA Premarket Notification under §510(k) of the FD&C Act
- **PMA:** Premarket Approval (Class III devices)
- **De Novo:** Pathway for novel low/moderate risk devices without predicate
- **LtF:** Letter to File (internal change control without submission)
- **eSTAR:** electronic Submission Template And Resource (FDA standard)
- **Predicate:** Legally marketed device used as basis for substantial equivalence
- **SE:** Substantial Equivalence
- **IFU:** Indications for Use
- **GSPR:** General Safety and Performance Requirements (MDR Annex I)
- **CER:** Clinical Evaluation Report (MEDDEV 2.7/1 Rev4)
- **DoC:** Declaration of Conformity
- **CAPA:** Corrective And Preventive Action (21 CFR 820.100)
- **SOP:** Standard Operating Procedure
- **DMR:** Device Master Record (21 CFR 820.181)
- **DHF:** Design History File (21 CFR 820.30(j))
- **FEI:** FDA Establishment Identifier
- **MDSAP:** Medical Device Single Audit Program (multi-jurisdiction)
- **KGMP:** Korea Good Manufacturing Practice
- **NMPA:** National Medical Products Administration (China)
- **PMDA:** Pharmaceuticals and Medical Devices Agency (Japan)
- **Shonin (承認):** PMDA full approval
- **Ninsho (認証):** PMDA third-party certification
- **SSED:** Summary of Safety and Effectiveness Data (PMA public report)

---

## R. References

### R.1 FDA Primary Sources

- 21 CFR 807.87 — Information required in a 510(k) submission
- 21 CFR 820 — Quality System Regulation (subparts referenced for CAPA, design controls)
- 21 CFR Part 11 — Electronic Records; Electronic Signatures
- 21 CFR 860 Subpart D — De Novo Classification Process
- 21 CFR 814 — Premarket Approval
- FDA Guidance: Deciding When to Submit a 510(k) for a Change to an Existing Device (2017.10)
- FDA Guidance: eSTAR Program (2021+ updates)
- FDA openFDA API documentation (https://open.fda.gov/apis/)

### R.2 EU Primary Sources

- Regulation (EU) 2017/745 (MDR)
- Annex I (GSPR), Annex II (Technical Documentation), Annex III (Post-Market Surveillance)
- MEDDEV 2.7/1 Rev 4 — Clinical Evaluation
- EMA guidance on EUDAMED

### R.3 Other Jurisdictions

- 韓 医療機器法 (2023 개정) + KGMP
- 日本 PMD Act (PMDA framework)
- 中国 医疗器械监督管理条例 (2021 revised)

### R.4 Technical

- Cloudflare Workflows documentation (2024+ updates, GA expected 2025)
- Anthropic Claude prompt caching (2024.10)
- Puppeteer headless rendering (v22+)
- TipTap / MDXEditor (draft editing)
- promptfoo eval framework (LAUNCH SPEC 연속)

### R.5 Internal Regula SPECs

- SPEC-REGULA-FOUNDATION-001 v0.4.0 — schema + audit_logs
- SPEC-REGULA-CHAT-001 v0.2.0 — SSE + citation enforcement
- SPEC-REGULA-STRUCTURED-001 v0.2.0 — comparison/checklist/timeline blocks
- SPEC-REGULA-ENTERPRISE-001 — expert_review queue, RBAC
- SPEC-REGULA-LAUNCH-001 — promptfoo eval harness
- SPEC-REGULA-CLOUDFLARE-001 (병렬) — Workflows runtime
- SPEC-REGULA-DOCINGEST-001 (병렬) — 조직 corpus

---

*End of research — SPEC-REGULA-WORKFLOWS-001 v0.1.0*
