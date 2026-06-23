---
id: SPEC-REGULA-TRACEABILITY-001
version: 1.0.0
status: draft
phase: wave4
priority: High
created: 2026-06-22
updated: 2026-06-22
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
