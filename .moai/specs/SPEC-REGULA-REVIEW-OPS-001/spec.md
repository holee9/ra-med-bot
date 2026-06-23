---
id: SPEC-REGULA-REVIEW-OPS-001
version: 1.0.0
status: draft
phase: wave4
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 36
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
---

# SPEC-REGULA-REVIEW-OPS-001 — 전문가 검토 SLA·승인 워크벤치·증거 패키지

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #36 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

기존 구현과 선행 이슈들은 expert review flag, queue, approval 흐름을 이미 포함하고 있다. 그러나 단순 큐 구조만으로는 RA 리드가 실제 검토 업무를 SLA 기반으로 운영하기 어렵다. 플래그된 답변과 생성된 제출 초안이 적시에 판정되지 않으면 규제 리스크가 누적되며, 검토 근거가 구조화되지 않으면 동일한 결함이 반복된다.

본 SPEC은 단순 큐를 넘어 RA 검토자가 실제 검토 업무를 운영할 수 있는 워크벤치를 정의한다. 검토자는 플래그된 답변과 제출 초안을 SLA 기한 안에서 우선순위에 따라 판정하고, Evidence Packet을 통해 검토 근거를 한 화면에서 확인하며, 승인/반려 결과를 audit 가능한 품질 데이터로 축적한다.

검토 결정(approve / request changes / reject / knowledge gap)은 모두 reviewer 신원, timestamp, 사유와 함께 audit_logs에 기록되어야 하며, 승인되지 않은 산출물은 downstream export에서 서버 측으로 차단된다. 또한 반복 반려 사유와 결함 카테고리를 집계하여 Knowledge Gap Ops(#35)로 넘길 수 있는 action을 자동 생성한다.

이를 통해 Regula는 답변 생성기를 넘어 audit-ready RA 검토 운영 도구로 발전한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 21 CFR Part 820 (Quality System Regulation) — design review 및 record 통제
- ISO 13485:2016 §7.3 (Design and Development Review), §4.2.4 (Control of Records)
- ISO/IEC 62304 (소프트웨어 라이프사이클 검토 근거)
- 검토 결정 audit trail은 21 CFR Part 11 record integrity 원칙을 준수 (단, 전자서명 full validation은 범위 외)

### 1.3 본 SPEC의 범위 (In Scope)

- SLA 기반 검토 운영: review item priority 산정(high-risk keyword, confidence, submission impact, due date), SLA 상태(on-track / due-soon / overdue), reviewer assignment·reassignment·escalation audit
- Evidence Packet: 검토 대상 답변/초안, citation list, source excerpts, confidence rationale, related regulatory updates를 한 화면에 묶어 제공. draft diff 비교, citation mismatch·stale source·missing source 태깅
- 승인/반려 결정: approve / request changes / reject / mark as knowledge gap, 모든 결정의 audit 기록
- 검토 품질 데이터: 반복 반려 사유 통계, 모델/프롬프트/코퍼스별 defect category 집계, Knowledge Gap Ops handoff action 생성

### 1.4 Out of Scope

- 전자서명 Part 11 full validation package
- 외부 reviewer portal
- 다기관 reviewer marketplace

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-REVIEW-OPS-001 | WHEN a flagged answer or submission draft enters the review queue THE SYSTEM SHALL compute a review priority from high-risk keyword, confidence, submission impact, and due date | High |
| REQ-REVIEW-OPS-002 | WHEN a review item is displayed THE SYSTEM SHALL show its SLA status as one of on-track, due-soon, or overdue | High |
| REQ-REVIEW-OPS-003 | THE SYSTEM SHALL allow a RA reviewer to sort and filter the review queue by SLA status, priority, and product | High |
| REQ-REVIEW-OPS-004 | WHEN a reviewer is assigned, reassigned, or escalated THE SYSTEM SHALL record the action in audit_logs with reviewer identity and timestamp | High |
| REQ-REVIEW-OPS-005 | WHEN a review item is opened THE SYSTEM SHALL render an Evidence Packet containing the target answer/draft, citation list, source excerpts, confidence rationale, and related regulatory updates | High |
| REQ-REVIEW-OPS-006 | WHERE a user-edited draft differs from the original generated draft THE SYSTEM SHALL display a diff between the two versions | Medium |
| REQ-REVIEW-OPS-007 | THE SYSTEM SHALL allow a reviewer to tag citation mismatch, stale source, and missing source on a review item | Medium |
| REQ-REVIEW-OPS-008 | WHEN a reviewer submits a decision THE SYSTEM SHALL accept one of approve, request changes, reject, or mark as knowledge gap | High |
| REQ-REVIEW-OPS-009 | WHEN a review decision is recorded THE SYSTEM SHALL persist audit_logs entry, reviewer identity, timestamp, and reason as mandatory fields | High |
| REQ-REVIEW-OPS-010 | IF an answer or draft has not been approved THEN THE SYSTEM SHALL block its export at the server side and mark it not reviewable | High |
| REQ-REVIEW-OPS-011 | WHEN review decisions accumulate THE SYSTEM SHALL aggregate repeated rejection reasons and defect categories by model, prompt, and corpus | Medium |
| REQ-REVIEW-OPS-012 | WHEN a review item is marked as knowledge gap THE SYSTEM SHALL generate a handoff action targeting Knowledge Gap Ops (#35) | Medium |
| REQ-REVIEW-OPS-013 | IF a non-reviewer role attempts to record a review decision THEN THE SYSTEM SHALL deny the action and log the unauthorized attempt | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | RA reviewer가 SLA 기준(on-track/due-soon/overdue)으로 queue를 정렬·필터링할 수 있다 | Test / Review |
| AC-02 | 각 review item에 Evidence Packet(답변/초안, citation, source excerpt, confidence rationale, regulatory updates)이 표시된다 | Review |
| AC-03 | approve/request changes/reject/knowledge gap 전환이 reviewer identity·timestamp·reason과 함께 audit_logs에 저장된다 | Test |
| AC-04 | 승인되지 않은 산출물의 export가 서버 측에서 차단된다 (클라이언트 우회 불가) | Test |
| AC-05 | 반복 결함 통계(반려 사유·defect category)가 dashboard 또는 admin view에 노출된다 | Review |
| AC-06 | knowledge gap 결정 시 #35 handoff action이 생성된다 | Test |
| AC-07 | 권한 없는 역할의 검토 결정 시도가 거부되고 audit에 기록된다 | Test |
| AC-08 | reviewer assignment/reassignment/escalation이 audit trail에 남는다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/
    (dashboard)/review/
      page.tsx                # review queue 워크벤치 (SLA 정렬·필터)
      [reviewId]/page.tsx     # Evidence Packet + 결정 UI
    api/review/
      route.ts                # queue 조회 (priority, SLA 계산)
      [reviewId]/decision/route.ts  # 결정 기록 + audit
      [reviewId]/assign/route.ts    # assignment/escalation
  lib/review/
    sla.ts                    # priority·SLA 상태 산정
    evidence-packet.ts        # Evidence Packet 조립
    defect-stats.ts           # 반복 결함 집계
  db/schema/review.ts         # review_items, review_decisions, review_tags
```

### 4.2 DB Schema

- `review_items`: id, target_type (answer|draft), target_id, priority_score, sla_status, due_at, assigned_reviewer_id, status, created_at
- `review_decisions`: id, review_item_id, reviewer_id, decision (approve|request_changes|reject|knowledge_gap), reason, created_at
- `review_tags`: id, review_item_id, tag_type (citation_mismatch|stale_source|missing_source), citation_ref, created_by
- `review_assignments`: id, review_item_id, reviewer_id, action (assign|reassign|escalate), actor_id, created_at
- audit_logs는 기존 테이블 재사용 — 모든 결정/할당/태깅 이벤트 기록

### 4.3 API Endpoints

- `GET /api/review` — SLA·priority 정렬, jurisdiction/product/sla_status 필터
- `GET /api/review/{reviewId}` — Evidence Packet 반환
- `POST /api/review/{reviewId}/decision` — 결정 기록 (RBAC: reviewer/ra-lead), audit 강제
- `POST /api/review/{reviewId}/assign` — assignment/reassign/escalate
- `POST /api/review/{reviewId}/tags` — citation/source 태깅
- export 경로(SUBMISSION-LIFECYCLE)는 `reviewed=true` 서버 검증 추가

### 4.4 의존성

- SPEC-REGULA-FOUNDATION-001 (audit_logs, RBAC, source/citation 모델)
- SPEC-REGULA-WORKFLOWS-001 (draft 생성 산출물, workflow_runs)
- #23 CER Builder, #24 PCCP Builder (검토 대상 draft 공급)
- #35 Knowledge Gap Ops (handoff 대상)
