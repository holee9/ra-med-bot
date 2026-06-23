# SPEC-REGULA-CLASSIFY-001 — Implementation Tasks

> DDD ANALYZE phase产物. 기존 코드베이스 분석 기반 작업 분해.
> 각 작업은 테스트 우선 (TDD). 코드 식별자 영문, 설명 한국어.
> 우선순위: P(High/Medium/Low). 시간 추정 금지 — 순서만 명시.

---

## Phase 0: 기반 (DB + 권한 + 감사 + Enum) — Priority High

선행: 다른 모든 Phase의 전제. workflow_runs 패턴 재사용 (RISK-001 참조).

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T0.1 | workflowType enum 확장 ('classify' 추가) | `lib/db/schema.ts` | — | enum 값 존재 단위 테스트 |
| T0.2 | auditActionEnum에 classify.* 3종 추가 | `lib/db/schema.ts` | AC-03 | enum 값 존재 단위 테스트 |
| T0.3 | device_classifications 테이블 정의 | `lib/db/schema.ts` | REQ-020 | insert/select drizzle 통합 테스트 |
| T0.4 | classification_rules 테이블 정의 | `lib/db/schema.ts` | — | insert/select 통합 테스트 |
| T0.5 | product_code_index 테이블 정의 | `lib/db/schema.ts` | — | insert/select 통합 테스트 |
| T0.6 | 관할권별 분류 enum 정의 (fdaClass, euMdrClass, mfdsGrade, nmpaGrade, pmdaClass) | `lib/db/schema.ts` | REQ-005~013 | enum 값 단위 테스트 |
| T0.7 | RLS 정책 (workflow_runs org 격리 상속) | migration SQL | — | 타 org 접근 차단 통합 테스트 |
| T0.8 | 마이그레이션 생성·검토 | `lib/db/migrations/0067_classify_*.sql` | — | migration up/down 검증 |
| T0.9 | 권한 classify.generate/view 추가 | `lib/auth/permissions.ts` | — | role→permission 매핑 단위 테스트 |

## Phase 1: 분류 엔진 (lib/classify/*) — Priority High

순수 함수 우선 (의존성 적음). FDA/EU MDR/MFDS/NMPA/PMDA별 분류 로직.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T1.1 | parseDeviceIntent (Haiku intent parser) | `lib/classify/intent-parser.ts` | REQ-001 | 기기 특성 추출 단위 테스트 |
| T1.2 | classifyFDA (Class I/II/III + Exempt/510(k)/PMA path) | `lib/classify/engines/fda.ts` | REQ-005~008 | Product Code DB 조회 + 경로 결정 단위 테스트 |
| T1.3 | identifyDeNovoPath (De Novo 경로 식별) | `lib/classify/engines/fda.ts` | REQ-007 | De Novo 조건 분기 단위 테스트 |
| T1.4 | generatePredicatesList (초기 predicate 목록) | `lib/classify/engines/fda.ts` | REQ-008 | predicate 검색 결과 매핑 단위 테스트 |
| T1.5 | classifyEuMDR (Annex VIII Rules 1-22 적용) | `lib/classify/engines/eu-mdr.ts` | REQ-009~011 | Rule 트리 탐색 + Class 산출 단위 테스트 |
| T1.6 | distinguishMDRvsIVDR (MDR/IVDR 구분) | `lib/classify/engines/eu-mdr.ts` | REQ-010 | 기기 유형 분기 단위 테스트 |
| T1.7 | determineNotifiedBodyRequired (NB 필요 여부) | `lib/classify/engines/eu-mdr.ts` | REQ-011 | Class 기준 NB 필수 조건 단위 테스트 |
| T1.8 | classifyAsia (MFDS/NMPA/PMDA 통합) | `lib/classify/engines/asia.ts` | REQ-012~013 | 한국/중국/일본 등급 코드 맵 단위 테스트 |
| T1.9 | identifyEquivalentPath (등가심사/비교 인증) | `lib/classify/engines/asia.ts` | REQ-013 | 관할권별 동등 경로 식별 단위 테스트 |

## Phase 2: RAG 규칙 검색 (lib/classify/retrievers/*) — Priority High

분류 근거 문서 retrieval → citations 피드. internal-docs retriever 패턴 재사용.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T2.1 | perJurisdictionRuleRetriever (관할권별 규칙 검색) | `lib/classify/retrievers/jurisdiction-rules.ts` | REQ-017 | RAG mock + 규칙 매핑 단위 테스트 |
| T2.2 | FDA Product Code DB retriever | `lib/classify/retrievers/fda-product-codes.ts` | REQ-006 | Product Code 인덱스 조회 단위 테스트 |
| T2.3 | EU MDR Annex VIII Rule retriever | `lib/classify/retrievers/eu-mdr-rules.ts` | REQ-009 | Rule 번호 매핑 단위 테스트 |
| T2.4 | classifyWithRAG (RAG 보조 분류) | `lib/classify/aggregator.ts` | REQ-017 | 규칙 citation 포함 분류 결과 단위 테스트 |

## Phase 3: BFF API Routes — Priority High

withPermission + createHybridRaFetch 패턴. risk/ workflow route 참조.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T3.1 | POST /classify/runs (run 생성 + audit) | `app/api/ra/classify/runs/route.ts` | REQ-001~004 | 권한·생성·audit 기록 통합 테스트 |
| T3.2 | GET /classify/runs/[id] (aggregate 조회) | `app/api/ra/classify/runs/[id]/route.ts` | — | 5개 관할권 결과 조립 테스트 |
| T3.3 | GET /classify/runs/[id]/export (분류 보고서 export) | `app/api/ra/classify/runs/[id]/export/route.ts` | — | DOCX 생성 + 비교표 렌더 테스트 |

## Phase 4: UI Wizard (app/(app)/workflows/classify/*) — Priority Medium

선행: Phase 3 API. TanStack Query 훅 + 컴포넌트. RiskWizard 패턴 재사용.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T4.1 | Query 훅 (useClassifyRun 등) | `components/classify/hooks.ts` | — | 훅 fetch·캐시 단위 테스트 |
| T4.2 | ClassifyWizard (단계별 stepper) | `components/classify/ClassifyWizard.tsx` | REQ-001~004 | 단계 잠금 RTL 테스트 |
| T4.3 | DeviceDescriptionStep (기기 묘사 + 파라미터 입력) | `components/classify/DeviceDescriptionStep.tsx` | REQ-001~004 | 신체 접촉·기기 유형 입력 RTL 테스트 |
| T4.4 | ClassificationResultStep (5개 관할권 비교표) | `components/classify/ClassificationResultStep.tsx` | REQ-014 | ComparisonTable 블록 렌더 RTL 테스트 |
| T4.5 | TimelineBlock (예상 타임라인) | `components/classify/TimelineBlock.tsx` | REQ-015 | Timeline 블록 렌더 RTL 테스트 |
| T4.6 | StandardsLinkBlock (핵심 표준 + SPEC-REGULA-STANDARDS-001 연계) | `components/classify/StandardsLinkBlock.tsx` | REQ-016 | 표준 목록 렌더 + 링크 RTL 테스트 |
| T4.7 | CitationsBlock (분류 근거 citation) | `components/classify/CitationsBlock.tsx` | REQ-017 | citation 클릭 소스 이동 RTL 테스트 |
| T4.8 | SubmissionLifecycleLink (자동 연계 #37) | `components/classify/SubmissionLifecycleLink.tsx` | REQ-018 | 라이프사이클 진입점 링크 RTL 테스트 |
| T4.9 | 페이지 (목록 + 위저드 라우트) | `app/(app)/workflows/classify/page.tsx`, `[runId]/page.tsx` | — | 라우팅·렌더 smoke 테스트 |

## Phase 5: AI/ML SaMD 라우팅 — Priority Medium

SPEC-REGULA-SAMD-001 연계.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T5.1 | detectAIComponent (AI/ML 구성 요소 감지) | `lib/classify/samd-detector.ts` | REQ-004 | AI/ML 키워드/패턴 매칭 단위 테스트 |
| T5.2 | routeToSamdPath (SaMD 경로 분기) | `lib/classify/aggregator.ts` | REQ-004 | AI/ML 시 SaMD 워크플로우 라우팅 단위 테스트 |

## Phase 6: Eval + E2E — Priority Medium

| # | 작업 | 산출물 | REQ/AC | 테스트 |
|---|------|--------|--------|--------|
| T6.1 | promptfoo classification-accuracy suite | `evals/classify/fda-classification.yaml` | AC-01 | 인슐린펌프·심박조률계 >90% 정확도 |
| T6.2 | E2E 분류 전체 플로우 | `e2e/classify.spec.ts` | AC-01~AC-06 | 묘사 입력→5개 관할권 결과→export Playwright |
| T6.3 | E2E 3초 응답 SLA | `e2e/classify-timing.spec.ts` | AC-02 | 5개 관할권 동시 분류 <3초 검증 |

---

## 의존 그래프

```
Phase 0 (DB/권한/감사/Enum)
   ├──> Phase 1 (분류 엔진)
   │       └──> Phase 2 (RAG 규칙 검색)
   │                          └──> Phase 3 (API) ──> Phase 4 (UI)
   │                                                     └──> Phase 5 (SaMD 라우팅)
   └──> Phase 6 (Eval/E2E, 최종)
```

병렬 가능: Phase 1 순수 함수(T1.1~T1.9)는 Phase 0 완료 후 즉시 병렬. UI(Phase 4)는 해당 API route 완료 시 순차.

---

## 완료 기준 (Definition of Done)

완료 기준은 PR merge 시 충족되어야 한다.

- [x] Classify workflow UI/API/domain/schema surface 구현
- [x] classify.generate/view 권한 추가
- [x] classify audit actions enum/type/schema 동기화
- [x] FDA/EU MDR/MFDS/NMPA/PMDA 분류 로직 단위 테스트
- [x] RAG 규칙 검색 citation 포함 분류 결과 테스트
- [x] 5개 관할권 비교표 렌더 단위 테스트
- [x] AI/ML SaMD 라우팅 분기 테스트
- [x] BFF route source-level permission/audit tests
- [x] 3초 SLA E2E 타이밍 테스트
- [x] 90% 정확도 classification eval suite
- [x] LSP/type/lint/format gate 통과
- [x] GitHub Actions CI, E2E Tests, Security Scan, Deploy 통과

검증 명령:

```bash
corepack pnpm typecheck
corepack pnpm exec biome check .
corepack pnpm run lint:hex
corepack pnpm test
SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build
```

---

## 이슈 참조

- Issue #59 (classification wizard)
- SPEC-REGULA-CLASSIFY-001 (본 SPEC)
- SPEC-REGULA-PREDICATE-001 (predicate search 연계)
- SPEC-REGULA-STANDARDS-001 (표준 매핑 연계)
- SPEC-REGULA-SAMD-001 (AI/ML SaMD 경로)
- #37 Submission Lifecycle (자동 연계)
