# SPEC-REGULA-STANDARDS-001 — Implementation Tasks Plan

> Issue #62 · Branch `feat/issue-62-standards` · Base `a86c2b7` (main) · 2026-06-26
> 본 문서는 분석 + 계획 ONLY (코드/마이그레이션/테스트 변경 불가).

---

## §1 Baseline (직접 검증, L-007)

| 지표 | 검증 위치 | 값 | 비고 |
|---|---|---|---|
| Latest migration | `ls migrations/ \| sort \| tail` | `0087_project_memory.sql` | 신규 = **0088** |
| audit_action 총합 | `tests/unit/audit.test.ts:75` | `toHaveLength(199)` // +3 memory_* (#51) | 신규 액션 추가 시 `199 + N` 으로 bump |
| PERMISSIONS 총합 | `tests/unit/auth/permissions.test.ts:90` · `tests/regression/foundation.test.ts:42` | `toHaveLength(75)` / `toBe(75)` // +2 corpuslicense +2 sourcegov +1 rlhf +2 knowledgepromo | 신규 권한 추가 시 `75 + N` |
| regression suite | runtime `pnpm test` 통과 수 | **4472 passed** (runtime 합계, 인-테스트 assertion 아님) | 런타임 합계 — 파일 내 hard-coded 아님 |
| Inngest registry | `lib/inngest/functions.ts` (central) | function IDs 배열 — 현재 `knowledge-gap-daily-digest`, `weekly-digest`, `capa-effectiveness-due-reminder` 등 포함 | 신규 cron 등록 시 배열에 추가 + `lib/inngest/__tests__/functions.test.ts:29` 패턴으로 ID 포함 검증 |
| 기존 산출물 | `lib/standards/applicability-engine.ts` (351 LOC) | 이미 존재: `DeviceProfile`, `ApplicableStandard`, `STANDARDS_SEED_DATA`(seed) | **재사용/확장** — 새 작성 금지 |
| RBAC 패턴 | `lib/corpus-license/access.ts` (`assertSourceInOrg`, `assertSourceLicenseInOrg`) · `lib/auth/permissions.ts` | `withPermission` + org-scope + IDOR | 표준 패턴 |
| Audit tx 패턴 | `lib/audit.ts:453` `writeAudit(params, tx?)` | `withTenantScope` 내 tx 전파 | 표준 패턴 |
| 외부 API graceful | `lib/env.ts:77-91` `.optional()` | `HYBRID_RA_API_BASE_URL`, `GITEA_URL` 등 optional → env unset 시 no-op | 표준 패턴 |
| Radar 크롤러 프레임워크 | `lib/radar/crawlers/_base.ts` (`runCrawler`) + `eu-oj.ts`/`fda-federal-register.ts`/`mfds-notice.ts` | robots.txt 캐시, retry 429/503, audit logging | **standards 크롤러는 이 프레임워크 위에 구현** |

---

## §2 MVP Scope — IN vs Deferred (핵심 섹션)

이 SPEC은 #50/#51(테이블 1개)과 달리 **4개 테이블 + 4개 외부 크롤러 + FDA 6000-row DB + cron + 알림 파이프라인**을 포함한다. 단일 PR 컨텍스트 예산(≤200K)과 외부 의존성 안정성을 고려해 **MVP 코어 + graceful-degradation 스텁 + follow-up 이슈**로 분할한다.

### IN-scope (이 PR)

| 항목 | 범위 | 근거 REQ/AC |
|---|---|---|
| `standards_catalog` 테이블 (migration 0088) | 번호·제목·버전·상태·body(ISO/IEC/CEN/ASTM)·FDA 인정 여부·EU 조화 여부·체계 인덱스 | REQ-008 |
| `standards_applicability` 테이블 | device_profile_key → standard_id 매핑 + 규칙 메타데이터 | REQ-001/004/005/006 |
| `standards_updates` 테이블 (최소) | revision/dates/transition 정보 저장 (크롤러 미연결 시 비어 있음) | REQ-008/010 |
| `product_standards_compliance` 테이블 (최소) | product_id ↔ standard_id ↔ status | REQ-013 |
| mapping-engine (rule-based) | IEC 60601 / ISO 10993 / IEC 62304+62366 / ISO 14971 / ISO 11607 — `DeviceProfile` 입력 → `ApplicableStandard[]` 출력 + 인용 provenance | REQ-001/004/005/006/021 |
| applicability API | `POST /api/standards/applicability` — mapping-engine 실제 호출(call-site 증명), ≤5s | REQ-001/019, AC-03 |
| FDA recognition check API | `GET /api/standards/check?standard={id}` — FDA endpoint optional 호출, 미설정 시 로컬 seed로 우회 + 응답에 `degraded=true` 표시 | REQ-015/016, AC-06 |
| transition-calculator (순수 함수) | OJ 게재일/Date of Withdrawal(DoW) → D-12/D-6/D-3 임계일 계산 | REQ-010/012, AC-05 |
| impact-analyzer (로컬 질의) | revision 감지 시 `product_standards_compliance` 기반 영향 제품 식별 | REQ-011 |
| revision-detector (graceful-degradation 스텁) | 활성 소스가 없을 때 no-op, 설정 시 `_base.ts` 프레임워크 호출 인터페이스 | REQ-009 (구조만) |
| Inngest cron (1개) | `standards-revision-daily` — `lib/inngest/functions.ts` 레지스트리에 등록, daily 트리거 | REQ-009/020, AC-04 (구조적 ≤24h) |
| alert-pipeline (로컬 emit) | `standards_updates` 행 삽입 + audit_action 추가(신규) → Notifications Hub #52 미구축 시 `radar_events` 또는 로컬 `standards_alerts` 큐에 emit | REQ-011/017/018 (구조만) |
| RBAC (REQ-022) | `standards.read` / `standards.manage` 권한 2개 추가 | REQ-022 |
| Citation provenance (Charter [지양-2]) | 모든 `ApplicableStandard` 응답에 `catalogRowId`/`source` 필드 강제 | REQ-021 |
| seed (30~50 core standards) | REQ-004/005/006/§1.2 명시 표준 중심 — `STANDARDS_SEED_DATA` 확장 | AC-01 PARTIAL |
| UI 기본 | `app/(workflows)/standards/page.tsx` — 분류 결과 → 적용 표준 목록 표시 + 인정 상태 배지 | REQ-001 (사용자 가시성) |

### DEFERRED (follow-up issues)

| 항목 | 사유 | 제안 follow-up 이슈 제목 |
|---|---|---|
| ISO/IEC/CEN/ASTM 라이브 크롤러 구현 | 외부 API 가용성/안정성 미확정, 스크래핑 합법성 검토 필요, 단일 PR 컨텍스트 초과 | "Issue #62-A: Implement live ISO/IEC/CEN/ASTM standards crawlers (graceful-degradation → active)" |
| FDA Recognized Standards DB 6000+ row full import | 대용량 데이터 복제(저작권/출처), 데이터 갱신 주기 합의 필요 | "Issue #62-B: Import full FDA Recognized Consensus Standards DB (6000+ rows) with provenance" |
| EU OJ Series C 크롤러 자동 갱신 | OJ 게재 구조 분석 + DoW 파싱 별도 작업 | "Issue #62-C: EU OJ Harmonized Standards crawler + DoW parser" |
| Notifications Hub (#52) 통합 | #52 미구축 — 본 PR은 로컬 emit만, #52 완성 후 wiring | "Issue #62-D: Wire standards alerts to Notifications Hub (#52) when ready" |
| Regulatory Radar 대시보드 카드 | `radar_events` 스키마 확정 후 연계 | "Issue #62-E: Standards alert card in Regulatory Radar dashboard" |
| gap analysis 상세 리포트 (revision diff 요약) | LLM 요약 + 출처 검증 별도 | "Issue #62-F: Gap analysis revision-diff summarization (REQ-014)" |
| RAG-assist mapping 보조 | 규칙 기반 우선 안정화 후 보조 활성화 | "Issue #62-G: RAG-assist layer for standards mapping engine" |
| **Alert emission pipeline** (`emitStandardsAlert` / `transition-calculator`) | 크론이 현재 detect + audit만 수행. 라이브 크롤러 데이터가 흐르는 #62-A에서 emit 파이프라인 연결 | "Issue #62-A: Wire `emitStandardsAlert` + `transition-calculator` into `standards-revision-daily` when live crawler data flows; cron currently detects + audits but does not emit alerts until #62-A" |

### 왜 이 분할인가 (Concise Rationale)

- **Context-budget**: 라이브 크롤러 4종(ISO/IEC/CEN/ASTM) + 6000-row import + cron + 알림 + UI를 단일 세션 구현 시 200K 예산 초과 위험. MVP 코어(매핑·전환 계산·인정 체크)가 실사용 가치의 80%를 차지.
- **External-dependency**: FDA/ISO/IEC API 엔드포인트 및 인증 방식은 사전 검증이 필요. `.optional()` env + typed interface로 먼저 구조를 잡고, 데이터는 follow-up에서 채운다(`hybrid-ra-client` 패턴).
- **Data-volume**: 6000-row seed는 리포지토리 크기·저작권·갱신 주기 합의가 별도 이슈. 코어 30~50 표준으로 AC-01 "PARTIAL" 명시.
- **#52 차단 해소**: Notifications Hub 대기 시 알림 파이프라인이 막힘. 로컬 emit 큐로 먼저 비동기 처리 후 #52 완성 시 wiring.

---

## §3 Phases

### P0 — Migration 0088 + RBAC + Audit (우선)

- **0088_standards.sql**: 4개 신규 테이블 (`standards_catalog`, `standards_applicability`, `standards_updates`, `product_standards_compliance`) + RLS (org_id scope) + 인덱스(`body`, `standard_number`)
- `lib/auth/permissions.ts`: `standards.read` (scope: tenant, minRole: viewer), `standards.manage` (scope: tenant, minRole: ra-lead) — **+2** (Charter [지양-4] RA Lead 권한)
- `lib/audit.ts` / schema: 신규 audit_action 추가 — `standards.mapping.generated`, `standards.recognition.checked`, `standards.revision.detected`, `standards.alert.emitted` — **+4**
- `db/schema.ts`: 4개 테이블 스키마 추가
- `lib/model-governance/registry.ts` (또는 해당 영역): lazy-import 경로 확인 (L-003/lessons)

### P1 — lib/standards (매핑·계산·분석)

- **mapping-engine.ts**: 기존 `applicability-engine.ts`(351 LOC)의 `DeviceProfile`/`ApplicableStandard` 인터페이스 재사용 + DB 조회 통합. 순수 함수 `mapApplicableStandards(profile: DeviceProfile): ApplicableStandard[]` — 캐싱 KV 옵션.
- **transition-calculator.ts**: `calculateTransitionMilestones(ojDate, dow)` → `{ d12, d6, d3, dow }` 순수 함수 (AC-05 단위 테스트 용이)
- **impact-analyzer.ts**: `identifyAffectedProducts(standardId)` — `product_standards_compliance` 조인 질의
- **revision-detector.ts**: typed interface `RevisionSource` + graceful-degradation 구현체 `detectRevisions(env)` — 활성 소스 0개 시 즉시 return `[]` (corpus-license 패턴)
- **crawlers/_types.ts**: `StandardsCrawlerContext`, `StandardsRawUpdate` 정의 (radar `_base.ts` 재사용 지향)
- 크롤러 4종(iso/iec/cen/astm): **typed stub only** — 구현체는 follow-up #62-A. 인터페이스만.

### P2 — API Routes

- `app/api/standards/applicability/route.ts`:
  - `POST` — body: `DeviceProfile` (또는 classification result)
  - **mapping-engine 실제 import + 호출** (call-site 증명 — L-002 dead-code 방지)
  - `withPermission('standards.read')` + `writeAudit('standards.mapping.generated', tx)` in `withTenantScope`
  - 응답: `ApplicableStandard[]` with `catalogRowId`/`source` (Charter [지약-2])
- `app/api/standards/check/route.ts`:
  - `GET ?standard={id}& jurisdiction=fda|eu`
  - FDA endpoint optional 호출 (env `FDA_RECOGNIZED_STANDARDS_API_URL`). unset 시 seed 조회 + `degraded: true`
  - 철회 시 대체 표준 제안 로직 (로컬 rule)
- `app/api/standards/[id]/gap/route.ts`: `GET` — `standards_updates` 기반 현재 vs 최신 비교 (최소 버전 리포트)
- `app/api/standards/cron/detect/route.ts`: Inngest 핸들러 노출용 라우트 (또는 Inngest 함수 직접 등록)

### P3 — Inngest Cron (레지스트리 증명)

- `lib/inngest/standards/standards-revision-daily.ts`:
  - `inngest.createFunction({ id: 'standards-revision-daily', name: 'Standards Revision Detector' }, { cron: '0 9 * * *' }, ...)`
  - 패턴: `lib/inngest/digest/knowledge-gap-daily-digest.ts:18` (MX:REASON mirror)
  - `detectRevisions(env)` 호출 → `identifyAffectedProducts` → alert-pipeline emit
- **`lib/inngest/functions.ts`**: `standardsRevisionDailyFn` import + 배열에 추가 (중앙 레지스트리)
- `lib/inngest/__tests__/functions.test.ts`: `expect(ids).toContain('standards-revision-daily')` 추가 (L-002 call-site/registry 증명)

### P4 — UI

- `app/(workflows)/standards/page.tsx`:
  - 분류 결과(SPEC-REGULA-CLASSIFY-001) 선택 → `POST /api/standards/applicability`
  - 결과 목록 + FDA 인정 배지(degraded 표시) + EU 조화 배지
  - Charter [지양-4]: "RA Lead 검토용 제안" 명시 — 자동 제출 버튼 없음
- 컴포넌트 재사용: 기존 `Card`/`Badge`/`DataTable` (regula-design-tokens)

### P5 — Tests + Seed

- 단위 테스트:
  - `lib/standards/__tests__/mapping-engine.test.ts` — DeviceProfile 변형별 적용 표준 매핑 검증 (IEC 60601, ISO 10993, IEC 62304/62366, ISO 14971, ISO 11607)
  - `lib/standards/__tests__/transition-calculator.test.ts` — D-12/6/3 임계일 계산 (AC-05)
  - `lib/standards/__tests__/impact-analyzer.test.ts`
  - `lib/standards/__tests__/revision-detector.test.ts` — no-source → `[]` graceful
- 통합 테스트:
  - `tests/integration/api/standards-applicability.test.ts` — RBAC + ≤5s 응답 (AC-03)
  - `tests/integration/api/standards-check.test.ts` — FDA env unset 시 degraded (AC-06)
- Inngest 레지스트리 테스트: `lib/inngest/__tests__/functions.test.ts` 신규 ID 추가
- Seed: 30~50 코어 표준 (ISO 14971:2019, IEC 60601-1:2020, ISO 10993-1:2018, IEC 62304:2015, IEC 62366-1:2015, ISO 11607-1:2019 등) — `STANDARDS_SEED_DATA` 확장 또는 마이그레이션 SQL seed

---

## §4 File List + Count-Delta Predictions + Must-Update Tests

### 신규 파일

```
migrations/0088_standards.sql
lib/standards/mapping-engine.ts           (또는 applicability-engine.ts 확장)
lib/standards/transition-calculator.ts
lib/standards/impact-analyzer.ts
lib/standards/revision-detector.ts
lib/standards/alert-pipeline.ts
lib/standards/crawlers/_types.ts          (typed interfaces only)
lib/standards/crawlers/{iso,iec,cen,astm}.ts  (stubs)
lib/inngest/standards/standards-revision-daily.ts
app/api/standards/applicability/route.ts
app/api/standards/check/route.ts
app/api/standards/[id]/gap/route.ts
app/(workflows)/standards/page.tsx
tests/unit/standards/*.test.ts            (4~5개)
tests/integration/api/standards-*.test.ts (2개)
```

### 수정 파일

```
db/schema.ts                              (+4 테이블)
lib/auth/permissions.ts                   (+2 권한)
lib/audit.ts / schema (audit_action)      (+4 액션)
lib/inngest/functions.ts                  (+1 함수 등록)
lib/inngest/__tests__/functions.test.ts   (+1 ID 검증)
lib/standards/applicability-engine.ts     (확장 또는 위임)
```

### Predicted Count Deltas (L-007 distributed)

| 지표 | 기준값 | 신규 추가 | 예측값 | 비고 |
|---|---|---|---|---|
| `audit_action` 총합 (`tests/unit/audit.test.ts:75`) | **199** | +4 (`standards.mapping.generated`, `.recognition.checked`, `.revision.detected`, `.alert.emitted`) | **203** | L-007: 모든 `audit_action` 분산 assertion 동기화 |
| `PERMISSIONS` (`tests/unit/auth/permissions.test.ts:90`, `tests/regression/foundation.test.ts:42`) | **75** | +2 (`standards.read`, `standards.manage`) | **77** | 두 파일 모두 업데이트 |
| Latest migration | `0087` | +1 | **`0088_standards.sql`** | |
| Inngest registry IDs (`lib/inngest/__tests__/functions.test.ts`) | 현재 IDs | +1 | `standards-revision-daily` 포함 | |
| regression runtime 통과 수 | 4472 | 신규 테스트 ~15~20 | ~4490 (예측, hard assertion 아님) | |

### 반드시 업데이트할 분산 count-assertion 테스트 (L-007)

`audit_action` 또는 `PERMISSIONS` 수를 hard-assert 하는 모든 파일. grep 결과 기준:

1. `tests/unit/audit.test.ts:75` — `toHaveLength(199)` → **203**
2. `tests/unit/auth/permissions.test.ts:90` — `toHaveLength(75)` → **77**
3. `tests/regression/foundation.test.ts:42` — `toBe(75)` → **77**
4. `tests/unit/enterprise-migrations.test.ts` — 스키마/enum 텍스트 검증 (audit_action enum 섹션) — 신규 4개 값 존재 확인
5. `tests/unit/auditor-migrations.test.ts` — 동일 패턴 확인
6. `tests/unit/schema.test.ts` — 신규 4개 테이블 스키마 검증 추가
7. `tests/integration/cyberdevice.test.ts` — audit_action 관련 assertion 있으면 동기화
8. `tests/integration/capa.test.ts` — 동일
9. `tests/integration/change-control.test.ts` — 동일
10. `tests/unit/cer-migrations.test.ts` — 동일
11. `tests/unit/impact-migrations.test.ts` — 동일
12. `tests/unit/predicate-schema.test.ts` — 동일
13. `tests/unit/ingest/docingest-migrations.test.ts` — 동일

> **실행 전 검증**: 각 파일에서 `199` 또는 `75` 정확 매칭 grep 후 업데이트. L-007 교훈: 커밋 전 staged 범위 직검.

---

## §5 AC ↔ Requirement ↔ Test 매핑 (dead-code 방지)

| AC | 상태 | 검증 REQ | 매핑 엔진/검증 파일 | Call-site / Registry 증명 |
|---|---|---|---|---|
| **AC-01** FDA 6000+ | **PARTIAL** (seeded core 30~50 + API ready) | REQ-002 | seed in `STANDARDS_SEED_DATA` + `standards_catalog`; check API 통한 FDA endpoint optional 조회 | full import는 follow-up #62-B |
| **AC-02** EU OJ 크롤러 자동 갱신 | **PARTIAL** (로컬 seed + typed stub, 라이브 크롤링은 follow-up #62-C) | REQ-003/007 | `crawlers/eu-oj-stub.ts` 인터페이스만 | 라이브 구현은 follow-up |
| **AC-03** ≤5s 매핑 | **PASS** | REQ-001/019/021 | `tests/integration/api/standards-applicability.test.ts` (≤5000ms 단언) | **mapping-engine이 `route.ts`에서 실제 import + 호출됨** (`lib/standards/applicability-engine.ts:1` MX:ANCHOR 기존 fan_in≥3 유지) |
| **AC-04** ≤24h 개정 알림 | **PARTIAL/구조적** (cron 등록, 활성 소스 없을 시 no-op) | REQ-009/020 | `lib/inngest/standards/standards-revision-daily.ts` daily cron | **`lib/inngest/functions.ts` 중앙 레지스트리에 ID 추가 + `lib/inngest/__tests__/functions.test.ts`에서 `toContain('standards-revision-daily')` 단언** (L-002) |
| **AC-05** D-6 전환 경고 | **PASS** | REQ-010/012 | `lib/standards/__tests__/transition-calculator.test.ts` (순수 함수 단위 테스트) | 계산 결과가 alert-pipeline에서 emit되어 `standards_updates` 행 삽입 |
| **AC-06** FDA 인정 철회 경고 + 대체 | **PASS** (env 설정 시 real-time, 미설정 시 seed 기반 + `degraded`) | REQ-015/016 | `tests/integration/api/standards-check.test.ts` — env unset 케이스와 set 케이스 분리 | check route 실제 존재 + RBAC + audit |

### Dead-code 방지 증명점 (L-002 재발 방지)

1. **mapping-engine call-site**: `app/api/standards/applicability/route.ts`가 `import { mapApplicableStandards } from '@/lib/standards/mapping-engine'` 후 핸들러 본문에서 호출. 통합 테스트가 엔드포인트 호출 시 `standards.mapping.generated` audit 이벤트 발생 확인.
2. **cron registry**: `lib/inngest/functions.ts` 배열에 `standardsRevisionDailyFn` 추가되어 Inngest serve 엔드포인트가 노출. `lib/inngest/__tests__/functions.test.ts` 단언 추가. (이중 증명: registry + test).

---

## §6 Charter Guards

| Charter 원칙 | 본 SPEC 적용 | 검증 파일 |
|---|---|---|
| **[지양-2] Citation provenance** | 모든 `ApplicableStandard` 응답은 `catalogRowId`(standards_catalog PK) + `source`('seed' \| 'fda_api' \| 'eu_oj') 필드 포함. citation-less 결과는 API 계약 위반. | mapping-engine 출력 타입 + API 통합 테스트 |
| **[지양-4] Mapping = decision support** | UI에 "RA Lead 검토용 제안" 명시. 자동 제출/적용 버튼 없음. `standards.manage` 권한자만 메모 저장(별도 audit). | `app/(workflows)/standards/page.tsx` 카피 + RBAC (REQ-022) |
| **[지양-3] External 의존성 격리** | 모든 외부 API(ISO/IEC/FDA/EU OJ)는 `.optional()` env + graceful-degradation. unset 시에도 부팅 정상. | `lib/env.ts` + 각 크롤러/클라이언트 |
| **[지양-1] MVP 우선** | 본 §2 분할 준수 — 라이브 크롤러/6000-row import는 follow-up 이슈로 분리 | tasks.md §2 참조 |

---

## §7 Risks

| 위험 | 영향 | 완화 |
|---|---|---|
| **외부 API rate-limit / 스크래핑 합법성** (ISO OBP, IEC Webstore, ASTM Compass) | 크롤러 구현 시 계정/ToS 문제, IP 차단 | API-first 접근 — FDA는 Recognized Consensus Standards list 엔드포인트 우선 사용. ISO/IEC/CEN/ASTM은 typed stub만 두고 follow-up #62-A에서 라이선스/ToS 검토 후 구현. radar `_base.ts`의 robots.txt 캐시 + 429/503 백오프 재사용. |
| **transition-period 엣지 케이스** (윤년, OJ 게재일 누락, DoW 연장 규칙, 시차) | D-12/6/3 알림 정확성 저하 | 순수 함수 단위 테스트로 캘린더 연산 검증 (AC-05). OJ 게재일·DoW 누락 시 `null` 처리 + 감사 로그. EU MDR 전환 규칙(MDR Annex XII 등)은 별도 rule 테이블로 추상화. |
| **seed 데이터 출처/저작권** | 표준 번호·제목은 공개 정보지만, 전문 복제 주의 | seed는 번호·제목·버전·body·인식 상태 메타데이터만 저장 (전문 X). 출처(source 필드) 필수. 6000-row full import는 follow-up #62-B에서 FDA 공개 DB 적법성 재확인. |
| **#52 Notifications Hub 미구축 차단** | 알림 파이프라인 막힘 | 로컬 `standards_alerts` 큐(또는 `radar_events` 재사용)에 emit + audit 로깅. #52 완성 시 consumer wiring만 follow-up #62-D로 분리. |
| **mapping-engine 단일 세션 컨텍스트 한계** | 본 PR 코어 구현 시 컨텍스트 예산 200K 초과 위험 | §2 분할로 코어만 구현, RAG 보조는 follow-up #62-G. mapping-engine 단순 규칙 테이블 유지. |
| **RLS 회귀 (org_id scope)** | 다른 테넌트 표준 누출 | 4개 신규 테이블 모두 RLS + `with_check` (SPEC-RLS-001 패턴). IDOR 통합 테스트 추가. |
| **AC-01/AC-02 PARTIAL 명시 누락** | 리뷰어가 "드롭"으로 오인 | 본 tasks.md §2·§5에 PARTIAL 명시 + PR 설명에 follow-up 이슈 링크 (#62-B/#62-C). |

---

## §8 의존성 및 선행 조건

- **SPEC-REGULA-CLASSIFY-001 (#59, merged)**: `ClassificationOutput` (`lib/classify/types.ts:71`)을 mapping-engine 입력으로 소비. `DeviceProfile` 변환 레이어 필요 (`samdFlag`/`hasSoftware`/`isElectrical` 등 매핑).
- **Phase 10 Regulatory Radar**: `lib/radar/crawlers/_base.ts` 프레임워크 재사용 (standards 크롤러 stub의 부모). `radar_events`/notifier 통합은 선택.
- **#52 Notifications Hub**: 미구축 — 본 PR은 로컬 emit만.
- **#46 ISO 14971 Risk**: 본 SPEC은 `ISO 14971` 준수 체크만 매핑에 포함, 위험관리 워크플로우는 #46 소관.

---

Version: 1.0.0
Author: manager-strategy
Date: 2026-06-26
