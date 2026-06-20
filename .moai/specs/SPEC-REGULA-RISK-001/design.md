# SPEC-REGULA-RISK-001 — System Design

> spec.md의 36 REQ를 구현하기 위한 시스템 설계 (HOW). DB schema, API routes, UI components, 도메인 로직, RAG 파이프라인.
> 코드 식별자는 영문, 설명은 한국어. 기존 CER Builder 패턴을 확장한다.

---

## 1. 아키텍처 개요

```
[브라우저: app/(app)/workflows/risk/]
   │  TanStack Query
   ▼
[BFF: app/api/ra/risk/*]  ── withPermission(risk.*)
   │  서버 전용
   ├──> [도메인 로직: lib/risk/*]
   │       ├─ hazard-identification.ts  ─┐
   │       ├─ risk-evaluation.ts          │ createHybridRaFetch
   │       ├─ control-recommendation.ts ─┤ POST /rag/query
   │       ├─ residual-risk.ts            │
   │       └─ report-builder.ts (docx)   ─┘
   ├──> [DB: Drizzle ORM]
   │       workflow_runs (type='risk')
   │       ├─ risk_items
   │       ├─ risk_controls
   │       └─ risk_gspr_mappings
   │       expert_reviews / audit_logs
   └──> [hybrid-ra-saas RAG] (Bearer auth, server-side)
```

설계 원칙: CER Builder(SPEC-REGULA-CER-001) 패턴 그대로 재사용 — `workflow_runs`를 spine으로, child 테이블을 cascade FK로, expert review gate로 RA-lead 승인, audit_logs append-only.

---

## 2. DB Schema (Drizzle ORM)

### 2.1 enum 확장

```typescript
// lib/db/schema.ts — workflowTypeEnum에 'risk' 추가
export const workflowTypeEnum = pgEnum('workflow_type', [
  'submission_drafter', 'audit_response', 'indication_impact',
  'predicate_comparison', 'cer', 'pccp', 'vigilance',
  'risk', // ← 신규
]);

// auditActionEnum에 risk 액션 추가
// 'risk.identify.generate', 'risk.item.edit', 'risk.analysis.update',
// 'risk.control.decide', 'risk.approve', 'risk.export'

// 신규 enum: 위험도 수준
export const riskLevelEnum = pgEnum('risk_level', [
  'acceptable', 'alarp', 'unacceptable',
]);

// 신규 enum: 통제 옵션 계층 (ISO 14971 §7.1)
export const controlTierEnum = pgEnum('control_tier', [
  'inherent_safety',   // 본질적 안전 설계 (최우선)
  'protective_measure', // 보호 조치
  'information_safety', // 안전 정보 제공 (최후)
]);
```

### 2.2 risk_items 테이블 (Group A, B)

```typescript
export const riskItems = pgTable('risk_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowRunId: uuid('workflow_run_id')
    .notNull()
    .references(() => workflowRuns.id, { onDelete: 'cascade' }),
  // ISO 14971 §3 구조화 (REQ-RISK-006)
  hazard: text('hazard').notNull(),
  sequenceOfEvents: text('sequence_of_events'),
  hazardousSituation: text('hazardous_situation'),
  harm: text('harm').notNull(),
  // 초기 추정 (Group B)
  severity: integer('severity'),       // 1~5
  probability: integer('probability'),  // 1~5
  riskLevel: riskLevelEnum('risk_level'),
  acceptabilityJustification: text('acceptability_justification'), // ALARP/허용 근거 (REQ-RISK-015)
  // 출처 (REQ-RISK-002): RagCitation[] 구조 저장
  citations: jsonb('citations').$type<RiskCitation[]>().notNull().default([]),
  ragConfidence: numeric('rag_confidence', { precision: 3, scale: 2 }),
  lowConfidence: boolean('low_confidence').notNull().default(false), // REQ-RISK-004
  source: text('source').notNull().default('rag'), // 'rag' | 'manual'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  runIdx: index('risk_items_run_idx').on(t.workflowRunId),
}));

export type RiskCitation = {
  kind: 'standard_clause' | 'adverse_event';
  sourceId: string;     // RagCitation.source_id 또는 표준 조항 ID
  title: string;
  excerpt: string;
  score: number;
};
```

### 2.3 risk_controls 테이블 (Group C)

```typescript
export const riskControls = pgTable('risk_controls', {
  id: uuid('id').defaultRandom().primaryKey(),
  riskItemId: uuid('risk_item_id')
    .notNull()
    .references(() => riskItems.id, { onDelete: 'cascade' }), // REQ-RISK-026 traceability
  tier: controlTierEnum('tier').notNull(), // REQ-RISK-021
  description: text('description').notNull(),
  adopted: boolean('adopted').notNull().default(false),
  // information-only 채택 시 상위 계층 미적용 사유 (REQ-RISK-023)
  higherTierSkipJustification: text('higher_tier_skip_justification'),
  // 통제 후 잔류 위험 (REQ-RISK-024)
  residualSeverity: integer('residual_severity'),
  residualProbability: integer('residual_probability'),
  residualRiskLevel: riskLevelEnum('residual_risk_level'),
  // 잔류 unacceptable 시 추가근거 (REQ-RISK-025)
  riskBenefitJustification: text('risk_benefit_justification'),
  introducesNewRisk: boolean('introduces_new_risk').notNull().default(false), // REQ-RISK-027
  citations: jsonb('citations').$type<RiskCitation[]>().notNull().default([]), // REQ-RISK-022
  decisionReason: text('decision_reason'), // 채택/거부 사유 (REQ-RISK-029)
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  itemIdx: index('risk_controls_item_idx').on(t.riskItemId),
}));
```

### 2.4 risk_gspr_mappings 테이블 (Group D)

```typescript
export const riskGsprMappings = pgTable('risk_gspr_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowRunId: uuid('workflow_run_id')
    .notNull()
    .references(() => workflowRuns.id, { onDelete: 'cascade' }),
  riskItemId: uuid('risk_item_id').references(() => riskItems.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').references(() => riskControls.id, { onDelete: 'set null' }),
  gsprClause: text('gspr_clause').notNull(), // 예: 'Annex I §4'
  justification: text('justification').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  runIdx: index('risk_gspr_run_idx').on(t.workflowRunId),
}));
```

### 2.5 RLS 정책

기존 `workflow_runs` RLS 패턴 상속: child 테이블은 부모 `workflow_runs`의 `organization_id` 기준 멀티테넌트 격리. CER Builder child 테이블 정책과 동일.

### 2.6 마이그레이션

`lib/db/migrations/`의 다음 번호 파일: enum 3종 추가/확장 + 테이블 3종 생성 + RLS 정책 + audit action enum 확장. `drizzle-kit generate` 후 수동 검토 (메모리상 drizzle-kit 버그 주의 — E2E env 메모 참조).

---

## 3. API Routes (BFF)

`app/api/ra/risk/` 하위. 모두 `withPermission`으로 감싸고, RAG 호출은 `createHybridRaFetch` 사용. 패턴은 `app/api/ra/checklists/generate/route.ts`와 동일.

| Route | Method | Permission | REQ | 설명 |
|-------|--------|-----------|-----|------|
| `/api/ra/risk/runs` | POST | `risk.generate` | — | 위험관리 run 생성 (workflow_runs, type='risk') |
| `/api/ra/risk/runs/[id]` | GET | `risk.view` | — | run + items + controls + mappings 조회 |
| `/api/ra/risk/identify` | POST | `risk.generate` | 001,002,004,010 | 기기 설명 → RAG 위험 식별 생성 |
| `/api/ra/risk/items/[id]` | PATCH | `risk.update` | 007,020 | 위험 항목 수정 (severity/prob 등) + audit |
| `/api/ra/risk/items/[id]` | DELETE | `risk.update` | 007 | 위험 항목 삭제 + audit |
| `/api/ra/risk/items/[id]/evaluate` | POST | `risk.update` | 012,013,015 | severity×prob → 위험도 분류 + ALARP |
| `/api/ra/risk/controls/recommend` | POST | `risk.update` | 021,022,028 | 통제 조치 추천 (3계층 + RAG) |
| `/api/ra/risk/controls/[id]` | PATCH | `risk.update` | 024,025,029 | 통제 채택/잔류 위험 + audit |
| `/api/ra/risk/runs/[id]/gspr` | POST | `risk.update` | 032 | GSPR 매핑 생성/수정 |
| `/api/ra/risk/runs/[id]/export` | POST | `risk.view` | 031,033,034 | ISO 14971 DOCX export (워터마크 분기) |
| `/api/ra/risk/runs/[id]/approve` | POST | `risk.approve` | 003,035,036 | RA-lead 승인 (gate) |

권한 매핑 (`lib/auth/permissions.ts` 확장):
- `risk.generate` → ra-lead, ra-member
- `risk.view` → ra-lead, ra-member, viewer
- `risk.update` → ra-lead, ra-member
- `risk.approve` → **ra-lead only** (REQ-RISK-036)

---

## 4. 도메인 로직 (lib/risk/*)

### 4.1 hazard-identification.ts (Group A)

```typescript
// 기기 설명 → RAG 위험 식별
export async function identifyHazards(input: {
  deviceDescription: string;
  deviceClass?: string;  // REQ-RISK-005 filter
}): Promise<{ items: NewRiskItem[]; confidence: number }> {
  const ragFetch = createHybridRaFetch();
  const res = await ragFetch('/rag/query', {
    method: 'POST',
    body: JSON.stringify({
      query: buildHazardPrompt(input.deviceDescription),
      top_k: 8,
      filter: input.deviceClass ? { device_class: input.deviceClass } : undefined,
    } satisfies RagQueryRequest),
  });
  const data: RagQueryResponse = await res.json();
  // 응답 파싱 → RiskItem[] (각 항목 citation 필수, REQ-RISK-002)
  // confidence < 0.6 → lowConfidence=true (REQ-RISK-004)
  return parseHazardResponse(data);
}
```

LLM 프롬프트는 ISO 14971 용어(hazard/sequence/situation/harm)로 구조화 출력을 강제하고, 각 항목에 표준 조항 또는 이상사례 citation을 요구한다.

### 4.2 risk-evaluation.ts (Group B)

```typescript
// severity × probability → 위험도 수준 (조직 설정 매트릭스 기반, REQ-RISK-012,013)
export function evaluateRiskLevel(
  severity: number,    // 1~5
  probability: number, // 1~5
  matrix?: RiskAcceptabilityMatrix, // 조직 override
): RiskLevel {
  validateScale(severity); validateScale(probability); // REQ-RISK-018
  return (matrix ?? DEFAULT_RISK_MATRIX)[severity - 1][probability - 1];
}

export const DEFAULT_RISK_MATRIX: RiskLevel[][] = /* research.md §2.1 5×5 */;
```

### 4.3 control-recommendation.ts (Group C)

```typescript
// ISO 14971 §7.1 3계층 통제 추천 + RAG 유사 사례
export async function recommendControls(riskItem: RiskItem): Promise<{
  inherent_safety: ControlCandidate[];
  protective_measure: ControlCandidate[];
  information_safety: ControlCandidate[];
}> {
  const ragFetch = createHybridRaFetch();
  const res = await ragFetch('/rag/query', { /* 유사 기기 통제 사례 query */ });
  // 3계층 각각 ≥1 후보 시도, 전부 0개면 빈 결과 → API에서 manual fallback (REQ-RISK-028)
}
```

### 4.4 residual-risk.ts (Group C)

```typescript
// 통제 후 잔류 위험 재산정 (REQ-RISK-024,025)
export function evaluateResidualRisk(input: {
  residualSeverity: number; residualProbability: number;
  matrix?: RiskAcceptabilityMatrix;
}): { level: RiskLevel; requiresFurtherAction: boolean };
```

### 4.5 report-builder.ts (Group D)

```typescript
// ISO 14971 구조 DOCX 생성 (docx@^9.7.1, REQ-RISK-031,032,033,034)
export async function buildRiskReport(run: RiskRunAggregate): Promise<Buffer> {
  // 섹션: 1.위험관리 계획 2.위험 분석 3.위험 평가 4.위험 통제
  //       5.전체 잔류 위험 6.GSPR 매핑 테이블 7.결론
  // 미승인 run → "DRAFT — Not Approved" 워터마크 (REQ-RISK-034)
  // 모든 위험 항목 citation 표기 (REQ-RISK-033)
}
```

---

## 5. UI Components

`app/(app)/workflows/risk/`에 위저드 + `components/risk/`에 재사용 컴포넌트.

### 5.1 페이지 구조

```
app/(app)/workflows/risk/
├── page.tsx                  # 위험관리 run 목록 + 신규 생성
├── [runId]/
│   └── page.tsx              # 4단계 위저드 (식별→분석→통제→보고서)
```

### 5.2 컴포넌트

| 컴포넌트 | REQ | 설명 |
|----------|-----|------|
| `RiskWizard.tsx` | 008,014,019 | 4단계 stepper, 단계 순서 강제 |
| `HazardIdentificationStep.tsx` | 001,007,009 | 기기 설명 입력 + 생성 + 항목 편집 + citation 표시 |
| `RiskMatrix.tsx` | 011,016,017 | 5×5 grid, 색상 코딩, 셀 배지 |
| `RiskMatrixCell.tsx` | 012,016 | 셀 (위험도 색상 + 항목 수) |
| `RiskAnalysisStep.tsx` | 012,015,019 | severity/prob 선택 + ALARP justification |
| `ControlRecommendationStep.tsx` | 021,023,028 | 3계층 통제 후보 + 채택 + manual fallback |
| `ResidualRiskPanel.tsx` | 024,025,027 | 잔류 위험 재산정 + 신규 위험 확인 |
| `GsprMappingStep.tsx` | 032 | GSPR 매핑 테이블 편집 |
| `RiskReportStep.tsx` | 031,034 | export 버튼 (draft 워터마크 안내) |
| `ExpertReviewGate.tsx` | 003,034,035,036 | RA-lead 승인 버튼 (권한 분기) |
| `CitationBadge.tsx` | 009,033 | 클릭 가능 citation (CER Builder 재사용) |

TanStack Query 훅: `useRiskRun(runId)`, `useIdentifyHazards()`, `useEvaluateRisk()`, `useRecommendControls()`, `useApproveRiskRun()`.

### 5.3 expert review gate UI 로직

- run.status !== 'approved' → 모든 단계 결과 "provisional/draft" 배지 (REQ-RISK-019,030)
- 승인 버튼은 `usePermission('risk.approve')` true (RA-lead)일 때만 활성 (REQ-RISK-036)
- 미검토 항목 존재 시 승인 버튼 disabled + 안내 (REQ-RISK-003)

---

## 6. RAG 파이프라인

```
기기 설명/위험 항목
   │
   ▼ buildPrompt() — ISO 14971 용어 구조화 + citation 요구
createHybridRaFetch('/rag/query', { query, top_k, filter })
   │  (Bearer auth, server-side only)
   ▼
RagQueryResponse { answer, citations[], confidence }
   │
   ▼ parse — RiskItem[] / ControlCandidate[]
   │  citation 매핑 (RagCitation → RiskCitation)
   │  confidence<0.6 → lowConfidence 플래그
   ▼
DB 저장 + audit_logs(risk.identify.generate, confidence)
```

graceful degradation: RAG 실패/빈 응답 → manual 입력 fallback (REQ-RISK-028). HybridRaClientError는 BFF에서 statusCode 그대로 반환.

---

## 7. 감사 추적 (audit_logs)

모든 위험 판단·변경은 append-only audit_logs 기록 (21 CFR Part 11). 신규 action: `risk.identify.generate`, `risk.item.edit`, `risk.analysis.update`, `risk.control.decide`, `risk.approve`, `risk.export`. metaJson에 변경 전/후, confidence, 사유 포함.

---

## 8. promptfoo Eval (Group G7)

`evals/risk/` (또는 기존 promptfoo 디렉터리 컨벤션 따름):
- `risk-identification.yaml`: 인슐린 펌프·인공호흡기 기기 설명 → 생성 위험 목록을 ground truth(research.md §4)와 비교, hazard recall + 통제 계층 적합성 측정
- pass threshold: 정확도 >85% (AC7)
- assertion: 알려진 critical hazard 포함 여부, 통제 계층 우선순위 준수, citation 존재
