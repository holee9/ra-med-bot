---
id: SPEC-REGULA-TRACEABILITY-001
version: 1.0.0
status: completed
phase: wave4
priority: High
created: 2026-06-22
updated: 2026-06-23
author: manager-spec (batch-2026-06-22)
issue_number: 47
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
---

# SPEC-REGULA-TRACEABILITY-001 — 규제 근거·위험·요구사항·초안·검토·제출 추적 매트릭스

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #47 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

선행 이슈들(#22~#46)이 완료되면 Regula는 질의응답, 문서 ingestion, 규제 전략, Predicate/CER/PCCP, 위험관리, 영향 추적, 제출 패키징까지 수행한다. 남은 핵심 공백은 모든 결론과 산출물이 어떤 근거에서 왔고, 어떤 검토와 제출 상태로 이어졌는지 한 번에 추적하는 evidence graph이다.

의료기기 RA 업무에서 최종 유용성은 답변 생성 능력보다 추적성(traceability)에 의해 결정된다. 규제 당국과 공인기관은 "이 결론의 근거는 무엇이며, 누가 검토했고, 어느 제출에 포함되었는가"를 요구한다. 근거가 끊기거나 stale source가 산출물에 남아 있으면 제출 자체가 거부될 수 있다.

본 SPEC은 source_sections, citations, messages, workflow_runs, expert_reviews, submission_packages, risk_items를 연결하는 traceability graph를 생성한다. 각 노드는 source authority, version, effective date, reviewer, artifact hash를 포함하고, 각 edge는 derived_from, cites, reviewed_by, exported_in, mitigates, satisfies 관계로 구분된다. Traceability Matrix UI는 요구사항·규제 요구사항·위험 항목·제출 섹션을 행으로, 근거 출처·생성 답변·reviewer decision·export artifact·open gap을 열로 제시한다.

source가 superseded되면 연결된 산출물과 제출 패키지에 stale flag가 전파되며, 모든 traceability 변경은 audit_logs에 기록된다. 이를 통해 Regula는 문서 생성기가 아니라 audit-ready RA operating system이 된다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 21 CFR Part 820 (Design History File, traceability)
- ISO 13485:2016 §7.3 (Design and Development traceability), §4.2.4 (Control of Records)
- ISO 14971:2019 (risk-to-control traceability)
- EU MDR Annex II (Technical Documentation traceability)
- IEC 62304 (요구사항-설계-검증 traceability)

### 1.3 본 SPEC의 범위 (In Scope)

- Evidence Graph 모델: source_sections·citations·messages·workflow_runs·expert_reviews·submission_packages·risk_items를 연결, 노드 메타데이터(authority, version, effective date, reviewer, artifact hash), edge 관계(derived_from, cites, reviewed_by, exported_in, mitigates, satisfies)
- Traceability Matrix UI: 요구사항/규제/위험/제출 섹션(행) × 근거/답변/reviewer decision/export/gap(열), jurisdiction·product·package·risk level·stale source 필터
- 산출물별 근거 패키지: 답변·CER 섹션·PCCP 컴포넌트·510(k) 섹션·위험 항목에서 evidence packet 열람, citation 누락·stale·unresolved review 표시, PDF/Markdown export
- 감사 및 회귀 검증: edge 변경 audit, source supersession 시 stale flag 전파, replay/eval 시나리오가 edge 검증

### 1.4 Out of Scope

- 외부 QMS 전용 시스템 양방향 동기화
- 전자서명 full validation
- 제출 포털 자동 업로드

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-TRACEABILITY-001 | WHEN an answer or draft is generated from sources THE SYSTEM SHALL persist a graph edge linking source, answer/draft, review, and export artifact | High |
| REQ-TRACEABILITY-002 | THE SYSTEM SHALL store each graph node with source authority, version, effective date, reviewer, and artifact hash | High |
| REQ-TRACEABILITY-003 | THE SYSTEM SHALL distinguish edge relationships as derived_from, cites, reviewed_by, exported_in, mitigates, or satisfies | High |
| REQ-TRACEABILITY-004 | THE SYSTEM SHALL provide a per-project traceability matrix UI with requirements, regulatory requirements, risk items, and submission sections as rows | High |
| REQ-TRACEABILITY-005 | THE SYSTEM SHALL allow the traceability matrix to be filtered by jurisdiction, product, package, risk level, and stale-source status | Medium |
| REQ-TRACEABILITY-006 | WHEN the matrix is displayed THE SYSTEM SHALL flag missing citations, stale sources, and unresolved reviews | High |
| REQ-TRACEABILITY-007 | WHEN a user opens a deliverable THE SYSTEM SHALL present an evidence packet for the answer, CER section, PCCP component, 510(k) section, or risk item | High |
| REQ-TRACEABILITY-008 | THE SYSTEM SHALL export an evidence packet to PDF or Markdown | Medium |
| REQ-TRACEABILITY-009 | WHEN a source is superseded THE SYSTEM SHALL propagate a stale flag to all linked deliverables and submission packages | High |
| REQ-TRACEABILITY-010 | WHEN a traceability edge is created, modified, or deleted THE SYSTEM SHALL record the change in audit_logs | High |
| REQ-TRACEABILITY-011 | WHEN a replay or eval scenario runs THE SYSTEM SHALL verify the integrity of traceability edges | Medium |
| REQ-TRACEABILITY-012 | IF a deliverable has no linked source THEN THE SYSTEM SHALL mark it as an open evidence gap in the matrix | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | source → answer/draft → review → export artifact 관계가 graph로 저장된다 | Test |
| AC-02 | 프로젝트별 traceability matrix UI가 제공되고 필터가 동작한다 | Review |
| AC-03 | citation 누락·stale source·unresolved review가 matrix에서 표시된다 | Test / Review |
| AC-04 | evidence packet PDF/Markdown export가 가능하다 | Test |
| AC-05 | source supersession 시 영향받는 산출물이 stale로 표시된다 | Test |
| AC-06 | 모든 traceability 변경이 audit_logs에 남는다 | Test |
| AC-07 | replay/eval 시나리오가 traceability edge를 검증한다 | Test |
| AC-08 | source 미연결 산출물이 open evidence gap으로 표시된다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/
    (dashboard)/traceability/
      page.tsx                  # matrix UI (rows × columns, filters)
      [deliverableId]/page.tsx  # evidence packet 열람
    api/traceability/
      route.ts                  # matrix 조회
      edges/route.ts            # edge 생성/변경 (audit)
      [deliverableId]/packet/route.ts  # evidence packet
      [deliverableId]/export/route.ts  # PDF/Markdown export
  lib/traceability/
    graph.ts                    # 노드/엣지 모델, 조회
    stale-propagation.ts        # supersession 전파
    evidence-packet.ts          # packet 조립
    matrix.ts                   # 행/열 집계, gap 검출
  db/schema/traceability.ts
```

### 4.2 DB Schema

- `evidence_nodes`: id, node_type (source_section|citation|message|workflow_run|expert_review|submission_package|risk_item), ref_id, authority, version, effective_date, reviewer_id, artifact_hash
- `evidence_edges`: id, from_node_id, to_node_id, relation (derived_from|cites|reviewed_by|exported_in|mitigates|satisfies), created_at
- `stale_flags`: id, node_id, reason (superseded_source), propagated_from, created_at
- audit_logs 재사용 — edge create/modify/delete 기록
- pgvector source 모델(FOUNDATION) 재사용 — source authority/version 참조

### 4.3 API Endpoints

- `GET /api/traceability?projectId=` — matrix rows/columns + filters
- `POST /api/traceability/edges` — edge 생성/변경 (RBAC, audit)
- `GET /api/traceability/{deliverableId}/packet` — evidence packet
- `GET /api/traceability/{deliverableId}/export?format=pdf|md` — packet export
- supersession 이벤트는 source ingestion(FOUNDATION) 훅에서 stale propagation 트리거

### 4.4 의존성

- SPEC-REGULA-FOUNDATION-001 (source_sections, citations, messages, audit_logs, pgvector)
- SPEC-REGULA-WORKFLOWS-001 (workflow_runs, draft 산출물)
- #35 Knowledge Gap Ops (open gap 연동)
- #36 Review Ops (expert_reviews, reviewed_by edge)
- #37 Submission Lifecycle (submission_packages, exported_in edge)
- #41 Impact Tracker (regulatory update supersession)
- #46 ISO 14971 Risk (risk_items, mitigates edge)

---

## §5 Implementation Notes (As-Implemented)

### 5.1 구현 개요 (Implementation Summary)

本 SPEC은 2026-06-23 PR #242 (commit `c76cd05`)으로 메인 브랜치에 머지 완료되었다. Issue #47은 CLOSED/COMPLETED 상태다.

#### 구현 범위

1. **데이터베이스 마이그레이션** (`0068_traceability.sql`):
   - `evidence_nodes`: 7가지 노드 타입 (source_section, citation, message, workflow_run, expert_review, submission_package, risk_item)
   - `evidence_edges`: 6가지 관계 타입 (derived_from, cites, reviewed_by, exported_in, mitigates, satisfies)
   - `stale_flags`: supersession 전파 추적
   - Enum 타입: `evidence_node_type`, `edge_relation`
   - RLS: org-isolation (organization_id 기반)
   - audit_logs 확장: +4 actions (edge create/modify/delete + stale propagate)

2. **권한 체계**:
   - `traceability.manage`: RA Lead 전용 (edge 생성/수정/삭제)
   - `traceability.view`: RA Member 이상 (조회)

3. **백엔드 구현** (`lib/traceability/` 8개 모듈):
   - `graph.ts`: IDOR 3-layer 방어 (node isolation, edge validation, RBAC), BFS 기반 그래프 순회
   - `matrix.ts`: 행/열 집계, gap 검출 (missing citations, stale sources, unresolved reviews)
   - `stale-propagation.ts`: BFS 멱등성 보장 전파 (propagation 트리에서 이미 방문한 노드 스킵)
   - `evidence-packet.ts`: 답변/CER/PCCP/510(k)/risk 항목별 근거 패킷 조립
   - `export-packet.ts`: PDF/Markdown export (jspdf + marked 라이브러리)
   - `verify-edges.ts`: replay/eval 시나리오 edge 무결성 검증
   - `hooks.ts`: supersession 이벤트 리스너 (구현 완료, wiring 이월 - AC-05 DEFERRED 참조)
   - `stale-reason.ts`: stale 플래그 사유 분류

4. **API 엔드포인트** (4종):
   - `GET /api/traceability`: matrix 조회 (projectId, jurisdiction, product, package, risk level, stale 필터)
   - `POST /api/traceability/edges`: edge 생성/수정 (RBAC + audit)
   - `GET /api/traceability/[id]/packet`: evidence packet 조회
   - `GET /api/traceability/[id]/export?format=pdf|md`: packet export
   - **주의**: 기존 #169 `/api/ra/traceability` BFF와 엄격 분리 (RA domain vs. Traceability domain)

5. **프론트엔드 구현** (`app/(app)/traceability/`):
   - **Matrix UI**: 행(요구사항/규제 요구사항/위험 항목/제출 섹션) × 열(근거 출처/생성 답변/reviewer decision/export artifact/open gap)
   - **Packet View**: 개별 산출물별 근거 패킷 상세 보기
   - **Client Islands**: 4개 (matrix-filter-island, matrix-view-island, packet-detail-island, export-controls-island)
   - **Sidebar 네비게이션**: 조건부 표시 (traceability.manage 권한 시에만)
   - **WCAG 2.1 AA**: icon+text 병행, ARIA tree role, keyboard navigation

6. **보안/품질 리뷰**:
   - **evaluator-active**: PASS-WITH-CONDITIONS (3건 조건부 통과)
   - **expert-security**: BLOCK-MERGE 7건 (C1~W2) 수정 후 통과
     - C1: path traversal defense (node ref_id 정규화)
     - W1: insufficient audit context (actor_ip, user_agent 추가)
     - W2: stale propagation 재진입 가능성 (BFS 방문 세트 추가)
   - **Hardening 2건**:
     - L3: `writeAudit` 트랜잭션 파라미터 누락 (tx param 추가)
     - L4: `db.transaction` 래핑 누락 (21 CFR Part 11 감사 무결성 보장)

7. **회귀 베이스라인 갱신**:
   - migration: 67 → 68 (+0068_traceability.sql)
   - PermissionAction: 43 → 44 (+traceability.manage)
   - audit_action: 114 → 118 (+4: traceability.edge_created/modified/deleted + stale_propagated)
   - enterprise-migrations: +1 (0068)

8. **검증 결과**:
   - `npm run typecheck`: PASS
   - `npm run biome check`: PASS
   - `npm run build`: PASS
   - 전체 테스트 스위트: **3304 passed | 7 skipped** (0 failed)

### 5.2 Acceptance Criteria 구현 상태 (AC Status)

| AC# | Criterion | Status | 비고 |
|-----|-----------|--------|------|
| AC-01 | source → answer/draft → review → export artifact 관계가 graph로 저장된다 | ✅ 구현 완료 | evidence_nodes + evidence_edges, audit Trails |
| AC-02 | 프로젝트별 traceability matrix UI가 제공되고 필터가 동작한다 | ✅ 구현 완료 | matrix view + 6종 필터 |
| AC-03 | citation 누락·stale source·unresolved review가 matrix에서 표시된다 | ✅ 구현 완료 | gap detection (missing citations, stale flags, unresolved reviews) |
| AC-04 | evidence packet PDF/Markdown export가 가능하다 | ✅ 구현 완료 | export-packet.ts (jspdf for PDF, marked for MD) |
| AC-05 | source supersession 시 영향받는 산출물이 stale로 표시된다 | ⏸️ DEFERRED(W1) | **hook 구현 완료, wiring만 이월** (의존: #45 delta-sync write path, #238) |
| AC-06 | 모든 traceability 변경이 audit_logs에 남는다 | ✅ 구현 완료 | +4 audit actions, writeAudit tx param |
| AC-07 | replay/eval 시나리오가 traceability edge를 검증한다 | ✅ 구현 완료 | verify-edges.ts (순환 검증, orphan 노드 검출) |
| AC-08 | source 미연결 산출물이 open evidence gap으로 표시된다 | ✅ 구현 완료 | matrix.ts gap detection (no-linked-source 플래그) |

**참고**: AC-05는 #45 (delta-sync write path) 완료 후 #238 이슈에서 supersession hook을 delta-sync pipeline에 wiring하여 완료 예정.

---

## §6 Follow-up Issues (추적 이슈)

본 SPEC 구현과 관련된 후속 작업 이슈들이다. 이미 GitHub에 등록된 상태다.

| Issue ID | 제목 | 내용 | 의존성 |
|-----------|------|------|---------|
| #238 | Wire stale-propagation hook into delta-sync supersession write | AC-05 완료: source supersession 시 delta-sync write path에서 stale propagation hook 호출. hook은 lib/traceability/stale-propagation.ts에 이미 구현됨. | #45 (delta-sync write path) |
| #239 | RLS WITH CHECK clauses + app.current_org_id GUC wiring | 전체 프로젝트 공통: evidence_nodes/evidence_edges 테이블에 WITH CHECK 절 추가 및 app-level GUC(current_org_id) 세팅으로 org isolation 강화. | 전체 레포 |
| #240 | Matrix read reuses generic dashboard.view audit action | L1 최적화: matrix 조회 시 audit action 세분화 (traceability.view vs dashboard.view)로 정확한 감사 추적. | 본 SPEC |
| #241 | Export 502 leaks exporter error detail to client | L2 보안: export 실패 시 서버 내부 오류 디테일이 클라이언트로 누출되는 이슈 수정 (try-catch 래핑, 일반 오류 메시지 반환). | 별도 PR 예정 |
