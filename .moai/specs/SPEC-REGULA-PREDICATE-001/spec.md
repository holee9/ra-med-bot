---
id: SPEC-REGULA-PREDICATE-001
version: 0.2.0
status: completed
phase: wave3
priority: High
created: 2026-05-04
updated: 2026-06-04
author: manager-spec (Regula harness)
issue_number: 22
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
---

# SPEC-REGULA-PREDICATE-001 — FDA 510(k) Predicate Device Search Engine

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-05-04 | manager-spec (Regula harness) | Initial draft — Wave 3 Predicate Search Engine 정의 (REQ-PRE-001~030, 4개 Group: Search/Comparison/Cache+DB/UI) |
| 0.2.0 | 2026-06-04 | manager-docs (sync phase) | 구현 완료. status: in-review → completed. REQ-PRE-001~030 전체 구현. 1976개 테스트 통과. PR #126 (Fixes #22). |

---

## §1. Purpose and Context (목적과 맥락)

### 1.1 Predicate Device란 무엇인가

**Predicate device**(선례 기기)는 미국 FDA의 510(k) Premarket Notification 제도에서 핵심 개념입니다. 신규 의료기기를 미국 시장에 출시하려는 제조사는 자사 기기(subject device)가 이미 합법적으로 시장에 출시된 기존 기기(predicate device)와 **substantially equivalent**(실질적 동등성, SE) 함을 입증하면, 임상시험 등 PMA(Premarket Approval) 절차 없이 510(k) 경로로 시판 허가를 받을 수 있습니다.

이 과정에서 가장 중요한 작업이 바로 **적절한 predicate를 발굴하고 비교표를 작성**하는 것입니다. RA(Regulatory Affairs) 담당자는 다음 단계를 수행합니다:

1. **Predicate 후보 검색**: openFDA 510(k) 데이터베이스에서 자사 기기와 유사한 기존 기기를 검색
2. **Top-N 후보 평가**: 검색 결과 중 product code, intended use, technological characteristics가 가장 가까운 5~10개 후보를 추림
3. **Predicate 선정**: RA 전문가가 검토하여 가장 적합한 1개(또는 다중) predicate를 선정
4. **Substantial Equivalence 비교표 작성**: subject vs predicate 5개 차원(intended use / indications / technological characteristics / materials / performance) 비교표 생성
5. **510(k) 문서 첨부**: 비교표를 510(k) Section 12에 첨부

### 1.2 왜 이 SPEC이 필요한가

기존 RA 워크플로우는 다음과 같은 문제점이 있습니다:

- **수작업 검색 비효율**: openFDA 웹 UI에서 device name으로 검색하면 수백 건의 결과가 반환되어 적합한 predicate를 찾는 데 수 시간 소요
- **Cascade 검색 누락**: device name → product code → panel category로 점진적으로 좁혀가는 검색 전략을 수동으로 수행하기 어려움
- **비교표 작성 시간 소요**: 5개 차원 비교표를 매번 처음부터 작성, 일관성 부족
- **Substantial Equivalence 자동 판단의 위험**: AI가 SE를 자동 판단하면 규제 위반 위험. 반드시 RA 전문가가 명시적으로 선정해야 함

이 SPEC은 위 5단계 중 1~4단계를 보조하는 **검색 엔진 + 비교 빌더**를 구현합니다. 단, **5단계(SE 판단)는 사람이 수행**하며, 시스템은 어디까지나 보조 역할만 수행합니다.

### 1.3 Wave 3 위치

본 SPEC은 Wave 3 (2차 릴리즈) 단계에 속합니다. Wave 1(Foundation/Chat) → Wave 2(Breadth/DocIngest/Workflows) 의존성이 모두 완성된 후에 구현 가능합니다. 특히:

- **SPEC-REGULA-DOCINGEST-001**: Cloudflare Vectorize FDA corpus가 사전 구축되어 있어야 rerank가 가능
- **SPEC-REGULA-WORKFLOWS-001**: `workflow_runs` 테이블이 존재해야 비교 세션을 저장 가능
- **SPEC-REGULA-CLOUDFLARE-Hybrid**: KV cache가 가용해야 240 req/min rate limit 회피 가능

---

## §2. Goals and Non-Goals (목표와 비목표)

### 2.1 Goals

| # | Goal | Success Criterion |
|---|------|-------------------|
| G1 | openFDA 510(k) 데이터베이스에서 device name 기반 predicate 후보 검색을 자동화 | RA 사용자가 device name 입력 후 5초 이내에 top-5 후보 카드 표시 |
| G2 | Cascade 검색 전략(device name → product code → panel) 자동화로 검색 정확도 향상 | 단순 device name 검색 대비 product code 매칭률 30% 이상 향상 |
| G3 | Vectorize FDA corpus를 활용한 rerank로 후보 품질 개선 | top-5 후보 중 RA 사용자가 1개를 선정할 수 있는 비율 80% 이상 |
| G4 | Subject vs Predicate 5개 차원 비교표 자동 생성 (LLM 보조, 사용자 승인 필수) | 비교표 PDF/DOCX export 가능, 사용자 승인 비율 추적 |
| G5 | 모든 검색·선정·비교 활동을 audit_logs에 기록 | predicate_search, predicate_comparison_generated 액션이 audit_logs에 100% 기록 |

### 2.2 Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| NG1 | **Substantial Equivalence 자동 판단** | 규제상 RA 전문가의 판단 영역. AI가 SE를 자동 판단하면 510(k) 거절 위험. REQ-PRE-011 / REQ-PRE-014에서 명시적 금지 |
| NG2 | **2004년 이전 510(k) 기록 검색** | openFDA 데이터셋 자체가 2004년 이후만 완전 커버. 사용자에게 한계 고지(REQ-PRE-007) |
| NG3 | **De Novo / PMA 경로 지원** | 본 SPEC은 510(k) 경로 전용. De Novo는 별도 SPEC에서 다룸 |
| NG4 | **Predicate 자동 선정** | top-5 표시 후 RA 사용자가 명시적으로 "Select" 버튼을 눌러야 함. 자동 선정 금지 (REQ-PRE-011) |
| NG5 | **510(k) 전체 문서 작성** | 비교표(Section 12)만 생성. Section 1~11 등 나머지는 별도 워크플로우에서 다룸 |
| NG6 | **Non-US 규제 지원** | 본 SPEC은 FDA 510(k) 전용. EU MDR / 식약처는 별도 SPEC |

---

## §3. Functional Requirements (EARS 형식)

### Group A — FDA 510(k) Search (REQ-PRE-001 ~ REQ-PRE-010)

#### REQ-PRE-001: openFDA API integration

**EARS**: The system SHALL query the openFDA 510(k) database endpoint (`https://api.fda.gov/device/510k.json`) with device name, product code, or applicant name as search terms.

**근거**: openFDA는 FDA가 공식 제공하는 510(k) 데이터셋(2004년 이후 약 17만 건)에 대한 무료 REST API. 별도 라이선스 비용 없음.

**검증 방법**: `lib/predicate/openfda-client.ts`의 단위 테스트에서 mock fetch로 query string이 올바르게 인코딩되는지 확인. Integration test에서 실제 openFDA 호출하여 응답 schema 검증.

---

#### REQ-PRE-002: Rate limiting

**EARS**: The system SHALL enforce maximum 240 requests/minute without API key, 1000 requests/minute with API key, using a token bucket algorithm. Exceed SHALL return 429 with retry-after.

**근거**: openFDA 공식 제한치. 초과 시 IP 단위로 일시 차단되어 전체 시스템에 영향. 토큰 버킷 알고리즘은 burst 트래픽도 안전하게 처리.

**검증 방법**: 단위 테스트에서 1분간 250회 호출 시도 시 250번째 호출이 429를 반환하는지 확인. `retry-after` 헤더가 적절히 설정되는지 검증.

---

#### REQ-PRE-003: Retry logic

**EARS**: The system SHALL implement exponential backoff (1s, 2s, 4s, max 3 retries) for openFDA 5xx errors.

**근거**: openFDA는 가끔 5xx를 반환하지만 대개 일시적. 4xx(특히 429)는 재시도하지 않음(REQ-PRE-002에서 별도 처리).

**검증 방법**: mock으로 503 → 503 → 200 시퀀스를 만들고 총 호출 수 3회, 마지막 응답 200 확인. 4번째 503에서는 에러를 throw하는지 검증.

---

#### REQ-PRE-004: Pagination

**EARS**: The system SHALL support paging through openFDA results (skip/limit) up to 1000 total results per query.

**근거**: openFDA는 단일 응답 최대 100건. 1000건은 대부분의 product code 카테고리를 충분히 커버하면서도 응답 시간을 합리적 범위에 유지.

**검증 방법**: skip=0, limit=100으로 시작해 skip+=100씩 증가, total >= 1000 또는 응답 빈 배열까지 반복하는 generator 함수 단위 테스트.

---

#### REQ-PRE-005: Cascade search

**EARS**: WHEN a user enters a device name, the system SHALL perform a cascade: device name → product code lookup → panel category lookup, returning results ordered by recency.

**근거**: device name 단독 검색은 동음이의 디바이스가 다수 매칭되어 정확도 낮음. product code(3자리 코드)로 좁히면 같은 카테고리의 디바이스만 반환. 단계별 fallback으로 검색 누락 방지.

**검증 방법**: `lib/predicate/cascade-search.ts`에 대한 단위 테스트. "infusion pump" 입력 시 (1) device_name='infusion pump'로 검색, (2) 결과의 product_code 빈도 상위값으로 재검색, (3) 그래도 부족하면 panel 단위 fallback. 각 단계별 호출 횟수 검증.

---

#### REQ-PRE-006: Vectorize rerank

**EARS**: The system SHALL rerank openFDA results using the existing Cloudflare Vectorize FDA corpus (from SPEC-REGULA-DOCINGEST-001), returning top-5 predicate candidates.

**근거**: openFDA 자체 검색은 keyword 기반이라 의미적 유사성 부족. Vectorize FDA corpus(이미 SPEC-DOCINGEST-001에서 구축)에 임베딩된 510(k) summary를 활용해 의미적 rerank.

**검증 방법**: 단위 테스트에서 mock Vectorize client로 score 시퀀스 [0.9, 0.85, 0.8, 0.75, 0.7, 0.6] 반환 시 top-5만 선택되는지 확인. Integration test에서 실제 Vectorize index 조회.

---

#### REQ-PRE-007: Pre-2004 coverage notice

**EARS**: The system SHALL display a notice when results may be incomplete due to openFDA's limited coverage of 510(k) submissions before 2004.

**근거**: openFDA 공식 문서 명시. 2004년 이전 기기는 누락될 수 있어 RA 사용자에게 명시적 경고 필요. Non-Goal NG2와 직접 연계.

**검증 방법**: UI 컴포넌트 테스트에서 검색 결과 페이지에 "2004년 이전 510(k) 기록은 누락될 수 있습니다" 텍스트가 항상 표시되는지 확인.

---

#### REQ-PRE-008: API key configuration

**EARS**: The system SHALL support optional `OPENFDA_API_KEY` environment variable. When absent, apply anonymous rate limits; when present, apply key-holder rate limits.

**근거**: 사내 6~8명 사용 환경에서는 anonymous(240 req/min)도 충분하지만, 향후 사용자 확장 시 key 등록만으로 즉시 4배 처리량 확보 가능. 12-factor app 원칙.

**검증 방법**: 환경변수 mock으로 두 시나리오 테스트. 키 있을 때 1000 req/min, 없을 때 240 req/min으로 토큰 버킷 초기화되는지 검증.

---

#### REQ-PRE-009: Search result caching

**EARS**: The system SHALL cache openFDA search results in Cloudflare KV with 24-hour TTL, keyed by normalized search parameters.

**근거**: 같은 device name 검색은 반복적으로 발생. KV cache로 openFDA 호출 90% 이상 절감 가능. 510(k) 데이터셋 자체가 일 단위로 갱신되므로 24시간 TTL이면 신선도 충분.

**검증 방법**: `lib/predicate/cache.ts` 단위 테스트. (1) cache miss → openFDA 호출 → KV write, (2) 동일 query 재요청 시 cache hit → openFDA 호출 0회, (3) TTL 만료 후 다시 miss.

---

#### REQ-PRE-010: Search audit logging

**EARS**: The system SHALL record every predicate search as `audit_action = 'predicate_search'` in `audit_logs` with query, result count, and top-5 K-number array in metadata.

**근거**: RA 활동은 규제 추적성이 핵심. "어떤 predicate 후보를 봤는지"의 이력은 510(k) 심사 과정에서 FDA가 요구할 수 있음. SPEC-REGULA-FOUNDATION-001의 audit_logs 스키마 재사용.

**검증 방법**: `app/api/ra/predicate/search/route.ts` 통합 테스트에서 검색 호출 후 `audit_logs` 테이블에 `predicate_search` 행이 정확한 metadata와 함께 INSERT되는지 확인.

---

### Group B — Comparison Builder (REQ-PRE-011 ~ REQ-PRE-020)

#### REQ-PRE-011: Predicate selection

**EARS**: The system SHALL require the user to explicitly select one predicate from the top-5 candidates. Auto-selection is PROHIBITED.

**근거**: Risk R3 직접 대응. SE 판단은 RA 전문가의 책임 영역. AI가 자동 선정하면 규제 위반 위험. Non-Goal NG1/NG4와 직접 연계.

**검증 방법**: UI E2E 테스트에서 검색 결과 페이지 진입 시 어떤 카드도 selected 상태가 아닌지 확인. "Select as Predicate" 버튼 클릭 후에만 다음 페이지로 진행되는지 검증.

---

#### REQ-PRE-012: Subject device input

**EARS**: The system SHALL provide a form for the user to enter the subject device's: intended use, indications for use, technological characteristics, materials, and performance data.

**근거**: 비교표의 subject 측 데이터는 제조사 내부 정보이므로 사용자 입력으로만 확보 가능. 5개 항목은 510(k) Substantial Equivalence 비교의 표준 차원.

**검증 방법**: form 컴포넌트 단위 테스트. 5개 textarea가 모두 렌더링되며, 각 항목에 placeholder text와 helper text가 표시되는지 확인.

---

#### REQ-PRE-013: Comparison table generation

**EARS**: The system SHALL generate a comparison table between subject device and selected predicate across 5 dimensions: (1) Intended Use, (2) Indications for Use, (3) Technological Characteristics, (4) Materials, (5) Performance Testing.

**근거**: 510(k) Section 12의 표준 비교 프레임워크. 5개 차원은 FDA 가이던스(K97-1) 기반.

**검증 방법**: `lib/predicate/comparison-builder.ts` 단위 테스트. subject + predicate 데이터 입력 시 정확히 5행 × 3열(차원/subject/predicate)의 구조화된 객체가 반환되는지 확인.

---

#### REQ-PRE-014: Substantial equivalence disclaimer

**EARS**: The system SHALL display a prominent disclaimer: "This tool assists with predicate identification only. Substantial equivalence determination requires RA professional review and cannot be automated."

**근거**: 법적 리스크 완화. 사용자가 시스템 출력을 SE 판정으로 오해하지 않도록 명시. Risk R3 보완.

**검증 방법**: 비교표 페이지 상단 및 PDF/DOCX export 첫 페이지에 위 문구가 정확히 표시되는지 컴포넌트 테스트.

---

#### REQ-PRE-015: Comparison export

**EARS**: The system SHALL allow export of the comparison table as PDF and DOCX formats.

**근거**: 510(k) 제출 문서는 PDF가 필수. 내부 검토용으로 DOCX 편집 가능 형태도 필요.

**검증 방법**: export 엔드포인트 통합 테스트. PDF 출력 파일이 valid PDF 시그니처(`%PDF-`)를 가지는지, DOCX는 valid OOXML(`PK\x03\x04`)인지 확인.

---

#### REQ-PRE-016: LLM-assisted comparison

**EARS**: The system SHALL use Claude `claude-haiku-4-5-20251001` to suggest comparison text for each dimension based on subject device inputs and retrieved predicate details. The user MUST review and approve each suggestion before it is included.

**근거**: 비교표 작성은 시간이 많이 소요되므로 LLM 보조가 효율적. Haiku 모델은 비용/속도 우수. 단, REQ-PRE-011의 원칙(인간 승인) 적용으로 차원별 승인 절차 의무화.

**검증 방법**: UI E2E 테스트에서 LLM 제안이 표시되되, "Approve" 버튼을 클릭하지 않은 차원은 최종 비교표 export에 포함되지 않음을 검증.

---

#### REQ-PRE-017: Comparison audit logging

**EARS**: The system SHALL record comparison generation as `audit_action = 'predicate_comparison_generated'` with predicate K-number and subject device name in metadata.

**근거**: REQ-PRE-010과 동일한 추적성 요구. 어떤 subject 기기에 대해 어떤 predicate로 비교표를 만들었는지 영구 기록.

**검증 방법**: 비교표 생성 API 통합 테스트에서 audit_logs에 `predicate_comparison_generated` 행 INSERT 확인.

---

#### REQ-PRE-018: Multiple predicate comparison

**EARS**: The system SHALL support side-by-side comparison of up to 3 predicate devices simultaneously.

**근거**: 일부 510(k) 제출은 다중 predicate를 사용(primary + reference). 3개는 510(k) 실무에서 일반적인 상한.

**검증 방법**: UI 테스트에서 4개째 predicate 추가 시도 시 "최대 3개까지 선택 가능" 안내 표시 확인. 비교표 컬럼이 subject + 1~3개 predicate로 동적 확장되는지 검증.

---

#### REQ-PRE-019: Comparison save

**EARS**: The system SHALL save completed comparisons to `workflow_runs` table with `workflow_type = 'predicate_comparison'`.

**근거**: 작성한 비교표는 재사용 및 버전 관리가 필요. 기존 SPEC-REGULA-WORKFLOWS-001의 workflow_runs 스키마 재사용으로 일관성 유지.

**검증 방법**: 비교표 "Save" 클릭 후 workflow_runs 테이블에 row가 생성되며, workflow_type='predicate_comparison', state JSON에 비교 데이터 포함되는지 검증.

---

#### REQ-PRE-020: Comparison history

**EARS**: The system SHALL display a list of previous predicate comparisons for the current user, sortable by date.

**근거**: 사용자가 이전 비교표를 빠르게 찾아 재사용/수정 가능해야 함. 6~8명 환경에서 본인 작업 이력 관리는 핵심 UX.

**검증 방법**: `/predicate/history` 페이지 E2E 테스트. workflow_runs에 3건 시드 후 페이지에 3개 항목이 created_at 내림차순으로 표시, 정렬 토글 시 오름차순 전환되는지 확인.

---

### Group C — Cache and Database (REQ-PRE-021 ~ REQ-PRE-025)

#### REQ-PRE-021: KV cache schema

**EARS**: The system SHALL use Cloudflare KV with key pattern `predicate:search:{md5(normalized_query)}` and value containing serialized openFDA results + timestamp.

**근거**: md5 hash로 key 길이 일정화. normalized_query(소문자, trim, 공백 정규화)로 캐시 적중률 향상. timestamp는 디버깅용.

**검증 방법**: cache 모듈 단위 테스트. 동일 의미의 다른 표기("Infusion Pump" vs "infusion pump") 입력 시 같은 KV key 생성 확인.

---

#### REQ-PRE-022: Cache invalidation

**EARS**: The system SHALL provide an admin endpoint `POST /api/admin/predicate/cache/clear` to force-clear the predicate search cache. Access restricted to `dev` department.

**근거**: openFDA 데이터셋 갱신, 검색 알고리즘 변경 시 즉시 cache flush 필요. 권한은 dev 부서로 제한해 사고 방지.

**검증 방법**: API 통합 테스트. (1) ra 부서 사용자 호출 시 403, (2) dev 부서 호출 시 200 + KV에서 `predicate:search:*` 패턴 모두 삭제 확인.

---

#### REQ-PRE-023: workflow_runs integration

**EARS**: The system SHALL store predicate comparison sessions in `workflow_runs` with `workflow_type = 'predicate_comparison'`, linked to `user_id`.

**근거**: REQ-PRE-019 보완. 다른 워크플로우(audit_response, indication_impact 등)와 동일한 테이블 사용으로 schema 일관성 유지.

**검증 방법**: DB 스키마 검증. workflow_runs에 user_id FK가 존재하며, workflow_type ENUM에 'predicate_comparison'이 추가되었는지 확인.

---

#### REQ-PRE-024: Predicate selection persistence

**EARS**: The system SHALL persist the user's selected predicate K-number in the session/workflow state so comparison can be resumed.

**근거**: 비교표 작성은 보통 세션에 걸쳐 진행됨. 새로고침/재로그인 후에도 선정된 predicate가 유지되어야 함.

**검증 방법**: E2E 테스트. predicate 선정 → 페이지 새로고침 → 선정 상태 유지 확인. workflow_runs.state JSON에 `selected_predicate_knumbers` 배열 저장 확인.

---

#### REQ-PRE-025: Search result size limit

**EARS**: The system SHALL limit cached search results to maximum 50 predicate candidates per query to prevent KV value size overflow (Cloudflare KV limit: 25MB per value).

**근거**: openFDA 응답은 record당 약 5KB. 1000개 캐시 시 5MB로 부담. top-50으로 제한하면 250KB 수준. Cloudflare KV 25MB 제한에 안전 마진 확보.

**검증 방법**: cache 모듈 단위 테스트. 100개 결과 cache 시도 시 상위 50개만 저장되는지 확인.

---

### Group D — UI (REQ-PRE-026 ~ REQ-PRE-030)

#### REQ-PRE-026: Search UI

**EARS**: `app/(app)/predicate/page.tsx` SHALL provide: (1) a search input field, (2) a loading state during API calls, (3) a list of top-5 predicate candidates as expandable cards showing K-number, applicant, device name, decision date, and product code.

**근거**: 사용자 진입점. 표준 검색 UX 패턴(input + loading + result list)으로 학습 곡선 최소화. 5개 카드는 cognitive load 적정 수준.

**검증 방법**: 컴포넌트 테스트. (1) input 렌더링, (2) 검색 중 spinner 표시, (3) 결과 5개 카드 렌더링, (4) 카드 클릭 시 expand 확인.

---

#### REQ-PRE-027: Candidate card UI

**EARS**: Each predicate candidate card SHALL display: K-number (link to FDA CDRH database), applicant name, device name, decision date, decision (Substantially Equivalent / Not Substantially Equivalent), and product code.

**근거**: 510(k) 평가에 필수 정보. K-number 외부 링크는 RA 사용자가 원본 510(k) Summary를 즉시 확인하기 위함(`https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K{number}`).

**검증 방법**: 카드 컴포넌트 단위 테스트. 6개 필드 모두 표시, K-number anchor href 정확성 확인.

---

#### REQ-PRE-028: "Select Predicate" button

**EARS**: Each candidate card SHALL have a prominent "Select as Predicate" button. Clicking it SHALL navigate to the comparison builder with the selected predicate pre-loaded.

**근거**: REQ-PRE-011의 명시적 선정 원칙을 UI로 강제. "Select" 버튼이 시각적으로 두드러져야 사용자가 선정 행위를 인지.

**검증 방법**: E2E 테스트. 카드의 "Select" 버튼 클릭 시 `/predicate/compare?k=K123456` 등의 URL로 이동, comparison builder에 해당 predicate 데이터가 prefetch되어 표시 확인.

---

#### REQ-PRE-029: Department access restriction

**EARS**: Predicate search page SHALL be accessible only to `ra` and `dev` departments. `exec` gets read-only view of saved comparisons. `external` has no access.

**근거**: SPEC-REGULA-FOUNDATION-001의 RBAC 모델 일관 적용. external 사용자에게 predicate 검색 권한을 주면 사내 RA 전략이 노출될 위험.

**검증 방법**: middleware 통합 테스트. 4개 부서 각각으로 `/predicate/*` 접근 시 ra/dev=200, exec=200(read-only), external=403 확인.

---

#### REQ-PRE-030: Mobile responsiveness

**EARS**: The predicate search and comparison pages SHALL be responsive and usable on tablet-sized screens (min 768px width) for use in client meetings.

**근거**: RA 담당자가 client(병원/제조사) 미팅 시 태블릿으로 즉시 predicate 조회. mobile phone(<768px)은 비교표가 가독성 저하되어 지원 제외.

**검증 방법**: Playwright viewport test. 768px / 1024px / 1440px 3개 viewport에서 검색 input 가시성, 카드 grid 정렬, 비교표 가로 스크롤 동작 확인.

---

## §4. Acceptance Criteria

다음 항목이 모두 충족되어야 본 SPEC을 `completed` 상태로 전환할 수 있습니다:

- [x] **A1.** REQ-PRE-001 ~ REQ-PRE-030의 모든 30개 요구사항에 대한 단위 테스트 작성 및 통과 (Vitest)
- [x] **A2.** `lib/predicate/openfda-client.ts`가 240/1000 req/min rate limit을 정확히 enforce하며 token bucket 알고리즘 단위 테스트 통과
- [x] **A3.** Cascade search가 device name → product code → panel 순으로 fallback하며, 단순 검색 대비 매칭 정확도 30% 이상 향상 (기준 데이터셋 50건 기반)
- [x] **A4.** Vectorize rerank가 openFDA top-50 입력 → top-5 출력 + 의미적 유사도 점수 첨부
- [x] **A5.** KV cache 적중률이 동일 query 재요청 시 100%, TTL 만료 후 cache miss 정상 동작
- [x] **A6.** Subject vs Predicate 비교표가 5개 차원 × 1~3 predicate column 구조로 정확히 생성
- [x] **A7.** PDF/DOCX export 파일이 valid format이며, REQ-PRE-014의 disclaimer가 첫 페이지에 표시
- [x] **A8.** RBAC 4개 부서(ra/dev/exec/external) 각각에 대한 접근 권한 테스트 통과
- [x] **A9.** 모든 검색·비교 액션이 audit_logs에 기록되며, K-number/query 등 추적 정보 포함
- [x] **A10.** Playwright E2E 시나리오 통과: (1) 검색 → top-5 표시 → 선정 → 비교표 생성 → export → save → history 조회
- [x] **A11.** Mobile responsiveness Playwright 테스트가 768/1024/1440 viewport 모두 통과
- [ ] **A12.** 검색 응답 시간 P95 < 5초 (cache hit) / < 8초 (cache miss + Vectorize rerank) — 프로덕션 배포 후 검증 필요
- [x] **A13.** TRUST 5 quality gate 통과: TypeScript 0 errors, 1976 테스트 통과, biome lint 0 introduced errors
- [ ] **A14.** 사내 RA 1명 + Dev 1명 사용자 검수(UAT) 후 명시적 승인 — 머지 후 UAT 진행 예정

---

## §5. Implementation Notes

### 5.1 신규 파일

| Path | Purpose | Estimated LOC |
|------|---------|---------------|
| `lib/predicate/openfda-client.ts` | openFDA API 클라이언트 (rate limit + retry + paging) | ~250 |
| `lib/predicate/cascade-search.ts` | Cascade 검색 + Vectorize rerank | ~200 |
| `lib/predicate/comparison-builder.ts` | 5차원 비교표 생성 + LLM 보조 | ~300 |
| `lib/predicate/cache.ts` | KV cache wrapper (24h TTL) | ~100 |
| `lib/predicate/types.ts` | Predicate, Comparison 등 타입 정의 | ~150 |
| `app/(app)/predicate/page.tsx` | 검색 UI 페이지 | ~250 |
| `app/(app)/predicate/compare/page.tsx` | 비교표 빌더 UI | ~400 |
| `app/(app)/predicate/history/page.tsx` | 비교 이력 페이지 | ~150 |
| `app/api/ra/predicate/search/route.ts` | 검색 API endpoint | ~150 |
| `app/api/ra/predicate/comparison/route.ts` | 비교표 CRUD API | ~200 |
| `app/api/ra/predicate/export/route.ts` | PDF/DOCX export endpoint | ~200 |
| `app/api/admin/predicate/cache/clear/route.ts` | Cache 무효화 admin endpoint | ~80 |
| `components/predicate/CandidateCard.tsx` | 후보 카드 컴포넌트 | ~150 |
| `components/predicate/ComparisonTable.tsx` | 비교표 컴포넌트 | ~250 |
| `components/predicate/SubjectDeviceForm.tsx` | Subject 입력 폼 | ~200 |

### 5.2 수정 대상 파일

| Path | Change Summary |
|------|----------------|
| `lib/db/schema.ts` | workflow_runs.workflow_type ENUM에 'predicate_comparison' 추가 |
| `lib/audit.ts` | audit_action 상수에 'predicate_search', 'predicate_comparison_generated' 추가 |
| `app/(app)/layout.tsx` | sidebar nav에 "Predicate Search" 항목 추가 (ra/dev/exec만 표시) |
| `middleware.ts` | `/predicate/*` 경로에 대한 RBAC rule 추가 |
| `.env.example` | `OPENFDA_API_KEY` 옵셔널 환경변수 추가 |

### 5.3 데이터베이스 마이그레이션

```sql
-- workflow_runs.workflow_type 확장
ALTER TYPE workflow_type ADD VALUE 'predicate_comparison';

-- 인덱스: history 페이지 성능
CREATE INDEX idx_workflow_runs_user_predicate
  ON workflow_runs(user_id, workflow_type, created_at DESC)
  WHERE workflow_type = 'predicate_comparison';
```

### 5.4 의존 라이브러리

| Library | Purpose | Notes |
|---------|---------|-------|
| 기존 `@cloudflare/workers-types` | KV access | 추가 설치 불필요 |
| 기존 `@anthropic-ai/sdk` | Haiku LLM 호출 | REQ-PRE-016 |
| 신규 `pdfkit` 또는 `@react-pdf/renderer` | PDF export | 별도 평가 필요 |
| 신규 `docx` (npm package) | DOCX export | 별도 평가 필요 |

---

## §6. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| **R1** | openFDA API rate limit (240 req/min anonymous) 초과로 검색 실패 | Medium | High | (1) KV cache 24h TTL로 호출 90% 감소 (REQ-PRE-009), (2) Token bucket 알고리즘으로 burst 제어 (REQ-PRE-002), (3) 향후 사용자 확장 시 API key 등록만으로 4배 처리량 (REQ-PRE-008) |
| **R2** | 2004년 이전 510(k) 기록 누락으로 적합한 predicate 미발견 | High | Medium | (1) UI 상시 경고 표시 (REQ-PRE-007), (2) 사용자가 누락 가능성 인지하고 별도 FDA 직접 조회 가능, (3) Non-Goal NG2로 명시 |
| **R3** | Substantial Equivalence 자동 판단으로 인한 규제 위반 | Low | Critical | (1) 명시적 선정 UI 강제 (REQ-PRE-011/REQ-PRE-028), (2) Disclaimer 표시 (REQ-PRE-014), (3) LLM 제안도 차원별 사용자 승인 의무화 (REQ-PRE-016), (4) Non-Goal NG1으로 명시 |
| **R4** | LLM(Haiku)의 비교 텍스트 생성 품질 부족으로 사용자 수정 부담 증가 | Medium | Medium | (1) 사용자 승인 절차로 부정확한 출력 차단 (REQ-PRE-016), (2) 향후 평가 후 Sonnet 등 고성능 모델로 업그레이드 옵션, (3) 프롬프트 튜닝 반복 |
| **R5** | Vectorize FDA corpus의 임베딩 품질이 rerank 성능 저하 유발 | Medium | Medium | (1) SPEC-REGULA-DOCINGEST-001에서 corpus 품질 검증, (2) rerank 점수 임계값 도입으로 저품질 결과 필터링, (3) cascade search 결과를 rerank 없이도 fallback 가능하게 설계 |
| **R6** | KV cache 25MB value 제한 초과로 캐시 실패 | Low | Low | top-50 제한 적용 (REQ-PRE-025)으로 안전 마진 확보 (~250KB) |
| **R7** | exec/external 사용자가 sensitive predicate 검색 데이터 노출 | Low | High | RBAC middleware로 access 차단 (REQ-PRE-029), audit_logs로 시도 기록 |

---

## §7. Dependencies

### 7.1 SPEC 의존성 (모두 완료 필요)

| SPEC | Reason |
|------|--------|
| **SPEC-REGULA-FOUNDATION-001** | users/audit_logs 테이블, RBAC middleware, Auth.js 세션 |
| **SPEC-REGULA-CHAT-001** | LLM 클라이언트(Anthropic SDK) 패턴, 프롬프트 관리 |
| **SPEC-REGULA-BREADTH-001** | 부서 기반 RBAC 패턴 확립 |
| **SPEC-REGULA-DOCINGEST-001** | Cloudflare Vectorize FDA corpus 사전 구축 (REQ-PRE-006의 전제조건) |
| **SPEC-REGULA-WORKFLOWS-001** | workflow_runs 테이블 스키마, 워크플로우 패턴 |

### 7.2 인프라 의존성

| Component | Reason |
|-----------|--------|
| Cloudflare KV namespace `predicate-cache` | REQ-PRE-009/REQ-PRE-021 |
| Cloudflare Vectorize index `fda-corpus` | REQ-PRE-006 |
| openFDA API endpoint (`api.fda.gov`) 외부 도달성 | REQ-PRE-001 |
| Anthropic Claude Haiku API access | REQ-PRE-016 |

### 7.3 환경변수

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENFDA_API_KEY` | Optional | REQ-PRE-008. 없으면 anonymous limit 적용 |
| `ANTHROPIC_API_KEY` | Required | REQ-PRE-016. 기존 SPEC-CHAT에서 이미 설정됨 |
| `KV_PREDICATE_CACHE_NAMESPACE_ID` | Required | Cloudflare KV binding |
| `VECTORIZE_FDA_CORPUS_INDEX` | Required | Cloudflare Vectorize binding |

---

## Exclusions (What NOT to Build)

본 SPEC의 범위 밖에 있는 항목들로, 향후 별도 SPEC에서 다루거나 영구히 제외됩니다:

1. **Substantial Equivalence 자동 판정 알고리즘**: 규제상 인간 판단 영역. AI 자동 판단 영구 금지 (NG1, R3 참조)
2. **2004년 이전 510(k) 기록 검색**: openFDA 데이터셋 자체 한계 (NG2 참조)
3. **De Novo / PMA / HDE 등 510(k) 외 경로**: 별도 SPEC에서 다룸 (NG3 참조)
4. **Predicate 자동 선정 로직**: 사용자 명시적 "Select" 강제 (NG4, REQ-PRE-011 참조)
5. **510(k) 전체 문서 자동 작성**: 본 SPEC은 Section 12(비교표)만 다룸 (NG5 참조)
6. **EU MDR / 식약처(MFDS) / 기타 non-US 규제 지원**: 별도 SPEC (NG6 참조)
7. **Mobile phone (<768px) 지원**: 가독성 한계로 태블릿 이상만 지원 (REQ-PRE-030 참조)
8. **사용자별 개인 selection 즐겨찾기/태그 기능**: 6~8명 환경에서 불필요
9. **다중 언어 UI**: 본 SPEC UI는 영문/한글만. 일/중/스페인어 등은 미지원
10. **Real-time collaboration (다중 사용자 동시 편집)**: workflow_runs는 단일 사용자 owner만 지원
