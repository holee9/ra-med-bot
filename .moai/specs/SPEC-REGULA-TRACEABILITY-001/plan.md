# plan.md — SPEC-REGULA-TRACEABILITY-001 구현 계획

> Issue #47 · 관리자 전략 Phase 1 산출물 · TDD (Brownfield Enhancement)
> 작성일: 2026-06-23 · 작성자: manager-strategy

---

## §0 계획 전제 (Assumption Audit)

| # | 전제 | 신뢰도 | 위험 |
|---|------|--------|------|
| A1 | Issue #169의 기존 `/api/ra/traceability/{scan,graph,impact}` BFF proxy는 hybrid-ra-saas 위임용이며, 본 SPEC #47의 **로컬 evidence graph 계층**과 충돌하지 않는다 | High | 낮음 — 라우트 경로 분리로 해결 |
| A2 | `citations` 테이블은 존재하지 않으며, `message_sources`가 citation 노드 역할을 한다 | High (schema.ts 검증 완료) | 없음 |
| A3 | `source_sections.superseded_by` 컬럼이 supersession 추적의 단일 진실 원천이다 (delta-sync #45가 갱신) | High | 낮음 |
| A4 | 모든 신규 테이블은 org-scope RLS 정책을 따른다 (기존 0066/0067 패턴) | High | 없음 |
| A5 | ExportHub(`lib/export/export-hub.ts`)의 PDF/Markdown exporter를 재사용한다 | High | 없음 |

---

## §1 아키텍처 개요

### 1.1 핵심 설계 원칙

**Abstract Graph Layer**: 본 SPEC은 기존 53개 테이블 위에 얇은 추상 그래프 계층(`evidence_nodes` / `evidence_edges` / `stale_flags`)을 얹는다. 각 노드는 `ref_table` + `ref_id` + `node_type`으로 기존 행을 참조하며, 데이터 복제 없이 관계만 저장한다. 이는 SPEC 명시 요구사항이며 과잉 추상화가 아니다.

**Coexistence with #169**: Issue #169는 hybrid-ra-saas 위임용 BFF proxy(`/api/ra/traceability/*`, `/workflows/traceability` 페이지)를 이미 설치했다. 본 SPEC #47의 로컬 evidence graph는 **별도 라우트**(`/api/traceability/*`)와 **별도 페이지**(`/(app)/traceability`)로 분리하여 충돌을 회피한다. 두 시스템은 상호 보완적이다 — #169는 글로벌 스캔/임팩트, #47은 프로젝트 단위 근거 매트릭스.

**Pure module pattern**: `lib/traceability/*.ts` 모듈들은 `lib/classify/`, `lib/knowledge-gap/`에서 확립한 패턴을 따른다 — 의존성 주입(fetch/db client 주입 가능), 순수 함수, BFF 라우트에서만 db import.

### 1.2 시스템 맥락

```
┌─────────────────────────────────────────────────────────────┐
│  기존 소스 테이블 (read-only 참조)                           │
│  source_sections · message_sources · messages ·              │
│  workflow_runs · expert_reviews · submission_packages ·      │
│  risk_items · regulatory_updates                             │
└──────────────────┬──────────────────────────────────────────┘
                   │ ref_table + ref_id
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  NEW: Evidence Graph Layer (migration 0068)                  │
│  evidence_nodes ── evidence_edges ── stale_flags             │
│  (노드 메타데이터)   (6가지 관계)      (supersession 전파)    │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   Matrix API   Edge API   Packet API
   (집계/갭)    (CRUD/감사) (조립/내보내기)
        │          │          │
        ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│  UI: /(app)/traceability                                     │
│  matrix page · [deliverableId] packet page · Sidebar nav     │
└─────────────────────────────────────────────────────────────┘
```

---

## §2 데이터베이스 설계

### 2.1 신규 테이블 (migration `0068_traceability.sql`)

#### `evidence_nodes`
```sql
CREATE TABLE evidence_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  node_type       evidence_node_type NOT NULL,
  ref_table       TEXT NOT NULL,
  ref_id          TEXT NOT NULL,
  authority       TEXT,          -- FDA, EU MDR, MFDS, NMPA, PMDA
  version         TEXT,          -- 규제 문서 버전
  effective_date  TIMESTAMPTZ,   -- 규제 효력일
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  artifact_hash   TEXT,          -- SHA256 of linked artifact (req-002)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID NOT NULL REFERENCES users(id)
);
-- Indexes
CREATE INDEX idx_evidence_nodes_ref ON evidence_nodes(ref_table, ref_id);
CREATE INDEX idx_evidence_nodes_project ON evidence_nodes(project_id);
CREATE INDEX idx_evidence_nodes_org ON evidence_nodes(org_id);
CREATE UNIQUE INDEX uq_evidence_nodes_ref ON evidence_nodes(org_id, node_type, ref_table, ref_id);
-- RLS
ALTER TABLE evidence_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_nodes_org_isolation ON evidence_nodes
  USING (org_id::text = current_setting('app.current_org_id', true));
```

#### `evidence_edges`
```sql
CREATE TABLE evidence_edges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_node_id  UUID NOT NULL REFERENCES evidence_nodes(id) ON DELETE CASCADE,
  to_node_id    UUID NOT NULL REFERENCES evidence_nodes(id) ON DELETE CASCADE,
  relation      evidence_edge_relation NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 자기 참조 금지
  CONSTRAINT evidence_edges_no_self CHECK (from_node_id <> to_node_id)
);
CREATE INDEX idx_evidence_edges_from ON evidence_edges(from_node_id);
CREATE INDEX idx_evidence_edges_to ON evidence_edges(to_node_id);
CREATE INDEX idx_evidence_edges_relation ON evidence_edges(relation);
-- RLS 동일 패턴
```

#### `stale_flags`
```sql
CREATE TABLE stale_flags (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id                 UUID NOT NULL REFERENCES evidence_nodes(id) ON DELETE CASCADE,
  reason                  stale_reason NOT NULL,
  propagated_from_node_id UUID REFERENCES evidence_nodes(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stale_flags_node ON stale_flags(node_id);
```

### 2.2 신규 pgEnum

```sql
CREATE TYPE evidence_node_type AS ENUM (
  'source_section',   -- source_sections.ref_id
  'message_source',   -- message_sources.ref_id (citation 노드)
  'message',          -- messages.ref_id
  'workflow_run',     -- workflow_runs.ref_id (CER/PCCP/510k 초안)
  'expert_review',    -- expert_reviews.ref_id
  'submission_package', -- submission_packages.ref_id
  'risk_item',        -- risk_items.ref_id
  'regulatory_update' -- regulatory_updates.ref_id
);

CREATE TYPE evidence_edge_relation AS ENUM (
  'derived_from',  -- answer/draft ← source
  'cites',         -- message ← message_source ← source_section
  'reviewed_by',   -- deliverable ← expert_review
  'exported_in',   -- deliverable ← submission_package
  'mitigates',     -- risk_control ← risk_item
  'satisfies'      -- deliverable ← regulatory requirement
);

CREATE TYPE stale_reason AS ENUM (
  'superseded_source',
  'superseded_regulation'
);
```

### 2.3 audit_action 확장 (4개 값)

```sql
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.edge_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.edge_deleted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.packet_exported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.stale_propagated';
```

> 기존 `workflow.start`를 #169가 사용 중이므로, #47 전용 값을 추가하여 감사 추적을 명확히 한다.

### 2.4 회귀 체크포인트 (현재 베이스라인)

| 항목 | 현재값 | 구현 후 예상값 | 갱신 위치 |
|------|--------|---------------|----------|
| 마이그레이션 파일 수 | 68 (0067_Classify.sql 까지) | **69** | `tests/unit/enterprise-migrations.test.ts` (SPEC-REGULA-TRACEABILITY-001 describe 블록 추가) |
| PermissionAction union 항목 | 47개 | **48개** (`traceability.manage` 추가) | `lib/auth/permissions.ts` |
| audit_action pgEnum 값 | ~68개 | **~72개** (+4) | `lib/db/schema.ts` auditActionEnum + `lib/audit.ts` AuditAction type |
| PERMISSIONS 매트릭스 항목 | 47개 | **48개** | `lib/auth/permissions.ts` |

---

## §3 API 계약

### 3.1 `GET /api/traceability` — 매트릭스 집계

```
GET /api/traceability?projectId=<uuid>&jurisdiction=FDA&product=&package=<id>&riskLevel=unacc&stale=only
```

**RBAC**: `traceability.view` (ra-member+, org-scope)

**응답**: 매트릭스 행/열 + 갭 검출
```json
{
  "rows": [
    {
      "nodeType": "risk_item",
      "refId": "...",
      "label": "Hazard: 전원 과부하",
      "evidence": [{ "nodeType": "source_section", "authority": "IEC 62304", "version": "A1" }],
      "answer": { "messageId": "...", "status": "answered" },
      "reviewer": { "userId": "...", "status": "approved" },
      "export": { "submissionPackageId": "...", "version": "1.0" },
      "gaps": ["missing_citation"],
      "stale": false
    }
  ],
  "summary": { "totalRows": 24, "withGaps": 5, "stale": 1 }
}
```

**집계 로직** (`lib/traceability/matrix.ts`):
- 노드를 `project_id`로 스캔, 각 노드를 ref_table 조인으로 소스 행과 결합
- `deliverable 노드`(message, workflow_run, risk_item)마다 incoming edge를 역추적하여 evidence/answer/review/export 채움
- **갭 검출 (REQ-012)**: deliverable 노드가 `derived_from` 또는 `cites` incoming edge를 0개 가지면 `missing_citation` 갭
- stale 플래그는 `stale_flags` 조인으로 표시

### 3.2 `POST /api/traceability/edges` — edge 생성/삭제

**RBAC**: `traceability.manage` (ra-lead only, org-scope) — 감사 중요 규제 기록이므로 엄격

**IDOR 방지 (L-006 교훈, #35 결함 클래스)**: 요청 본문의 `fromNodeId`/`toNodeId`가 요청자의 org에 속하는지 검증. 노드 조회 시 `org_id` 필터 강제.

```typescript
const EdgeWriteSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  relation: z.enum(['derived_from','cites','reviewed_by','exported_in','mitigates','satisfies']),
  action: z.enum(['create', 'delete']),
});
```

**흐름**:
1. Zod 검증
2. 두 노드의 `org_id`가 세션 org와 일치하는지 확인 (IDOR 게이트)
3. edge 생성/삭제 (중복 생성 방지용 `ON CONFLICT DO NOTHING`)
4. `writeAudit({ action: 'traceability.edge_created' | 'traceability.edge_deleted', ... })`
5. stale 전파 재평가 (edge 추가 시 supersession 체인 재확인)

### 3.3 `GET /api/traceability/[deliverableId]/packet` — 근거 패킷

**RBAC**: `traceability.view`

**응답**: deliverable 노드에서 도달 가능한 모든 근거 노드 + edge + reviewer decision + stale 상태를 트리 형태로 조립 (`lib/traceability/evidence-packet.ts`).

### 3.4 `GET /api/traceability/[deliverableId]/export?format=pdf|md` — 내보내기

**RBAC**: `traceability.view` + 감사 `traceability.packet_exported`

**구현**: `lib/export/export-hub.ts`의 `ExportHub.getExporter(format)` 재사용. 패킷 데이터를 Markdown/PDF로 렌더링. PDF는 기존 `PDFExporter`(`@react-pdf/renderer`) 활용.

---

## §4 Stale 전파 설계

### 4.1 트리거 지점 (application-level hook — DB 트리거 아님)

**선택 근거**: DB 트리거는 테스트 불가, 디버그 곤란. 애플리케이션 훅은 명시적이고 TDD 친화적. #45 delta-sync와 #41 impact 라우트가 이미 갱신 지점을 소유.

**지점 1 — source supersession** (`lib/delta-sync/` 또는 `lib/sources/`):
`source_sections.superseded_by`가 갱신되면, 해당 `source_section` 노드에서 `derived_from`/`cites` edge를 따라가며 연결된 모든 deliverable 노드에 `stale_flags` 생성.

**지점 2 — regulation supersession** (`app/api/ra/impact` 관련):
`regulatory_updates` supersession 발생 시 동일한 팬아웃.

### 4.2 전파 알고리즘 (`lib/traceability/stale-propagation.ts`)

```typescript
export async function propagateStaleFromNode(opts: {
  orgId: string;
  sourceNodeId: string;
  reason: 'superseded_source' | 'superseded_regulation';
  trx?: PgTx;  // 주입 가능 — 테스트 용이
}): Promise<{ affectedNodeIds: string[] }>
```

- BFS로 `evidence_edges`를 따라 연결 노드 순회
- 각 노드에 `stale_flags` upsert (`ON CONFLICT DO NOTHING`)
- `writeAudit({ action: 'traceability.stale_propagated', meta_json: { affected: [...] } })`
- 주의: 무한 루프 방지용 visited 세트

---

## §5 프론트엔드 설계

### 5.1 매트릭스 페이지 `app/(app)/traceability/page.tsx`

**구조**: Server Component + 클라이언트 필터 island (#35/#59 참조 패턴)
- searchParams에서 `projectId, jurisdiction, product, package, riskLevel, stale` 읽기
- 서버에서 `getMatrix(orgId, projectId, filters)` 호출
- 행/열 테이블 렌더링, 갭/stale 셀에 색상 배지
- 필터 변경은 URL 네비게이션으로 SSR 유지

### 5.2 근거 패킷 페이지 `app/(app)/traceability/[deliverableId]/page.tsx`

- 서버에서 `getEvidencePacket(orgId, deliverableId)` 호출
- 트리 구조 렌더링 (source → answer → review → export)
- PDF/Markdown 내보내기 버튼 (클라이언트 island에서 `/export?format=` 호출)

### 5.3 Sidebar 조건부 네비게이션

`components/shell/Sidebar.tsx`에 `traceability.view` 권한 시 노출되는 링크 추가 (기존 Predicate/Expert Review 조건부 패턴 참조).

### 5.4 기존 매트릭스 UI 컴포넌트 재사용 가능성

기존 `app/(app)/workflows/traceability/_components/TraceabilityShell.tsx`는 scan/graph/impact 탭으로 #169 전용. 본 SPEC의 매트릭스 뷰는 별도 컴포넌트로 작성하되, 테이블/필터 UI 프리미티브(`components/ui/`)는 재사용.

---

## §6 REQ-011 — replay/eval edge 검증 훅

**연결 지점**: `lib/knowledge-gap/replay.ts`의 `replayGapTest()` 흐름.

**추가 검증**: replay가 답변을 재생성한 후, 해당 답변이 인용하는 `message_sources`에 대응하는 `evidence_nodes`가 존재하고 stale 플래그가 없는지 확인. 누락 시 `passed = false`에 근거 추가.

```typescript
// lib/traceability/verify-edges.ts (신규)
export async function verifyAnswerEdges(opts: {
  orgId: string;
  messageId: string;
}): Promise<{ intact: boolean; brokenEdges: EdgeRef[]; staleNodes: NodeRef[] }>
```

`replay.ts`에서 호출하여 결과에 반영. 별도 작업(T-012)으로 분리.

---

## §7 기존 라이브러리 재사용 매핑

| 신규 모듈 | 재사용 참조 | 재사용 내용 |
|-----------|------------|------------|
| `lib/traceability/graph.ts` | `lib/knowledge-gap/queue-query.ts` | org-scope 쿼리 패턴, 트랜잭션 래핑 |
| `lib/traceability/matrix.ts` | `lib/classify/engine.ts` | 순수 함수 + 주입형 retriever 패턴 |
| API 라우트들 | `app/api/ra/traceability/scan/route.ts` | `withPermission` + `writeAudit` + Zod 패턴 |
| `lib/traceability/export-packet.ts` | `lib/audit-package/builder.ts`, `lib/export/export-hub.ts` | ZIP/PDF 조립 + ExportHub 등록 |
| Sidebar nav | `components/shell/Sidebar.tsx` Predicate/ExpertReview 조건부 블록 | 권한 기반 조건부 렌더링 |
| 테스트 구조 | `lib/classify/__tests__/` | Vitest + 주입형 mock + 실제 DB 통합 테스트 혼합 |

---

## §8 테스트 전략 (L-006, 최근 #35/#59 교훈 반영)

### 8.1 단위 테스트 (Vitest, mock 주입)
- `graph.ts`: 노드/엣지 CRUD, IDOR 방지 (org 불일치 시 403)
- `matrix.ts`: 갭 검출 로직, 필터 집계
- `stale-propagation.ts`: BFS 전파, 무한 루프 방지, 중복 flag 제거
- `evidence-packet.ts`: 트리 조립

### 8.2 실제 파이프라인 회귀 테스트 (mock 회피 — #35 결함 반복 방지)
- **edge 쓰기 경로 실DB**: 테스트 DB에 노드 2개 삽입 → edge 생성 → 감사 로그 행 확인 → org 불일치 edge 생성 시도 → 거부 확인
- **stale 팬아웃 실DB**: superseded_by 갱신 트리거 → 연결 3개 노드에 stale_flags 생성 확인
- **내보내기 렌더링 실제**: 작은 패킷 → PDF 바이트 생성 확인 (ExportHub 회피 없이)

### 8.3 감사 회귀
- edge 생성/삭제 시 `audit_logs`에 해당 action 값이 기록되는지 확인
- `enterprise-migrations.test.ts`에 0068 검증 블록 추가

### 8.4 보안 검토 (필수)
`/moai sync` Phase 0.55에서 `expert-security` 리뷰 강제 — IDOR, RLS 우회, injection 입력 벡터 집중 (2회 연속 merge-blocking 결함 발견된 검증 게이트).

---

## §9 위험 및 미해결 설계 질문

### 위험 매트릭스

| 위험 | 확률 | 영향 | 완화 |
|------|------|------|------|
| #169 BFF 라우트와 경로 충돌 | 낮음 | 중간 | `/api/traceability` (신규) vs `/api/ra/traceability` (#169)로 분리 |
| 기존 테이블 행이 없을 때 노드 조회 실패 | 중간 | 낮음 | 빈 셀로 처리 (SPEC 전제: 데이터 부재 = 블로커 아님) |
| stale 전파가 순환 참조로 무한 루프 | 낮음 | 높음 | visited 세트 + `ON CONFLICT DO NOTHING` |
| ExportHub PDF 렌더링 타임아웃 | 중간 | 중간 | 60s SLA, 패킷 페이지네이션 |

### 사용자 게이트 설계 질문 (3개)

**Q1 — 매트릭스 페이지 위치**
- (권장) 신규 최상위 `/(app)/traceability` — #169의 `/workflows/traceability` scan/graph/impact와 분리, 매트릭스는 근거 추적 전용 뷰로 명확
- 대안: 기존 `/workflows/traceability`에 "매트릭스" 탭 추가 — #169와 통합, 탭 4개로 증가

**Q2 — `traceability.manage` 권한 최소 역할**
- (권장) `ra-lead` only — knowledgegap.classify와 동일 기준, 감사 중요 규제 기록이므로 판단 역할 필요
- 대안: `ra-member` 이상 — 넓은 접근, 실수 위험 증가

**Q3 — stale 전파 트리거 방식**
- (권장) 애플리케이션 훅 (delta-sync + impact 라우트에서 명시 호출) — TDD 친화적, 디버그 용이
- 대안: DB 트리거 — 자동이지만 테스트/디버그 곤란

---

## §10 파일 구조 (구현 대상)

```
migrations/
  0068_traceability.sql                         # 신규

lib/db/schema.ts                                 # 갱신: 3 테이블 + 3 enum + audit_action 4값
lib/audit.ts                                     # 갱신: AuditAction type 4값 추가

lib/auth/permissions.ts                          # 갱신: traceability.manage 추가

lib/traceability/                                # 신규 디렉터리
  graph.ts                                       # 노드/엣지 CRUD + IDOR 방지
  matrix.ts                                      # 매트릭스 집계 + 갭 검출
  stale-propagation.ts                           # supersession BFS 팬아웃
  evidence-packet.ts                             # 패킷 트리 조립
  export-packet.ts                               # ExportHub 연동
  verify-edges.ts                                # REQ-011 edge 무결성 검증
  __tests__/
    graph.test.ts
    matrix.test.ts
    stale-propagation.test.ts
    evidence-packet.test.ts
    verify-edges.test.ts
    integration-real-db.test.ts                  # 실DB 회귀 (L-006)

app/api/traceability/                            # 신규 라우트 그룹
  route.ts                                       # GET 매트릭스
  edges/route.ts                                 # POST edge 쓰기
  [deliverableId]/packet/route.ts                # GET 패킷
  [deliverableId]/export/route.ts                # GET 내보내기

app/(app)/traceability/                          # 신규 페이지
  page.tsx                                       # 매트릭스
  [deliverableId]/page.tsx                       # 근거 패킷
  _components/
    MatrixFilters.tsx                            # 필터 클라이언트 island
    EvidenceTree.tsx                             # 패킷 트리 뷰

components/shell/Sidebar.tsx                     # 갱신: 조건부 링크 추가

tests/unit/enterprise-migrations.test.ts         # 갱신: 0068 검증 블록
```

---

버전: 1.0.0 · 다음 단계: 사용자 게이트(Q1~Q3) 확정 후 tasks.md 기반 Phase 2A 위임
