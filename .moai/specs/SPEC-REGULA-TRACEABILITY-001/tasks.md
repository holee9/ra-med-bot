# tasks.md — SPEC-REGULA-TRACEABILITY-001 작업 분해

> TDD (Brownfield Enhancement) · Phase 2A(backend) → Phase 2B(frontend)
> 각 태스크는 단일 DDD/TDD 사이클 내 완료 가능한 원자 단위

---

## Phase 2A — 백엔드 (regula-backend 위임)

| Task ID | 설명 | 요구사항 | 의존성 | 계획 파일 | 상태 |
|---------|------|---------|--------|----------|------|
| T-001 | migration 0068_traceability.sql 작성 — evidence_nodes, evidence_edges, stale_flags 테이블 + evidence_node_type, evidence_edge_relation, stale_reason pgEnum + audit_action 4값 추가 + RLS org-scope 정책 + 인덱스 | REQ-001, REQ-002, REQ-003 | 없음 | `migrations/0068_traceability.sql` | pending |
| T-002 | `lib/db/schema.ts` lock-step 갱신 — evidenceNodes, evidenceEdges, staleFlags pgTable + 3개 pgEnum(evidenceNodeType, evidenceEdgeRelation, staleReasonEnum) + auditActionEnum에 4값 추가 | REQ-001, REQ-002, REQ-003 | T-001 | `lib/db/schema.ts` | pending |
| T-003 | `lib/audit.ts` AuditAction union type에 4값(traceability.edge_created, traceability.edge_deleted, traceability.packet_exported, traceability.stale_propagated) 추가 — writeAudit 런타임 삽입 실패 방지 | REQ-010 | T-002 | `lib/audit.ts` | pending |
| T-004 | `lib/auth/permissions.ts` 갱신 — PermissionAction에 `traceability.manage` 추가, PERMISSIONS 매트릭스에 ra-lead/org 스펙 등록 (IDOR 방지 게이트용) | REQ-010 | T-002 | `lib/auth/permissions.ts` | pending |
| T-005 | `lib/traceability/graph.ts` 작성 — evidence_nodes/evidence_edges CRUD, org-scope 강제(IDOR 방지), 주입형 db client 트랜잭션 지원. PURE 모듈 (lib/classify/engine.ts 패턴) | REQ-001, REQ-002, REQ-003, REQ-010 | T-002, T-004 | `lib/traceability/graph.ts` | pending |
| T-006 | `lib/traceability/graph.test.ts` 단위 테스트 — 노드 생성, edge 생성/삭제, org 불일치 IDOR 거부, 자기 참조 edge 금지, 중복 edge 무시 | REQ-001, REQ-010 | T-005 | `lib/traceability/__tests__/graph.test.ts` | pending |
| T-007 | `lib/traceability/matrix.ts` 작성 — 행 집계(ref_table 조인), 갭 검출(derived_from/cites incoming edge 0개 = missing_citation, REQ-012), 필터(jurisdiction/product/package/riskLevel/stale) | REQ-004, REQ-005, REQ-006, REQ-012 | T-005 | `lib/traceability/matrix.ts` | pending |
| T-008 | `lib/traceability/matrix.test.ts` 단위 테스트 — 갭 검출 로직, 필터 조합, 빈 결과 처리, 다중 노드 타입 행 | REQ-004, REQ-006, REQ-012 | T-007 | `lib/traceability/__tests__/matrix.test.ts` | pending |
| T-009 | `lib/traceability/stale-propagation.ts` 작성 — propagateStaleFromNode(orgId, sourceNodeId, reason): BFS로 evidence_edges 순회, stale_flags upsert(ON CONFLICT DO NOTHING), writeAudit(traceability.stale_propagated), 무한 루프 방지 visited 세트 | REQ-009 | T-005, T-003 | `lib/traceability/stale-propagation.ts` | pending |
| T-010 | `lib/traceability/stale-propagation.test.ts` 단위 테스트 — 단일 hop, 다중 hop, 순환 참조 안전성, 중복 flag 멱등, reason별 분기 | REQ-009 | T-009 | `lib/traceability/__tests__/stale-propagation.test.ts` | pending |
| T-011 | `lib/traceability/evidence-packet.ts` + `export-packet.ts` 작성 — getEvidencePacket(deliverableId): 연결된 모든 근거 노드 트리 조립. exportPacket(packet, format): 기존 ExportHub(getExporter('pdf'|'markdown')) 재사용 | REQ-007, REQ-008 | T-005 | `lib/traceability/evidence-packet.ts`, `lib/traceability/export-packet.ts` | pending |
| T-012 | `lib/traceability/verify-edges.ts` 작성 — verifyAnswerEdges(orgId, messageId): 인용 message_sources의 evidence_nodes 존재 + stale 미플래그 확인. lib/knowledge-gap/replay.ts에 통합 훅 (REQ-011) | REQ-011 | T-005 | `lib/traceability/verify-edges.ts`, `lib/knowledge-gap/replay.ts`(갱신) | pending |
| T-013 | `app/api/traceability/route.ts` 작성 — GET 매트릭스. withPermission(traceability.view), projectId/filter 쿼리 파싱(Zod), getMatrix 호출 | REQ-004, REQ-005 | T-007 | `app/api/traceability/route.ts` | pending |
| T-014 | `app/api/traceability/edges/route.ts` 작성 — POST edge 쓰기. withPermission(traceability.manage), Zod 본문 검증, IDOR 방지(fromNode/toNode org_id 일치 확인), writeAudit(traceability.edge_created/deleted) | REQ-001, REQ-010 | T-005, T-004 | `app/api/traceability/edges/route.ts` | pending |
| T-015 | `app/api/traceability/[deliverableId]/packet/route.ts` 작성 — GET 근거 패킷. withPermission(traceability.view), getEvidencePacket 호출 | REQ-007 | T-011 | `app/api/traceability/[deliverableId]/packet/route.ts` | pending |
| T-016 | `app/api/traceability/[deliverableId]/export/route.ts` 작성 — GET 내보내기. withPermission(traceability.view), format 쿼리(pdf|md), exportPacket 호출, writeAudit(traceability.packet_exported) | REQ-008 | T-011 | `app/api/traceability/[deliverableId]/export/route.ts` | pending |
| T-017 | `tests/unit/enterprise-migrations.test.ts` 갱신 — SPEC-REGULA-TRACEABILITY-001 describe 블록 추가: 0068 파일 존재, 3 테이블 DDL, 3 pgEnum, audit_action 4값, RLS 정책, schema.ts lock-step 검증 | AC-01, AC-06 | T-001, T-002 | `tests/unit/enterprise-migrations.test.ts` | pending |
| T-018 | `lib/traceability/__tests__/integration-real-db.test.ts` 작성 — 실DB 회귀 (L-006, #35 결함 반복 방지): edge 쓰기→감사 로그 행 확인, stale 팬아웃 3노드 실제 전파, 패킷 PDF 바이트 실제 생성. mock 금지 | AC-01, AC-05, AC-06, AC-07 | T-005, T-009, T-011 | `lib/traceability/__tests__/integration-real-db.test.ts` | pending |

---

## Phase 2B — 프론트엔드 (regula-frontend 위임)

| Task ID | 설명 | 요구사항 | 의존성 | 계획 파일 | 상태 |
|---------|------|---------|--------|----------|------|
| T-019 | `app/(app)/traceability/page.tsx` 작성 — 매트릭스 Server Component. searchParams(projectId/jurisdiction/product/package/riskLevel/stale) 읽기, getMatrix 서버 호출, 행/열 테이블 렌더링, 갭(stale) 셀 색상 배지 | REQ-004, REQ-005, REQ-006, REQ-012 | T-013 | `app/(app)/traceability/page.tsx` | pending |
| T-020 | `app/(app)/traceability/_components/MatrixFilters.tsx` 작성 — 필터 클라이언트 island. URL 네비게이션으로 SSR 유지 (QueueFilters.tsx 패턴 참조) | REQ-005 | T-019 | `app/(app)/traceability/_components/MatrixFilters.tsx` | pending |
| T-021 | `app/(app)/traceability/[deliverableId]/page.tsx` 작성 — 근거 패킷 페이지. getEvidencePacket 서버 호출, EvidenceTree 렌더링, PDF/MD 내보내기 버튼 | REQ-007, REQ-008 | T-015, T-016 | `app/(app)/traceability/[deliverableId]/page.tsx` | pending |
| T-022 | `app/(app)/traceability/[deliverableId]/_components/EvidenceTree.tsx` 작성 — 트리 뷰 클라이언트 컴포넌트 + 내보내기 버튼(fetch /export?format=) | REQ-007, REQ-008 | T-021 | `app/(app)/traceability/[deliverableId]/_components/EvidenceTree.tsx` | pending |
| T-023 | `components/shell/Sidebar.tsx` 갱신 — traceability.view 권한 시 노출되는 조건부 네비 링크 추가 (Predicate/ExpertReview 조건부 패턴 참조) | REQ-004 | T-004 | `components/shell/Sidebar.tsx` | pending |

---

## 교차 검증 태스크 (양쪽)

| Task ID | 설명 | 요구사항 | 의존성 | 계획 파일 | 상태 |
|---------|------|---------|--------|----------|------|
| T-024 | AC-02 (매트릭스 UI 필터 동작) 수동 검증 시나리오 문서 + E2E 테스트(선택) | AC-02 | T-019, T-020 | `lib/traceability/__tests__/matrix-ui.test.ts` | pending |
| T-025 | 보안 검토 — `/moai sync` Phase 0.55에서 expert-security 리뷰 (IDOR, RLS 우회, injection). 2회 연속 merge-blocking 결함 방지 | AC-06 | T-014, T-018 | (검토 보고서 산출) | pending |

---

## AC ↔ 태스크 추적

| AC | 관련 태스크 | 검증 방법 |
|----|-----------|----------|
| AC-01 (graph 저장) | T-001, T-005, T-006, T-018 | 실DB edge 쓰기 테스트 |
| AC-02 (matrix UI + 필터) | T-019, T-020, T-024 | UI 검토 |
| AC-03 (갭/stale/unresolved 표시) | T-007, T-008, T-019 | 단위 + UI |
| AC-04 (PDF/MD 내보내기) | T-011, T-016, T-018 | 실제 PDF 바이트 |
| AC-05 (supersession 전파) | T-009, T-010, T-018 | 실DB 팬아웃 |
| AC-06 (감사 로그) | T-003, T-014, T-017, T-018 | 감사 행 확인 |
| AC-07 (replay edge 검증) | T-012 | 통합 테스트 |
| AC-08 (open gap 표시) | T-007, T-019 | 갭 검출 단위 |

---

버전: 1.0.0 · 총 25개 태스크 (Phase 2A: 18, Phase 2B: 5, 교차: 2)
