# SPEC-V3-IMPACT-001: Change Impact 4-Layer Wizard

## Research Document

### 1. 기존 Impact 코드 분석 (SPEC-REGULA-IMPACT-001)

#### 1.1 기존 파일 구조 (lib/impact/)

SPEC-REGULA-IMPACT-001 (v1.0.0, completed, PR #134)에서 구현된 6개 파일:

```
lib/impact/
├── portfolio-scanner.ts    # 포트폴리오 전체 스캔
├── section-mapper.ts       # 규제 섹션 매핑
├── action-queue.ts         # 대응 큐 관리
├── audit-wiring.ts         # 21 CFR Part 11 감사 추적
├── analyzer.ts             # 영향 분석 엔진
└── types.ts                # 도메인 타입 정의
```

**재사용 가능성:**
- `types.ts`: 공통 타입 확장 (ImpactLevel, ActionItemStatus 등 유지)
- `audit-wiring.ts`: 감사 추적 레이어 재사용
- `action-queue.ts`: 액션 아이템 생성 로직 재사용

**보존 필요성:**
- 기존 API 경로 호환성 유지 (`/api/ra/impact`, `/api/admin/radar/impact`)
- 기존 DB 테이블 구조 유지 (regulatory_impact_assessments, impact_action_items)
- 기존 audit action enum 값 유지 (impact.assessment_created, impact.critical_detected, impact.action_item_created)

#### 1.2 기존 DB 테이블 (lib/db/schema.ts)

**regulatory_impact_assessments** (line 1542-1567):
```typescript
{
  id: uuid (PK),
  regulatoryUpdateId: uuid (FK → regulatory_updates.id),
  projectId: uuid (FK → products.id),
  impactLevel: text,  // 'critical' | 'high' | 'medium' | 'info'
  affectedSections: jsonb,
  analysisSummary: text,
  confidence: numeric(3,2),
  createdBy: uuid (FK → users.id),
  createdAt: timestamp
}
```

**impact_action_items** (line 1569-1585):
```typescript
{
  id: uuid (PK),
  assessmentId: uuid (FK → regulatory_impact_assessments.id),
  projectId: uuid (FK → products.id),
  priority: text,
  documentType: text,
  sectionReference: text,
  description: text,
  status: text,  // 'open' | 'in_progress' | 'resolved'
  assignedTo: uuid (FK → users.id),
  createdAt: timestamp,
  resolvedAt: timestamp
}
```

**Migration history:**
- 0033_impact_tables.sql: 초기 테이블 생성
- 0034_impact_indexes.sql: 인덱스 추가

#### 1.3 기존 Audit Actions

`audit_action` enum (lib/db/schema.ts line 185-188):
- `impact.assessment_created`
- `impact.critical_detected`
- `impact.action_item_created`

### 2. v3 4-Layer Wizard 정의 (docs/v3/README.md §3.2)

#### 2.1 Wizard Steps (4단계)

```
Step 1: 제품 선택 (products 테이블)
Step 2: 변경 카테고리 (sw/hw/label/process/sterilize 등)
Step 3: 변경 상세 (자유 텍스트)
Step 4: 영향 시장 선택
```

#### 2.2 Evaluation Layers (4계층)

**Layer 1: retestMatrix 룰 조회 (결정론)**
- 7 변경유형 × 5 시장 = 35셀
- 각 셀: level (required/conditional/not-required) + ref (규정 참조) + note (설명)
- 계층 1은 결정론 데이터 → 즉시 구현 가능

**Layer 2: LLM 카테고리 분류 (gx10 Ollama gpt-oss:120b)**
- 자유 텍스트 → 카테고리 confidence 계산
- 입력: Step 3의 자유 텍스트
- 출력: JSON {"category": string, "confidence": 0-100, "reason": string}
- confidence < 80% 시 재확인 요청

**Layer 3: RA Inbox 자동 티켓 생성**
- 조건: confidence < 80%
- 동작: RA Inbox 티켓 자동 생성 (needs-review 상태)
- 연동: 직접 DB INSERT (lib/db/schema.ts inboxTickets 테이블)
- 참고: domains/inbox는 조회용 API만 제공 (app/api/inbox/route.ts GET)
- 이유: inbox_tickets 테이블 직접 INSERT 패턴 (migrations/0104_inbox_tickets_and_approved_answers.sql 참조)

**Layer 4: ra-llm-wiki RAG 조회**
- 기능: 과거 유사 사례 3건 인용
- 출력: SimilarCasesCard (과거 변경 사례 카드)
- 데이터 소스: ra-llm-wiki (사내 NAS) RAG 검색

#### 2.3 결과 페이지

- 신호등 결과 (green/yellow/red)
- retestMatrix 셀 표시
- 유사 사례 3건 인용
- (필요 시) 티켓 생성 CTA

### 3. retestMatrix 데이터 구조 (docs/v3/reference/data.jsx:1203)

#### 3.1 ChangeTypes (7개)

```javascript
changeTypes: [
  { id: 'bom', label: 'BOM 변경 (부품 교체)' },
  { id: 'sw', label: 'SW 알고리즘 재학습' },
  { id: 'sw-minor', label: 'SW 마이너 (버그픽스)' },
  { id: 'label', label: '라벨 문구 변경' },
  { id: 'warn', label: 'Critical Warning 개정' },
  { id: 'process', label: '생산공정 변경' },
  { id: 'sterile', label: '멸균 조건 변경' },
]
```

#### 3.2 Markets (5개)

```javascript
markets: [
  { id: 'us', label: 'FDA (US)', color: 'var(--brand-700)' },
  { id: 'eu', label: 'MDR (EU)', color: 'var(--d-pms)' },
  { id: 'kr', label: 'MFDS (KR)', color: 'var(--brand-800)' },
  { id: 'cn', label: 'NMPA (CN)', color: 'var(--danger)' },
  { id: 'jp', label: 'PMDA (JP)', color: 'var(--d-cc)' },
]
```

#### 3.3 Cell Structure (35셀 = 7 × 5)

각 셀 키: `{changeType}-{market}`
예: `bom-us`, `sw-eu`, `label-kr`

각 셀 값:
```typescript
{
  level: 'required' | 'conditional' | 'not-required',
  ref: string,      // 규정 참조 (예: "FDA Design Change §III.A")
  note: string     // 설명 (예: "Special 510(k) 검토 필요")
}
```

**예시 셀 (bom-us):**
```javascript
'bom-us': {
  level: 'conditional',
  ref: 'FDA Design Change §III.A',
  note: 'Special 510(k) 검토 필요 · Letter to File 가능 케이스'
}
```

### 4. SPEC-REGULA-IMPACT-001과의 관계

#### 4.1 확장 vs 교체

SPEC-V3-IMPACT-001은 SPEC-REGULA-IMPACT-001의 **확장**이지 교체가 아님:

| 측면 | SPEC-REGULA-IMPACT-001 (기존) | SPEC-V3-IMPACT-001 (신규) |
|------|-------------------------------|---------------------------|
| 사용자 | RA 전문가 (ra-member, ra-lead) | Employee 포함 (모든 역할) |
| 트리거 | RADAR 규제 업데이트 감지 | Employee 자가진단 위저드 |
| 대상 | 포트폴리오 전체 자동 스캔 | 특정 제품 변경 영향 평가 |
| 입력 | 규제 업데이트 ID | 제품 + 변경 카테고리 + 상세 + 시장 |
| 출력 | 자동 영향 평가 + 액션 아이템 | 4계층 판정 + 신호등 결과 |
| DB | regulatory_impact_assessments 테이블 사용 | 동일 테이블 확장 (신규 컬럼 가능) |

#### 4.2 비회귀 보존 전략

기존 기능 보존:
- `/api/ra/impact` API 경로 유지
- `/api/admin/radar/impact` 어드민 트리거 유지
- `lib/impact/portfolio-scanner.ts` 포트폴리오 스캔 로직 유지
- `regulatory_impact_assessments` 테이블 기존 컬럼 유지

신규 기능 추가:
- `POST /api/impact-check` Employee 위저드 엔드포인트
- `lib/domains/impact/` 디렉토리 확장 (기존 `lib/impact/` → `lib/domains/impact/`)
- retestMatrix 코드 임베드 (`lib/domains/impact/retest-matrix-data.ts`)

### 5. RAG 연동 지점

#### 5.1 Layer 4: ra-llm-wiki RAG

데이터 소스:
- 사내 NAS: `10.11.1.40:7001/DR_RnD/ra-llm-wiki.git`
- 임베딩: `embeddings` 테이블 (기존 pgvector 사용)
- 검색 쿼리: changeType + market 필터

RAG 패턴 (TRIAGE/CONSULT 도메인 참조):
```typescript
// lib/domains/ai/run-rag-query.ts 패턴 재사용
const similarCases = await ragQuery({
  query: `${changeType} ${market} 변경 사례`,
  filter: {
    sourceRepo: 'ra-llm-wiki',
    changeType: changeType,
    market: market
  },
  limit: 3
});
```

#### 5.2 Citation 강제 (Charter [지양-2])

모든 RAG 응답은 반드시 출처 인용:
- `<sup class="cite" data-src="...">번호</sup>` 형식
- 출처 없는 응답 금지 (가짜 신뢰 방지)

### 6. 의존성 매트릭스

#### 6.1 내부 의존성

| 의존 대상 | 용도 | 중요도 |
|-----------|------|--------|
| `kernel/db` | DB 쿼리, 트랜잭션 | 필수 |
| `kernel/audit` | 21 CFR Part 11 로깅 | 필수 |
| `domains/ai` (RAG) | Layer 4 유사 사례 검색 | 필수 |
| `domains/radar` | (향후) Radar 연동 | 선택 |
| `domains/inbox` | Layer 3 티켓 생성 | 필수 |
| `domains/registry` | 제품/시장 데이터 조회 | 필수 |

#### 6.2 외부 의존성

| 의존 대상 | 용도 | 버전 |
|-----------|------|------|
| gx10 Ollama (gpt-oss:120b) | Layer 2 카테고리 분류 | via lib/ai/llm-provider.ts |
| pgvector | RAG 벡터 검색 | PostgreSQL 15+ 확장 |
| Drizzle ORM | DB 쿼리 빌더 | 최신 버전 |

### 7. 보안 및 규정 준수

#### 7.1 21 CFR Part 11

요구 사항:
- 모든 위저드 실행 감사 로깅 (`audit_log`에 INSERT)
- 이전 해시 체인 (previous_hash BYTEA) - SPEC-V3-AUDIT-CHAIN-001 참조
- 전자 서명 (ESIG) - 향후 Phase D 구현

#### 7.2 RBAC (Role-Based Access Control)

신규 권한 (`lib/auth/permissions.ts` PERMISSION_MAP 추가 필요):
- `impact.view`: 위저드 실행 권한 (employee, viewer, ra-member, ra-lead, admin) [신규]
- `impact.self_check`: 자가진단 권한 (employee, viewer) [신규]
- `impact.ra_escalate`: RA 티켓 에스컬레이션 권한 (ra-member, ra-lead, admin) [신규]

기존 권한과의 관계:
- `traceability.impact` (L255): 전혀 다른 권한 (규정 추적 관련)
- 신규 impact.* 권한 3종은 기존 권한과 무관하게 추가

신규 권한 (추가 검토 필요):
- `impact.self_check`: employee, viewer (자가진단 위저드 실행)
- `impact.ra_escalate`: ra-member, ra-lead (RA 티켓 에스컬레이션)

### 8. 마이그레이션 필요 여부

#### 8.1 기존 테이블 확장 검토

**regulatory_impact_assessments** 테이블:
- 기존 컬럼: id, regulatoryUpdateId, projectId, impactLevel, affectedSections, analysisSummary, confidence, createdBy, createdAt
- 신규 컬럼 검토:
  - `wizard_type`: text ('radar-auto' | 'employee-self-check')
  - `change_category`: text (bom | sw | sw-minor | label | warn | process | sterile)
  - `change_detail`: text
  - `markets`: jsonb (['us', 'eu', 'kr', 'cn', 'jp'])
  - `retest_matrix_results`: jsonb (계층 1 결과)
  - `llm_category`: jsonb (계층 2 결과)
  - `rag_similar_cases`: jsonb (계층 4 결과)

**Migration 번호:** 0109+ (v3 데이터 모델 참조)

#### 8.2 마이그레이션 전략

1. 기존 데이터 비회귀: 기존 regulatory_impact_assessments 레코드는 wizard_type = NULL
2. 신규 컬럼 nullable: 모든 신규 컬럼은 nullable로 추가
3. 인덱스 추가: wizard_type, change_category 조회 최적화

### 9. 구현 경계 (Phase C-3)

#### 9.1 IN SCOPE (백엔드 도메인 전용)

- `lib/domains/impact/` 확장
- `app/api/impact/` 라우트 신규 생성
- retestMatrix 데이터 코드 임베드
- 4계층 평가 엔진 구현
- Layer 4 RAG 연동
- 21 CFR Part 11 audit 로깅
- RBAC 권한 검사

#### 9.2 OUT OF SCOPE (Phase D 이월)

- UI 컴포넌트 (`components/impact-wizard/`)
- 프론트엔드 상태 관리
- ESIG 전자서명 (Phase D-2)
- 실시간 알림 (Slack, 이메일)

### 10. 잠재 리스크 및 완화

#### 10.1 회귀 위험

**위험 1:** 기존 `/api/ra/impact` API 깨짐
- **완화:** lib/impact/ → lib/domains/impact/ 이동 시 re-export 레이어 유지
- **검증:** 기존 테스트 79개 전체 통과 확인

**위험 2:** DB 마이그레이션 시 기존 데이터 깨짐
- **완화:** 모든 신규 컬럼 nullable, 기본값 NULL
- **검증:** migration 0109 적용 후 `pnpm drizzle-kit check` 실행

**위험 3:** RAG 타임아웃으로 위저드 응답 지연
- **완화:** Layer 4 비동기 처리, 타임아웃 10초 설정
- **검증:** RAG 쿼리 타임아웃 핸들링 테스트

#### 10.2 L-013 교훈 적용

코드/DB/schema 직검 기반:
- spec 서술 vs 코드 충돌 시 **코드 우선**
- 실 DB `\d regulatory_impact_assessments` 직접 확인
- 실 DB `\d impact_action_items` 직접 확인
- migration 0033, 0034 DDL 검증

---

## 참조 문서

1. v3 마스터 계획: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md`
   - §5.1: SPEC-V3-IMPACT-001 정의
   - §5.3: retestMatrix 데이터 통합 전략
   - §8: Phase별 산출물 요약

2. v3 원본 문서: `docs/v3/`
   - `README.md` §3.2: 4-layer wizard 정의
   - `reference/data.jsx`: retestMatrix 35셀 데이터

3. 기존 SPEC: `.moai/specs/SPEC-REGULA-IMPACT-001/spec.md`

4. Product Charter: `.moai/project/product.md`
   - [지양-2]: citation 강제
   - [지양-4]: RA Lead 승인 요구

5. Project Tech Constitution: `.moai/project/tech.md`
   - 기술 스택 제약 조건

6. DB Schema: `lib/db/schema.ts`
   - regulatory_impact_assessments 테이블 정의
   - impact_action_items 테이블 정의
   - audit_action enum 정의

---

**생성일:** 2026-07-05  
**분석 범위:** v3 Phase C-3 (Change Impact 4-Layer Wizard)
**의존 SPEC:** SPEC-REGULA-IMPACT-001 (v1.0.0, completed)
