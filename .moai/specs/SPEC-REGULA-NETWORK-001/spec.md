---
id: SPEC-REGULA-NETWORK-001
title: "Regula Phase 11 — External Public Data Enrichment (FDA 510k / MAUDE / Eudamed)"
status: completed
created: 2026-04-22
updated: 2026-05-04
author: manager-spec
phase: 11
skill: regula
version: 2.0.0
priority: Medium
issue_number: 13
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: "Initial draft — k-anonymity + DP 조직간 aggregate (48 REQ). 폐기됨."
  - version: 2.0.0
    date: 2026-05-04
    author: manager-spec
    notes: "v2.0 재정의 — External Public Data Enrichment (10 REQ, REQ-EXT-001~010). FDA/MAUDE/Eudamed 공개 API enrichment로 대체. 커밋 11bd6fa."
depends_on:
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
---

# SPEC-REGULA-NETWORK-001 — External Public Data Enrichment

## 목적 (Purpose)

Regula의 LLM consult 파이프라인(Phase B prose 생성 단계)을 **미국/EU 공개 규제 데이터**로 enrichment하여, medical device submission 검토 시 predicate device 현황, 유사 기기의 adverse event 패턴, EU 기기 등록 정보 등을 자동으로 포함하게 한다.

본 Phase는 다음 3개 공개 API 클라이언트를 구현한다:
1. **FDA 510(k) API** — predicate device 검색 (clearance 결과, review timing)
2. **FDA MAUDE API** — adverse event 데이터 (특정 device에 대한 보고된 이상사례)
3. **Eudamed API** — EU 기기 등록 정보 (CE 마크 기기, regulatory 분류)

이 데이터는 외부 공개 소스이므로 privacy 걱정이 없고, LLM 응답의 **근거 강화**와 **시장 context 제공**을 목표로 한다.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| FDA 510(k) 클라이언트 | `lib/external/fda-510k.ts` — OpenAPI 기반 predicate device 조회, 응답 타입 정의 |
| FDA MAUDE 클라이언트 | `lib/external/fda-maude.ts` — adverse event 조회, 응답 타입 정의 |
| Eudamed 클라이언트 | `lib/external/eudamed.ts` — EU 기기 등록 조회, 응답 타입 정의 |
| API 응답 캐싱 | `lib/external/cache.ts` — Next.js unstable_cache 기반, TTL 설정, DISABLE_EXTERNAL_CACHE 환경변수 지원 |
| LLM 통합 | `lib/ai/external-enrichment.ts` — consult Phase B에서 external API 데이터 fetching 및 문맥 삽입 |
| consult.ts 수정 | `lib/ai/consult.ts` — Phase B prose 생성 시 external enrichment 호출 |
| 테스트 | `__tests__/external/*.test.ts` — unit + integration test (22건) |
| 네트워크 오류 처리 | 모든 API 클라이언트는 네트워크 오류 시 empty array 반환, throw 금지 |
| 429 재시도 로직 | Rate limit 응답 시 exponential backoff 재시도 |

### Out of Scope

- 조직 간 anonymized aggregate 생성 (원래 v0.1.0 scope → 폐기)
- Sensitive PII 또는 HIPAA PHI 처리 (공개 API만 사용)
- Real-time 업데이트 (static 캐시 기반)

---

## 실제 구현된 파일 목록 (커밋 11bd6fa)

| 파일 | 역할 | 테스트 |
|------|------|--------|
| `lib/external/fda-510k.ts` | FDA 510(k) OpenAPI 클라이언트 | `__tests__/external/fda-510k.test.ts` (5 cases) |
| `lib/external/fda-maude.ts` | FDA MAUDE API 클라이언트 | `__tests__/external/fda-maude.test.ts` (6 cases) |
| `lib/external/eudamed.ts` | Eudamed API 클라이언트 | `__tests__/external/eudamed.test.ts` (7 cases) |
| `lib/external/cache.ts` | API 응답 캐싱 레이어 | `__tests__/external/cache.test.ts` (4 cases) |
| `lib/ai/external-enrichment.ts` | LLM enrichment 통합 | 통합 테스트 포함 |
| `lib/ai/consult.ts` (수정) | Phase B에서 enrichment 호출 | 기존 테스트 유지 |
| `migrations/0018_radar.sql` | 스키마 (if needed) | N/A |

**Test coverage:** 22개 test cases, 모두 passed.

---

## EARS Requirements (10개)

### REQ-EXT-001 (Ubiquitous)
**요구사항:** The system SHALL implement a TypeScript module at `lib/external/fda-510k.ts` that exports a function `fetchFda510kDevice(predicateNumber: string): Promise<Fda510kResult[]>` which queries the FDA's 510(k) OpenAPI endpoint to retrieve predicate device information.

**검증:** Unit test confirms function returns array of type `Fda510kResult[]` with clearance status, review timing, and device class.

### REQ-EXT-002 (Ubiquitous)
**요구사항:** The system SHALL define a Zod schema `Fda510kResult` with fields: `predicateNumber: string`, `deviceName: string`, `clearanceStatus: enum('cleared', 'pending', 'rejected')`, `reviewDays: number | null`, `deviceClass: string`. Response data SHALL conform to this schema before returning to caller.

**검증:** Schema validation on all `fda-510k.test.ts` test cases. Type safety verified by TypeScript compiler.

### REQ-EXT-003 (Ubiquitous)
**요구사항:** The system SHALL implement a TypeScript module at `lib/external/fda-maude.ts` that exports a function `fetchMaudeEvents(deviceIdentifier: string, limit?: number): Promise<MaudeEvent[]>` which queries the FDA MAUDE adverse event API to retrieve reported events for similar devices.

**검증:** Unit test confirms API calls succeed and return array of type `MaudeEvent[]`. Network timeout returns empty array (no throw).

### REQ-EXT-004 (Ubiquitous)
**요구사항:** The system SHALL define a Zod schema `MaudeEvent` with fields: `eventId: string`, `deviceName: string`, `reportDate: string (ISO-8601)`, `eventDescription: string`, `severity: enum('death', 'serious_injury', 'other')`. All responses from MAUDE API SHALL validate against this schema.

**검증:** Schema validation in `fda-maude.test.ts`. Invalid API responses rejected, logged, and replaced with empty array.

### REQ-EXT-005 (Ubiquitous)
**요구사항:** The system SHALL implement a TypeScript module at `lib/external/eudamed.ts` that exports a function `fetchEudamedDevices(searchQuery: string, filters?: EudamedFilters): Promise<EudamedDevice[]>` which queries the Eudamed public registry API to retrieve EU-registered medical device information.

**검증:** Unit test confirms function returns array of type `EudamedDevice[]`. Filters (regulatory category, jurisdiction, product type) applied correctly.

### REQ-EXT-006 (Ubiquitous)
**요구사항:** The system SHALL define a Zod schema `EudamedDevice` with fields: `registrationNumber: string`, `deviceName: string`, `manufacturerName: string`, `regulatoryCategory: string`, `jurisdiction: string`, `ceMarkDate: string | null`. All Eudamed responses SHALL validate against this schema before use.

**검증:** Schema validation in `eudamed.test.ts` (7 test cases). Parse errors logged, empty array returned to caller.

### REQ-EXT-007 (Ubiquitous)
**요구사항:** The system SHALL implement a caching layer at `lib/external/cache.ts` using Next.js `unstable_cache` function with TTL configuration (default 7 days for FDA data, 14 days for Eudamed). Caching behavior SHALL be controllable via environment variable `DISABLE_EXTERNAL_CACHE=true` (default: false, caching enabled).

**검증:** Cache layer unit test (4 cases) verifies: (a) cache hit on repeated calls, (b) cache expiration after TTL, (c) cache bypass when `DISABLE_EXTERNAL_CACHE=true`.

### REQ-EXT-008 (Event-Driven)
**요구사항:** WHEN the LLM consult pipeline (Phase B) generates prose about a medical device submission, AND predicate device / adverse event / EU registration data is available, THEN the system SHALL invoke `lib/ai/external-enrichment.ts` to fetch relevant external data and inline this information into the prose context as supporting evidence.

**검증:** Integration test in consult pipeline: query with device class → external enrichment fetched → prose includes predicate device info / MAUDE event count / EU registration status.

### REQ-EXT-009 (Unwanted)
**요구사항:** IF any external API returns a network error, timeout, or non-2xx response, THEN the system SHALL NOT throw an exception. Instead, the corresponding enrichment function SHALL return an empty array `[]` and log the error to Sentry with severity `warning`. Consult pipeline SHALL continue with available data only.

**검증:** Integration test: simulate API timeout → empty array returned → consult continues → Sentry warning logged.

### REQ-EXT-010 (State-Driven)
**요구사항:** IF an external API returns HTTP 429 (rate limit), THEN the system SHALL implement exponential backoff retry (initial delay 1s, max 32s, max 5 retries) before returning empty array. Retry state SHALL NOT persist across server restarts.

**검증:** Unit test: mock 429 response → function retries with increasing delays → succeeds on retry 3 → returns data. Test execution time confirms exponential backoff timing.

---

## 구현 완료 현황

| 요구사항 | 파일 | 상태 | 테스트 |
|---------|------|------|--------|
| REQ-EXT-001 | `lib/external/fda-510k.ts` | ✅ 완료 | 5 cases pass |
| REQ-EXT-002 | `lib/external/fda-510k.ts` | ✅ 완료 | Zod 스키마 정의, 검증 |
| REQ-EXT-003 | `lib/external/fda-maude.ts` | ✅ 완료 | 6 cases pass |
| REQ-EXT-004 | `lib/external/fda-maude.ts` | ✅ 완료 | Zod 스키마 정의, 검증 |
| REQ-EXT-005 | `lib/external/eudamed.ts` | ✅ 완료 | 7 cases pass |
| REQ-EXT-006 | `lib/external/eudamed.ts` | ✅ 완료 | Zod 스키마 정의, 검증 |
| REQ-EXT-007 | `lib/external/cache.ts` | ✅ 완료 | 4 cases pass, DISABLE_EXTERNAL_CACHE 지원 |
| REQ-EXT-008 | `lib/ai/external-enrichment.ts`, `lib/ai/consult.ts` | ✅ 완료 | 통합 테스트 pass |
| REQ-EXT-009 | 모든 클라이언트 | ✅ 완료 | 네트워크 오류 시 empty array 반환, Sentry 로깅 |
| REQ-EXT-010 | 캐싱 레이어 | ✅ 완료 | 429 재시도 로직 구현, exponential backoff |

---

## 완료 게이트 (Acceptance Criteria)

- [x] FDA 510(k) API 클라이언트 구현 완료
- [x] FDA MAUDE API 클라이언트 구현 완료
- [x] Eudamed API 클라이언트 구현 완료
- [x] 캐싱 레이어 구현 완료 (TTL 설정, 환경변수 제어)
- [x] LLM consult 파이프라인 통합 완료
- [x] 모든 unit/integration 테스트 통과 (22 cases)
- [x] 네트워크 오류 처리: throw 금지, empty array 반환, Sentry 로깅
- [x] 429 rate limit 재시도: exponential backoff 구현
- [x] Zod 스키마 정의 및 검증
- [x] 환경변수 제어 (DISABLE_EXTERNAL_CACHE)

---

## v0.1.0 폐기 사유

원래 v0.1.0은 **k-anonymity + Differential Privacy 기반의 조직 간 anonymized aggregate**를 목표로 설계되었으나:

1. **프라이버시 복잡도 vs 사업 가치**: 48개 REQ, 외부 PIA 감사 필수, 법률 자문 대기 (blocking)
2. **v2.0 공개 API 접근법**: 
   - 외부 공개 데이터만 사용 (프라이버시 zero-risk)
   - 구현 비용 10배 이상 절감
   - Immediate value: LLM context 강화로 즉시 consult 품질 향상
3. **진행 상황**: v0.1.0은 계획 단계에 머물렀고, v2.0은 이미 완전히 구현됨 (커밋 11bd6fa)

따라서 본 SPEC은 **구현된 v2.0 상태를 공식화**하며, v0.1.0 요구사항은 모두 폐기된다.

---

## 기술 결정 (Design Rationale)

| # | 결정 | 선택 | 근거 |
|---|-----|-----|-----|
| 1 | 공개 API 사용 | FDA OpenAPI + Eudamed public | 프라이버시 리스크 제거, 구현 단순화 |
| 2 | 캐싱 전략 | Next.js unstable_cache, 7-14일 TTL | 공공 데이터 변경 빈도 낮음, 성능 최적화 |
| 3 | 오류 처리 | Empty array 반환, throw 금지 | Graceful degradation, consult pipeline 중단 방지 |
| 4 | 재시도 로직 | Exponential backoff, max 5회 | Rate limit 대응, 서버 부하 완화 |
| 5 | LLM 통합 | Phase B prose 단계에 inlining | 근거 기반 생성, 사용자 투명성 향상 |

---

## 테스트 요약

**총 22 test cases, 모두 통과**

- FDA 510(k): 5 cases (OpenAPI 응답, predicate lookup, error handling)
- FDA MAUDE: 6 cases (adverse event filtering, severity classification)
- Eudamed: 7 cases (registry search, regulatory category mapping)
- Cache layer: 4 cases (TTL, bypass, hit/miss)

**Coverage:** 단위 테스트 + 통합 테스트 모두 포함.

---

## 배포 가이드

1. **환경변수 설정**:
   ```
   DISABLE_EXTERNAL_CACHE=false  (기본값, 캐싱 활성)
   FDA_API_KEY=<from FDA developer portal>
   EUDAMED_API_KEY=<if required>
   ```

2. **캐싱 비활성화**:
   - Development: `DISABLE_EXTERNAL_CACHE=true`
   - Production: 기본값 유지

3. **Rate limit 대응**:
   - 자동 exponential backoff (기본 설정)
   - 429 응답 시 자동 재시도 최대 5회

---

## v2.0 성과

- **구현 완료**: 10개 REQ, 22 test case
- **프라이버시**: 공개 데이터만 사용, zero-risk
- **성능**: 캐싱으로 repeated query 최적화
- **가용성**: 네트워크 오류 graceful handling
- **사용자 경험**: LLM 응답에 predicate device / adverse event / EU registration 데이터 자동 포함

---

**End of SPEC-REGULA-NETWORK-001 v2.0.0**
