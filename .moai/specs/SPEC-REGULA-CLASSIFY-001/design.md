# SPEC-REGULA-CLASSIFY-001 — Implementation Design

> DDD ANALYZE phase 기반 설계 문서. 기존 코드베이스 통합 패턴 분석 완료.
> 모든 설계 결정은 RISK-001, PCCP-001, CER-001 구현 패턴 기반 재사용.

---

## 1. Data Model

### 1.1 Core Tables

#### device_classifications (분류 결과 저장)

```sql
CREATE TABLE device_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  
  -- 입력 파라미터 (REQ-001~004)
  intended_use TEXT NOT NULL,
  body_contact_type TEXT NOT NULL, -- 'non-contact' | 'surface-contact' | 'internal-contact' | 'implantable'
  device_type JSONB NOT NULL, -- { active: boolean, software: boolean, hardware: boolean }
  has_ai_component BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- FDA 분류 결과 (REQ-005~008)
  fda_class TEXT, -- 'Class I' | 'Class II' | 'Class III'
  fda_path TEXT, -- 'Exempt' | '510(k)' | 'PMA' | 'De Novo'
  fda_product_code TEXT,
  fda_regulation_number TEXT, -- 21 CFR § reference
  fda_predicates JSONB, -- 초기 predicate 목록 (Product Code DB 기반)
  
  -- EU MDR 분류 결과 (REQ-009~011)
  eu_class TEXT, -- 'Class I' | 'Class IIa' | 'Class IIb' | 'Class III'
  eu_rule_numbers TEXT[], -- Annex VIII Rule 번호 (예: ['Rule 5', 'Rule 12'])
  eu_mdr_vs_ivdr TEXT, -- 'MDR' | 'IVDR'
  eu_notified_body_required BOOLEAN NOT NULL,
  
  -- MFDS 분류 결과 (REQ-012)
  mfds_grade TEXT, -- '1등급' | '2등급' | '3등급' | '4등급'
  mfds_equivalent_path TEXT, -- '등가심사' | NULL
  
  -- NMPA 분류 결과 (REQ-012)
  nmpa_grade TEXT, -- '1등급' | '2등급' | '3등급'
  nmpa_equivalent_path TEXT, -- '비교 인증' | NULL
  
  -- PMDA 분류 결과 (REQ-012)
  pmda_class TEXT, -- 'Class I' | 'Class II' | 'Class III' | 'Class IV'
  pmda_equivalent_path TEXT, -- NULL (일본은 동등 심사 없음)
  
  -- 통합 메타데이터
  classification_confidence NUMERIC(3,2), -- 전체 신뢰도 (0.00~1.00)
  citations JSONB NOT NULL, -- 분류 근거 문서 (source_sections 참조)
  next_steps JSONB, -- 후속 워크플로우 제안 (predicate_search, cer_builder, etc.)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (org 격리 상속)
ALTER TABLE device_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_classifications_org_isolation ON device_classifications
  FOR ALL USING (org_id = current_setting('app.current_org_id')::UUID);
```

**Rationale**: 
- `workflow_run_id` FK로 기존 workflow_runs 패턴 준수 (RISK-001 재사용)
- 관할권별 결과 컬럼 분리 → ComparisonTable 블록 렌더 용이
- `citations` JSONB → source_sections 참조로 근거 문서 추적
- `next_steps` JSONB → #22 Predicate Search, #23 CER Builder, #40 Strategy Generator 자동 연계

#### classification_rules (관할권별 분류 규칙)

```sql
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL, -- 'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA'
  rule_type TEXT NOT NULL, -- 'classification_tree' | 'product_code' | 'annex_viii_rule' | 'grade_code'
  rule_key TEXT NOT NULL, -- 규칙 고유 키 (예: 'EU_MDR_Rule_5')
  rule_value JSONB NOT NULL, -- 규칙 데이터 (조건, 결과, 메타데이터)
  version TEXT NOT NULL, -- 규칙 버전 (예: '2024-03')
  source_citation TEXT, -- 근거 문서 (21 CFR §, MDR Annex VIII, etc.)
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classification_rules_jurisdiction ON classification_rules(jurisdiction, rule_type);
```

**Rationale**: 
- 버전 관리 지원 → 규제 개정 추적 (SPEC-REGULA-STANDARDS-001 연계)
- RAG retrieval 경로 → jurisdiction + rule_type 기반 검색

#### product_code_index (FDA Product Code 인덱스)

```sql
CREATE TABLE product_code_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE, -- 'HGL', 'NAW', etc.
  device_name TEXT NOT NULL,
  fda_class TEXT NOT NULL, -- 'Class I' | 'Class II' | 'Class III'
  regulation_number TEXT, -- '21 CFR 862.1325'
  panel TEXT, -- 'Radiology'
  description TEXT,
  predicates JSONB, -- 초기 predicate 목록 (K number 기반)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_code_index_name ON product_code_index(device_name);
CREATE INDEX idx_product_code_index_class ON product_code_index(fda_class);
```

**Rationale**: 
- CDRH Product Code Database 복제본 → 분류 엔진 조회용
- `predicates` JSONB → #22 Predicate Search 진입점 제공 (REQ-008)

### 1.2 Enums

```typescript
// lib/db/schema.ts 추가

export const bodyContactTypeEnum = pgEnum('body_contact_type', [
  'non-contact',
  'surface-contact',
  'internal-contact',
  'implantable',
]);

export const fdaClassEnum = pgEnum('fda_class', [
  'Class I',
  'Class II',
  'Class III',
]);

export const fdaPathEnum = pgEnum('fda_path', [
  'Exempt',
  '510(k)',
  'PMA',
  'De Novo',
]);

export const euClassEnum = pgEnum('eu_class', [
  'Class I',
  'Class IIa',
  'Class IIb',
  'Class III',
]);

export const mfdsGradeEnum = pgEnum('mfds_grade', [
  '1등급',
  '2등급',
  '3등급',
  '4등급',
]);

export const nmpaGradeEnum = pgEnum('nmpa_grade', [
  '1등급',
  '2등급',
  '3등급',
]);

export const pmdaClassEnum = pgEnum('pmda_class', [
  'Class I',
  'Class II',
  'Class III',
  'Class IV',
]);
```

**Migration**: `0067_classify_001_enums.sql`

### 1.3 Migration Files

- `0067_classify_001_enums.sql` — 6개 pgEnum 생성 (bodyContact, fdaClass, fdaPath, euClass, mfdsGrade, nmpaGrade, pmdaClass)
- `0067_classify_002_workflow_type.sql` — workflowType enum에 'classify' 추가
- `0067_classify_003_audit_actions.sql` — auditAction enum에 classify.* 3종 추가
- `0067_classify_004_tables.sql` — device_classifications, classification_rules, product_code_index 테이블 생성
- `0067_classify_005_rls.sql` — RLS 정책 (org 격리)

**Count-Assertion Regression**: 
- `tests/unit/enterprise-migrations.test.ts` — 0067 describe block 추가

---

## 2. Classification Flow

### 2.1 End-to-End Pipeline

```
User Input (Device Description + Parameters)
    ↓
T1.1: parseDeviceIntent (Haiku)
    ↓ [Device Characteristics Extracted]
┌─────────────────────────────────────────────────────────────┐
│ Parallel Classification Engines (T1.2~T1.9)                │
├─────────────────────────────────────────────────────────────┤
│ FDA: classifyFDA → Product Code DB lookup → Class + Path    │
│ EU: classifyEuMDR → Annex VIII Rule tree → Class + NB       │
│ Asia: classifyAsia → Grade code map → Class + Equiv. Path   │
└─────────────────────────────────────────────────────────────┘
    ↓ [Raw Classification Results]
T2.1: perJurisdictionRuleRetriever (RAG)
    ↓ [Rule Citations Added]
T2.4: classifyWithRAG (Aggregator)
    ↓ [Classification Result + Rationale + Next Steps]
T3.1: POST /classify/runs (Persist + Audit)
    ↓
T4.4: ClassificationResultStep (ComparisonTable Render)
```

### 2.2 FDA Classification (REQ-005~008)

**Approach**: Deterministic Rule-Based + Product Code DB Lookup

```typescript
// lib/classify/engines/fda.ts

export async function classifyFDA(
  deviceCharacteristics: DeviceCharacteristics
): Promise<FDAResult> {
  // Step 1: Product Code DB 검색 (device_name, intended_use)
  const productCodes = await searchProductCodeIndex(deviceCharacteristics);
  
  // Step 2: Class 결정 (Product Code의 fda_class)
  const fdaClass = productCodes[0]?.fdaClass || determineClassByRisk(deviceCharacteristics);
  
  // Step 3: Path 결정 (Class 기본 경로 + 특수 조건)
  let fdaPath = determineDefaultPath(fdaClass); // Exempt (I), 510(k) (II), PMA (III)
  
  // Step 4: De Novo 식별 (T1.3)
  if (await identifyDeNovoPath(deviceCharacteristics)) {
    fdaPath = 'De Novo';
  }
  
  // Step 5: Predicate 생성 (T1.4)
  const predicates = await generatePredicatesList(productCodes);
  
  return {
    fdaClass,
    fdaPath,
    productCode: productCodes[0]?.productCode,
    regulationNumber: productCodes[0]?.regulationNumber,
    predicates,
  };
}
```

**Rationale**: 
- Product Code DB는 정적 데이터 → 결정론적 조회 가능
- De Novo 경로는 특수 조건 (new technology, low-risk) → 별도 함수 분리 (T1.3)
- Predicates는 #22 Predicate Search 진입점 → K number 기반 초기 목록

### 2.3 EU MDR Classification (REQ-009~011)

**Approach**: Annex VIII Rule Tree Traversal

```typescript
// lib/classify/engines/eu-mdr.ts

export async function classifyEuMDR(
  deviceCharacteristics: DeviceCharacteristics
): Promise<EuMDRResult> {
  // Step 1: Rule 번호 결정 (Annex VIII Rules 1-22)
  const ruleNumbers = traverseAnnexVIIIRuleTree(deviceCharacteristics);
  
  // Step 2: Class 결정 (Rule 기반 Class 매핑)
  const euClass = determineClassByRules(ruleNumbers);
  
  // Step 3: MDR vs IVDR 구분 (T1.6)
  const euMdrVsIvdr = distinguishMDRvsIVDR(deviceCharacteristics);
  
  // Step 4: Notified Body 필요 여부 (T1.7)
  const nbRequired = determineNotifiedBodyRequired(euClass, euMdrVsIvdr);
  
  return {
    euClass,
    ruleNumbers,
    euMdrVsIvdr,
    notifiedBodyRequired: nbRequired,
  };
}

function traverseAnnexVIIIRuleTree(characteristics: DeviceCharacteristics): string[] {
  // Rule 1: Non-invasive devices → Class I (unless sterile/measuring)
  if (characteristics.bodyContact === 'non-contact' && !characteristics.invasive) {
    return ['Rule 1'];
  }
  
  // Rule 5: Invasive devices with respect to body orifices
  if (characteristics.bodyContact === 'internal-contact' && characteristics.transient) {
    return ['Rule 5'];
  }
  
  // Rule 12: Other active therapeutic devices
  if (characteristics.active && characteristics.therapeutic) {
    return ['Rule 12'];
  }
  
  // ... (Rules 1-22 decision tree)
}
```

**Rationale**: 
- Annex VIII Rule 22개는 결정론적 트리 → if-else ladder 구현
- MDR vs IVDR는 기기 용도 기반 구분 (T1.6)
- NB 요건은 Class IIa/IIb/III + MDR → mandatory

### 2.4 Asia Classifications (REQ-012~013)

**Approach**: Grade Code Map + Equivalent Path Detection

```typescript
// lib/classify/engines/asia.ts

export async function classifyAsia(
  deviceCharacteristics: DeviceCharacteristics
): Promise<AsiaResult> {
  // MFDS: 1~4등급 (duration + invasiveness 기반)
  const mfdsGrade = determineMfdsGrade(characteristics);
  const mfdsEquivalent = identifyEquivalentPath('MFDS', mfdsGrade);
  
  // NMPA: 1~3등급 (risk + invasiveness 기반)
  const nmpaGrade = determineNmpaGrade(characteristics);
  const nmpaEquivalent = identifyEquivalentPath('NMPA', nmpaGrade);
  
  // PMDA: Class I~IV (risk + duration 기반)
  const pmdaClass = determinePmdaClass(characteristics);
  
  return {
    mfds: { grade: mfdsGrade, equivalentPath: mfdsEquivalent },
    nmpa: { grade: nmpaGrade, equivalentPath: nmpaEquivalent },
    pmda: { class: pmdaClass, equivalentPath: null }, // 일본은 동등 심사 없음
  };
}
```

**Rationale**: 
- 3개 관할권은 Grade/Class Code Map으로 단순화 → 단일 함수로 통합 (T1.8)
- Equivalent Path는 MFDS(등가심사), NMPA(비교 인증) → 조건별 함수 (T1.9)

### 2.5 RAG Rule Retrieval (REQ-017)

**Approach**: Per-Jurisdiction Retriever + Citation Integration

```typescript
// lib/classify/retrievers/jurisdiction-rules.ts

export async function perJurisdictionRuleRetriever(
  jurisdiction: 'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA',
  classificationResult: ClassificationResult
): Promise<Citation[]> {
  const ruleQueries = buildRuleQueries(jurisdiction, classificationResult);
  
  // internal-docs retriever 패턴 재사용 (lib/ai/retrievers/internal-docs.ts)
  const retriever = new InternalDocsRetriever({
    topK: 5,
    orgId: classificationResult.orgId,
    allowedClasses: ['Regulation', 'Guidance'], // 규제 문서만
  });
  
  const results = await retriever.retrieve(ruleQueries);
  
  // 규칙 매핑 (classification_rules 테이블 참조)
  const citations = results.map((r) => ({
    sourceId: r.documentId,
    sectionId: r.id,
    text: r.content,
    relevanceScore: r.score,
    ruleType: jurisdiction,
  }));
  
  return citations;
}
```

**Rationale**: 
- internal-docs retriever 패턴 재사용 → org isolation, ACL filter 자동 적용
- classification_rules 테이블 → 버전 관리 + RAG retrieval 경로
- Citations은 분류 결과에 포함 → REQ-017 충족

### 2.6 Aggregation (T2.4)

```typescript
// lib/classify/aggregator.ts

export async function classifyWithRAG(
  input: ClassificationInput
): Promise<ClassificationOutput> {
  // Step 1: Parallel classification (T1.2~T1.9)
  const [fda, eu, asia] = await Promise.all([
    classifyFDA(input.characteristics),
    classifyEuMDR(input.characteristics),
    classifyAsia(input.characteristics),
  ]);
  
  // Step 2: RAG retrieval (T2.1)
  const citations = await Promise.all([
    perJurisdictionRuleRetriever('FDA', fda),
    perJurisdictionRuleRetriever('EU_MDR', eu),
    perJurisdictionRuleRetriever('MFDS', asia.mfds),
    perJurisdictionRuleRetriever('NMPA', asia.nmpa),
    perJurisdictionRuleRetriever('PMDA', asia.pmda),
  ]).then((results) => results.flat());
  
  // Step 3: Next steps 생성
  const nextSteps = generateNextSteps(fda, eu, asia);
  
  return {
    jurisdictions: {
      fda,
      eu,
      mfds: asia.mfds,
      nmpa: asia.nmpa,
      pmda: asia.pmda,
    },
    citations,
    nextSteps,
  };
}

function generateNextSteps(...): NextStep[] {
  const steps: NextStep[] = [];
  
  // Predicate Search (#22)
  if (fda.predicates?.length > 0) {
    steps.push({
      workflow: 'predicate_comparison',
      title: 'Predicate Device Search',
      description: `${fda.predicates.length} predicates found for ${fda.productCode}`,
      url: `/workflows/predicate?productCode=${fda.productCode}`,
    });
  }
  
  // CER Builder (#23)
  if (eu.euClass !== 'Class I') {
    steps.push({
      workflow: 'cer',
      title: 'CER Builder',
      description: `Class ${eu.euClass} requires Clinical Evaluation`,
      url: `/workflows/cer?euClass=${eu.euClass}`,
    });
  }
  
  // ... (Risk, Standards Mapping, etc.)
  
  return steps;
}
```

---

## 3. Integration Points

### 3.1 workflow_runs Pattern (RISK-001 재사용)

```typescript
// lib/db/schema.ts — workflowRuns 테이블 (기존)
export const workflowRuns = pgTable('workflow_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  workflowType: workflowTypeEnum('workflow_type').notNull(), // 'classify' 추가 (T0.1)
  status: workflowStatusEnum('status').notNull().default('queued'),
  inputJson: jsonb('input_json').notNull(), // { intendedUse, bodyContact, deviceType, hasAiComponent }
  resultJson: jsonb('result_json').notNull(), // { jurisdictions, citations, nextSteps }
  // ... (다른 필드 기존과 동일)
});
```

**Integration**:
- `workflowType: 'classify'` → RISK-001의 'risk' 패턴 재사용 (T0.1)
- `inputJson` → ClassificationInput Zod schema 검증
- `resultJson` → ClassificationOutput 타입 저장

### 3.2 Permissions (lib/auth/permissions.ts)

```typescript
// lib/auth/permissions.ts 추가

export type PermissionAction =
  // ... (기존 50개 권한)
  | 'classify.generate' // 새 분류 실행
  | 'classify.view'; // 분류 결과 조회
```

**Role Mapping**:
- `ra-lead`: classify.generate + classify.view
- `ra-member`: classify.view
- `viewer`: 없음

**Count-Assertion Regression**: 
- `lib/auth/permissions.ts` — 201 lines → 203 lines (+2 permissions)
- `tests/unit/auth/permissions.test.ts` — Line X: `toHaveLength(50)` → `toHaveLength(52)`
- `tests/regression/foundation.test.ts` — Line Y: `toBe(50)` → `toBe(52)`

### 3.3 Audit Actions (lib/audit.ts)

```typescript
// lib/audit.ts 추가

export type AuditAction =
  // ... (기존 113+ 값)
  | 'device_classified' // 분류 완료 (T3.1)
  | 'classification_exported'; // 분류 보고서 export (T3.3)
```

**Count-Assertion Regression**: 
- `lib/audit.ts` — 120 lines → 122 lines (+2 audit actions)
- `lib/db/schema.ts` auditActionEnum — 113 values → 115 values
- `tests/unit/audit.test.ts` — Line X: `toHaveLength(113)` → `toHaveLength(115)`

### 3.4 RAG Retrievers (lib/ai/retrievers/internal-docs.ts)

**재사용 패턴**: T2.1에서 `InternalDocsRetriever` 활용

```typescript
// lib/classify/retrievers/jurisdiction-rules.ts

import { internalDocsRetrieve } from '../../ai/retrievers/internal-docs';

export async function perJurisdictionRuleRetriever(
  jurisdiction: Jurisdiction,
  result: ClassificationResult
): Promise<Citation[]> {
  const query = buildRuleQuery(jurisdiction, result);
  
  const { results } = await internalDocsRetrieve(query, {
    topK: 5,
    orgId: result.orgId,
    userId: result.userId,
    allowedClasses: ['Regulation', 'Guidance'],
  });
  
  return results.map((r) => ({
    sourceId: r.documentId,
    sectionId: r.id,
    text: r.content,
    score: r.score,
  }));
}
```

**Rationale**: 
- internal-docs retriever는 org isolation, ACL filter, FTS + vector search 이미 구현됨
- classification_rules 테이블 → RAG retrieval 경로 (version 관리)

---

## 4. AC Traceability

| AC# | Criterion | Task Mapping | Verification |
|-----|-----------|--------------|-------------|
| AC-01 | FDA 분류 정확도 90%+ | T1.2, T1.3, T6.1 | evals/classify/fda-classification.yaml |
| AC-02 | 5개 관할권 동시 분류 <3초 | T2.4 (parallel execution), T6.2 | e2e/classify-timing.spec.ts |
| AC-03 | 분류 근거 citation 포함 | T2.1, T2.4, T4.7 | CitationsBlock 렌더 + source_sections 참조 |
| AC-04 | Submission Lifecycle 자동 연계 | T4.8 | SubmissionLifecycleLink 렌더 + #37 라우팅 |
| AC-05 | EU MDR Annex VIII Rules 적용 | T1.5 | classifyEuMDR Rule tree traversal 단위 테스트 |
| AC-06 | AI/ML SaMD 경로 분기 | T5.1, T5.2 | detectAIComponent + routeToSamdPath 단위 테스트 |

---

## 5. Count-Assertion Regression List

### 5.1 Permissions (41 → 43)

**Files to Update**:
- `lib/auth/permissions.ts` — Line X: `toHaveLength(41)` → `toHaveLength(43)`
- `tests/unit/auth/permissions.test.ts` — Line Y: `toHaveLength(41)` → `toHaveLength(43)`
- `tests/regression/foundation.test.ts` — Line Z: `toBe(41)` → `toBe(43)`

**Reason**: +2 permissions (classify.generate, classify.view)

### 5.2 Audit Actions (113 → 115)

**Files to Update**:
- `tests/unit/audit.test.ts` — Line X: `toHaveLength(113)` → `toHaveLength(115)`

**Reason**: +2 audit actions (device_classified, classification_exported)

### 5.3 Enterprise Migrations (+1 describe block)

**Files to Update**:
- `tests/unit/enterprise-migrations.test.ts` — Add `describe('0067_classify_*.sql', () => { ... })`

**Reason**: Migration 0067은 5개 파일 (enums, workflow_type, audit_actions, tables, rls)

### 5.4 Workflow Type Enum (8 → 9)

**Files to Update**:
- `lib/db/schema.ts` — workflowTypeEnum: 'classify' 추가

**Reason**: workflowType enum에 'classify' 추가 (T0.1)

### 5.5 Sidebar Nav (Optional)

**Files to Update**:
- `components/app-shell.test.ts` — Nav assertion 업데이트 (if new nav entry added)

**Reason**: Classify wizard가 사이드바에 진입점 추가되는 경우 (UX 디자인 결정 사항)

---

## 6. Open Questions / Blockers

**Q1: FDA Product Code DB 데이터 소스**
- **Question**: CDRH Product Code Database를 어떻게 import할지? (CSV dump, API, manual seed?)
- **Blocker**: T1.2, T1.4 구현 전 Product Code Index 데이터 필요
- **Decision Required**: 초기 데이터 세트 방식 결정

**Q2: EU MDR Rule 22개 트리 구현 방식**
- **Question**: if-else ladder vs decision table vs external JSON config?
- **Blocker**: T1.5 구현 전 Rule tree 구조 확정
- **Decision Required**: 유지보수성 vs 성능 트레이드오프

**Q3: 5개 관할권 동시 분류 3초 SLA 달성 가능성**
- **Question**: Parallel execution (Promise.all)으로 3초 내 가능한지? 아니면 streaming 응답 필요?
- **Blocker**: T2.4 구현 전 성능 PoC 필요
- **Decision Required**: SLA 달성 불가 시 AC-02 재검토

**Q4: AI/ML SaMD 라우팅 기준**
- **Question**: SPEC-REGULA-SAMD-001과 연계 방식? (직접 라우팅 vs wizard 내 분기)
- **Blocker**: T5.2 구현 전 SaMD SPEC 확인 필요
- **Decision Required**: SaMD SPEC 승인 상태 확인

---

## 7. File Creation Confirmation

**두 계획 파일 생성 완료**:
1. `.moai/specs/SPEC-REGULA-CLASSIFY-001/tasks.md` — 작업 분해 (T0~T6, 38 tasks)
2. `.moai/specs/SPEC-REGULA-CLASSIFY-001/design.md` — 본 파일 (데이터 모델, 흐름, 통합, AC 추적, regression list)

---

## 8. Implementation Notes

### 8.1 Reuse Patterns

**From RISK-001**:
- workflowType enum 추가 (T0.1)
- workflowRuns FK pattern (device_classifications.workflow_run_id)
- audit actions append-only (T0.2)
- permissions RBAC pattern (T0.9)

**From PCCP-001/CER-001**:
- Wizard UI pattern (T4.2~T4.9)
- Report builder pattern (T3.3 export)
- Expert review gate (if applicable)

**From internal-docs retriever**:
- RAG retrieval pattern (T2.1)
- ACL filter via allowedClasses
- org isolation via withTenantScope

### 8.2 Testing Strategy

**Unit Tests (T1, T2)**:
- Pure functions: mock RAG, test classification logic in isolation
- FDA classification: mock Product Code DB, test path determination
- EU MDR: test Rule tree traversal with known edge cases

**Integration Tests (T3)**:
- BFF routes: test permission gates + audit logging
- API contracts: Zod schema validation + error handling

**E2E Tests (T6)**:
- Full classification flow: input → 5 jurisdictions → export
- Timing SLA: 3-second response time validation
- Accuracy eval: promptfoo suite with known device set (insulin pump, ECG, etc.)

### 8.3 Deployment Notes

**Migration Order**:
1. 0067_classify_001_enums.sql (pgEnums)
2. 0067_classify_002_workflow_type.sql (workflowType)
3. 0067_classify_003_audit_actions.sql (audit actions)
4. 0067_classify_004_tables.sql (tables + FKs)
5. 0067_classify_005_rls.sql (RLS policies)

**Rollback Plan**:
- Each migration is reversible (ALTER TYPE ... ADD VALUE IF NOT EXISTS)
- Tables dropped via CASCADE (workflow_runs FK safe)
- Enum values not dropped (PostgreSQL limitation) — acceptable

---

## 9. References

**Internal Specs**:
- SPEC-REGULA-CLASSIFY-001 (본 SPEC)
- SPEC-REGULA-RISK-001 (workflow pattern reference)
- SPEC-REGULA-PREDICATE-001 (predicate search linkage)
- SPEC-REGULA-STANDARDS-001 (standards mapping linkage)
- SPEC-REGULA-SAMD-001 (AI/ML SaMD routing)

**External Regs**:
- 21 CFR 862-892 (Device Classification)
- EU MDR Annex VIII (Rules 1-22)
- MFDS 의료기기 품목 및 품목별 등급에 관한 규정
- NMPA 의료기기 등급 분류
- PMD Act (Japan)

**Code References**:
- `lib/db/schema.ts:151-250` — workflowType enum + workflowRuns table
- `lib/auth/permissions.ts:1-50` — PermissionAction type
- `lib/audit.ts:1-120` — AuditAction type + writeAudit function
- `lib/ai/retrievers/internal-docs.ts:1-80` — InternalDocsRetriever pattern
- `lib/risk/` — Risk workflow domain structure reference
