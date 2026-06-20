# SPEC-REGULA-RISK-001 — Implementation Tasks

> design.md 기반 TDD 단위 작업 분해. RED-GREEN-REFACTOR 사이클로 진행.
> 각 작업은 테스트 우선. 코드 식별자 영문, 설명 한국어.
> 우선순위: P(High/Medium/Low). 시간 추정 금지 — 순서만 명시.

---

## Phase 0: 기반 (DB + 권한 + 감사) — Priority High

선행: 다른 모든 Phase의 전제. CER Builder child-table 패턴 재사용.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T0.1 | enum 확장 (workflowType 'risk', riskLevel, controlTier) | `lib/db/schema.ts` | 005,012,021 | schema 타입 컴파일 + enum 값 단위 테스트 |
| T0.2 | auditActionEnum에 risk.* 7종 추가 | `lib/db/schema.ts` | 007,010,020,029,035,031 | enum 값 존재 단위 테스트 |
| T0.3 | risk_items 테이블 정의 | `lib/db/schema.ts` | 006,002,004 | insert/select drizzle 통합 테스트 |
| T0.4 | risk_controls 테이블 정의 | `lib/db/schema.ts` | 021,023,024,026,027 | FK cascade 통합 테스트 |
| T0.5 | risk_gspr_mappings 테이블 정의 | `lib/db/schema.ts` | 032 | insert/select 통합 테스트 |
| T0.6 | RLS 정책 (workflow_runs org 격리 상속) | migration SQL | — | 타 org 접근 차단 통합 테스트 |
| T0.7 | 마이그레이션 생성·검토 | `lib/db/migrations/00xx_*.sql` | — | migration up/down 검증 |
| T0.8 | 권한 risk.generate/view/update/approve 추가 | `lib/auth/permissions.ts` | 036 | role→permission 매핑 단위 테스트 (approve=ra-lead only) |

## Phase 1: 도메인 로직 (lib/risk/*) — Priority High

순수 함수 우선 (의존성 적음). RAG 함수는 createHybridRaFetch mocking.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T1.1 | DEFAULT_RISK_MATRIX 정의 (5×5) | `lib/risk/risk-matrix.ts` | 012 | research.md §2.1 매트릭스 일치 단위 테스트 |
| T1.2 | evaluateRiskLevel(severity,prob,matrix) | `lib/risk/risk-evaluation.ts` | 012,013 | 25셀 전수 + 조직 override 단위 테스트 |
| T1.3 | validateScale (1~5 범위 검증) | `lib/risk/risk-evaluation.ts` | 018 | 경계값 0/6 reject 단위 테스트 |
| T1.4 | requiresControl (ALARP/UNACC 판정) | `lib/risk/risk-evaluation.ts` | 014 | acc/alarp/unacc 분기 단위 테스트 |
| T1.5 | evaluateResidualRisk | `lib/risk/residual-risk.ts` | 024,025 | 잔류 재산정 + further-action 플래그 단위 테스트 |
| T1.6 | buildHazardPrompt (ISO 14971 용어 구조화) | `lib/risk/hazard-identification.ts` | 006 | 프롬프트에 hazard/sequence/situation/harm 포함 검증 |
| T1.7 | parseHazardResponse (citation 필수, confidence 플래그) | `lib/risk/hazard-identification.ts` | 002,004 | citation 누락 항목 reject + lowConfidence 단위 테스트 |
| T1.8 | identifyHazards (RAG 호출, deviceClass filter) | `lib/risk/hazard-identification.ts` | 001,005 | mock RAG로 filter 전달·결과 매핑 단위 테스트 |
| T1.9 | recommendControls (3계층 RAG) | `lib/risk/control-recommendation.ts` | 021,022 | 3계층 후보 + 빈 결과 fallback 단위 테스트 |
| T1.10 | validateControlHierarchy (info-only skip 사유) | `lib/risk/control-recommendation.ts` | 023 | info-only 채택 시 사유 강제 단위 테스트 |

## Phase 2: BFF API Routes — Priority High

withPermission + createHybridRaFetch 패턴. checklists/generate route 참조.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T2.1 | POST /risk/runs (run 생성) | `app/api/ra/risk/runs/route.ts` | — | 권한·생성 통합 테스트 |
| T2.2 | GET /risk/runs/[id] (aggregate 조회) | `app/api/ra/risk/runs/[id]/route.ts` | — | items+controls+mappings 조립 테스트 |
| T2.3 | POST /risk/identify (+ audit) | `app/api/ra/risk/identify/route.ts` | 001,002,004,010 | RAG mock + audit 기록 통합 테스트 |
| T2.4 | PATCH/DELETE /risk/items/[id] (+ audit) | `app/api/ra/risk/items/[id]/route.ts` | 007,020 | 수정·삭제 audit 통합 테스트 |
| T2.5 | POST /risk/items/[id]/evaluate | `app/api/ra/risk/items/[id]/evaluate/route.ts` | 012,015 | 분류 + ALARP 사유 검증 테스트 |
| T2.6 | POST /risk/controls/recommend | `app/api/ra/risk/controls/recommend/route.ts` | 021,028 | 3계층 + 빈 fallback 테스트 |
| T2.7 | PATCH /risk/controls/[id] (+ audit) | `app/api/ra/risk/controls/[id]/route.ts` | 024,025,029 | 채택·잔류 위험 audit 테스트 |
| T2.8 | POST /risk/runs/[id]/gspr | `app/api/ra/risk/runs/[id]/gspr/route.ts` | 032 | 매핑 생성 통합 테스트 |
| T2.9 | POST /risk/runs/[id]/export | `app/api/ra/risk/runs/[id]/export/route.ts` | 031,033,034 | DOCX 생성 + 워터마크 분기 테스트 |
| T2.10 | POST /risk/runs/[id]/approve (gate) | `app/api/ra/risk/runs/[id]/approve/route.ts` | 003,035,036 | RA-lead 승인 + 비-RA-lead 403 테스트 |

## Phase 3: 보고서 생성 (report-builder) — Priority High

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T3.1 | buildRiskReport DOCX 섹션 구조 (ISO 14971) | `lib/risk/report-builder.ts` | 031 | 7섹션 존재 + 구조 단위 테스트 |
| T3.2 | GSPR 매핑 테이블 렌더 | `lib/risk/report-builder.ts` | 032 | 매핑 행 렌더 단위 테스트 |
| T3.3 | 모든 항목 citation 표기 | `lib/risk/report-builder.ts` | 033 | citation 누락 시 검증 실패 테스트 |
| T3.4 | DRAFT 워터마크 (미승인) | `lib/risk/report-builder.ts` | 034 | 미승인 run 워터마크 존재 테스트 |

## Phase 4: UI Components — Priority Medium

선행: Phase 2 API. TanStack Query 훅 + 컴포넌트. CitationBadge 재사용.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T4.1 | Query 훅 (useRiskRun 등) | `components/risk/hooks.ts` | — | 훅 fetch·캐시 단위 테스트 |
| T4.2 | RiskWizard (4단계 stepper, 순서 강제) | `components/risk/RiskWizard.tsx` | 008,014,019 | 단계 잠금 RTL 테스트 |
| T4.3 | HazardIdentificationStep | `components/risk/HazardIdentificationStep.tsx` | 001,007,009 | 생성·편집·citation 클릭 RTL 테스트 |
| T4.4 | RiskMatrix + RiskMatrixCell (색상/배지) | `components/risk/RiskMatrix.tsx` | 011,016,017 | 색상 코딩·셀 카운트 RTL 테스트 |
| T4.5 | RiskAnalysisStep (sev/prob + ALARP) | `components/risk/RiskAnalysisStep.tsx` | 012,015 | ALARP 사유 강제 RTL 테스트 |
| T4.6 | ControlRecommendationStep (3계층 + manual) | `components/risk/ControlRecommendationStep.tsx` | 021,023,028 | 계층 표시·manual fallback RTL 테스트 |
| T4.7 | ResidualRiskPanel (재산정 + 신규 위험) | `components/risk/ResidualRiskPanel.tsx` | 024,025,027 | 잔류 재계산·신규 위험 체크 RTL 테스트 |
| T4.8 | GsprMappingStep | `components/risk/GsprMappingStep.tsx` | 032 | 매핑 편집 RTL 테스트 |
| T4.9 | RiskReportStep + ExpertReviewGate | `components/risk/RiskReportStep.tsx`, `ExpertReviewGate.tsx` | 003,030,034,036 | 권한 분기·draft 배지 RTL 테스트 |
| T4.10 | 페이지 (목록 + 위저드 라우트) | `app/(app)/workflows/risk/page.tsx`, `[runId]/page.tsx` | — | 라우팅·렌더 smoke 테스트 |

## Phase 5: Eval + E2E — Priority Medium

| # | 작업 | 산출물 | REQ/AC | 테스트 |
|---|------|--------|--------|--------|
| T5.1 | promptfoo risk-identification suite | `evals/risk/risk-identification.yaml` | AC7 | 인슐린펌프·인공호흡기 >85% |
| T5.2 | E2E 위험관리 전체 플로우 | `e2e/risk.spec.ts` | AC1~AC6 | 식별→분석→통제→승인→export Playwright |
| T5.3 | E2E 권한 게이트 (비-RA-lead 승인 차단) | `e2e/risk-rbac.spec.ts` | 036 | 403 검증 |

## 의존 그래프

```
Phase 0 (DB/권한/감사)
   ├──> Phase 1 (도메인 로직)
   │       └──> Phase 2 (API) ──> Phase 4 (UI)
   │                          └──> Phase 3 (보고서) ──┘
   └──> Phase 5 (Eval/E2E, 최종)
```

병렬 가능: Phase 1 도메인 순수 함수(T1.1~T1.5)는 Phase 0 완료 후 즉시 병렬. UI(Phase 4)는 해당 API route 완료 시 순차.

## 완료 기준 (Definition of Done)

완료 기준은 PR #195 merge와 후속 `8065cc8 fix(ci): restore gates after risk workflow merge` 기준으로 충족되었다.

- [x] Risk workflow UI/API/domain/schema surface 구현
- [x] risk.generate/view/update/approve 권한 추가, `risk.approve` RA-lead only 검증
- [x] risk audit actions enum/type/schema 동기화
- [x] severity/probability scale validation 및 matrix classification 단위 테스트
- [x] control hierarchy rationale guard 테스트
- [x] residual risk ALARP justification 테스트
- [x] DOCX report builder smoke tests
- [x] BFF route source-level permission/audit tests
- [x] LSP/type/lint/format gate 통과
- [x] GitHub Actions `CI`, `E2E Tests`, `Security Scan`, `Deploy` 통과

검증 명령:

```bash
corepack pnpm typecheck
corepack pnpm exec biome check .
corepack pnpm run lint:hex
corepack pnpm test
SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build
```
