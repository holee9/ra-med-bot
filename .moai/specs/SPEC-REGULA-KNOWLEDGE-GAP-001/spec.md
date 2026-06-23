---
id: SPEC-REGULA-KNOWLEDGE-GAP-001
version: 1.0.0
status: draft
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 35
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-RELEASE-HARDENING-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/rag
  - component/ops
---

# SPEC-REGULA-KNOWLEDGE-GAP-001 — 미답변 자동 이슈화 및 지식베이스 보강 루프

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #35 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula는 질의응답, 문서 ingestion, 워크플로우, Predicate/CER/PCCP 작성까지 갖춘 내부 RA(Regulatory Affairs) 운영 시스템을 지향한다. 그러나 현재 시스템은 사용자가 질문을 하고 답을 받는 단방향 도구에 머물러 있으며, 답변하지 못한 질문이 시스템 개선으로 환류되는 폐쇄 루프가 존재하지 않는다.

제품 철학에 명시된 핵심 가치는 "미답변 → Issue → 지식베이스 보강 → 재답변 가능"이라는 지속 개선 루프이다. 현장의 RA 담당자가 던지는 질문은 그 자체로 지식베이스의 빈틈을 드러내는 가장 가치 있는 신호이다. 이 신호를 자동으로 포착하여 추적 가능한 작업 항목으로 전환하지 못하면, 같은 미답변이 반복되고 RA 팀의 신뢰가 저하된다.

본 SPEC은 Regula가 단순 답변 도구가 아니라, 현장 질문을 통해 지식베이스를 지속 보강하는 운영 시스템이 되도록 만드는 후속 SPEC이다. 미답변 감지, GitHub Issue 자동 등록, RA 분류 워크플로우, 일일 Digest, 폐쇄 루프 검증의 5개 축을 구현한다.

미답변 후보 저장 시 사용자 질문 원문에 포함될 수 있는 PII 및 영업비밀을 redaction하여, 규제 도메인의 기밀성 요구를 충족하면서도 추적 가능성을 확보한다.

### 1.2 규제 근거 (Regulatory Anchor)

- 의료기기 품질경영시스템(ISO 13485) 및 21 CFR Part 820은 문서화된 정보의 통제와 지속적 개선(CAPA) 프로세스를 요구한다. 미답변 루프는 지식베이스에 대한 CAPA의 디지털 구현체로 볼 수 있다.
- 21 CFR Part 11(전자기록·전자서명)에 따라 미답변 감지, 분류, 해결 이벤트는 변조 불가능한 audit trail로 기록되어야 한다.
- 질문 원문 저장 시 PII/영업비밀 redaction은 개인정보보호법 및 영업비밀 보호 의무를 충족하기 위한 필수 통제이다.

### 1.3 본 SPEC의 범위 (In Scope)

- 미답변 감지: confidence threshold 미달, citation coverage 미달, 검색 결과 0건, 정책상 답변 불가 조건을 `knowledge_gap` 후보로 기록
- PII/영업비밀 redaction 후 질문 저장 및 `unanswered_queue` 테이블 관리
- 중복 질문 클러스터링 및 기존 GitHub Issue append
- GitHub Issue 자동 등록 (라벨, 본문 메타데이터 포함)
- RA 분류 워크플로우 (4개 분류 카테고리 + audit 기록 + handoff 템플릿)
- 매일 08:00 일일 Digest 생성 및 알림
- 폐쇄 루프 검증: 지식베이스 보강 후 replay test로 resolved 처리
- `expert_review_required`와 `knowledge_gap_required` 플래그 분리

### 1.4 Out of Scope

- 외부 고객용 support ticketing 시스템
- Slack/Jira 양방향 동기화
- 자동 규정 해석 생성 (RA 전문가 판단 대체 금지)
- redaction 알고리즘 자체의 신규 개발 (기존 redaction 유틸리티 재사용 전제)

---

## §2 Requirements (EARS Format)

### REQ-KNOWLEDGE-GAP: 미답변 감지·이슈화·분류·검증

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-KNOWLEDGE-GAP-001 | WHEN 답변 생성 결과의 confidence가 설정된 threshold 미달이거나 citation coverage가 미달이거나 검색 결과가 0건이거나 정책상 답변 불가일 때 THE SYSTEM SHALL 해당 질의를 `knowledge_gap` 후보로 기록한다 | High |
| REQ-KNOWLEDGE-GAP-002 | WHEN 미답변 후보를 저장할 때 THE SYSTEM SHALL 사용자 질문 원문에 PII 및 영업비밀 redaction을 적용한 후 저장하고 redaction hash를 함께 기록한다 | High |
| REQ-KNOWLEDGE-GAP-003 | THE SYSTEM SHALL `expert_review_required`와 `knowledge_gap_required` 플래그를 분리하여 관리한다 | High |
| REQ-KNOWLEDGE-GAP-004 | WHEN 미답변 후보가 기록될 때 THE SYSTEM SHALL `unanswered_queue` 테이블에 항목을 생성한다 | High |
| REQ-KNOWLEDGE-GAP-005 | WHEN 새 미답변 후보가 기존 미답변과 의미상 동일/유사하게 클러스터링될 때 THE SYSTEM SHALL 새 GitHub Issue를 만들지 않고 기존 이슈에 append한다 | High |
| REQ-KNOWLEDGE-GAP-006 | WHEN 신규 미답변 클러스터가 GitHub Issue로 등록될 때 THE SYSTEM SHALL 이슈 본문에 질문 요약, 실패 원인, 누락 출처 후보, 관련 conversation/message id, redaction hash를 포함한다 | High |
| REQ-KNOWLEDGE-GAP-007 | WHEN GitHub Issue를 등록할 때 THE SYSTEM SHALL `knowledge-gap`, `ra-auto`, `needs-classification` 라벨을 부여한다 | Medium |
| REQ-KNOWLEDGE-GAP-008 | WHERE RA 담당자가 분류 워크플로우를 사용할 때 THE SYSTEM SHALL `ra-project 지식 누락`, `MD-process SOP 누락`, `외부 규제 원문 필요`, `제품 버그` 중 하나로 분류하는 UI/API를 제공한다 | High |
| REQ-KNOWLEDGE-GAP-009 | WHEN RA 담당자가 미답변을 분류할 때 THE SYSTEM SHALL 분류 결과를 audit_logs에 기록한다 | High |
| REQ-KNOWLEDGE-GAP-010 | WHERE 분류 완료된 미답변이 담당 저장소/문서 소스로 handoff될 때 THE SYSTEM SHALL handoff용 Markdown 템플릿을 제공한다 | Medium |
| REQ-KNOWLEDGE-GAP-011 | WHEN 매일 08:00이 도래할 때 THE SYSTEM SHALL 전날 미답변 요약 Digest(이메일/알림)를 생성한다 | High |
| REQ-KNOWLEDGE-GAP-012 | WHERE 일일 Digest가 생성될 때 THE SYSTEM SHALL 반복 미답변 top topics, 긴급도, 미처리 SLA를 표시한다 | Medium |
| REQ-KNOWLEDGE-GAP-013 | IF Digest 발송이 실패하면 THEN THE SYSTEM SHALL 발송 실패 사실을 audit_logs에 기록한다 | High |
| REQ-KNOWLEDGE-GAP-014 | WHEN 관련 문서 ingestion이 완료될 때 THE SYSTEM SHALL 동일/유사 질문에 대한 replay test를 생성한다 | High |
| REQ-KNOWLEDGE-GAP-015 | IF replay test가 citation 포함 답변으로 통과하면 THEN THE SYSTEM SHALL 해당 queue item을 resolved 처리하고 GitHub Issue에 근거 문서와 replay 결과를 댓글로 기록한다 | High |
| REQ-KNOWLEDGE-GAP-016 | THE SYSTEM SHALL 미답변 생성, 분류, digest, resolved 이벤트를 모두 audit_logs에 기록한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | confidence/citation/검색0건/정책불가 4개 조건 각각에 대해 미답변 후보가 `unanswered_queue`에 자동 생성된다 | Test |
| AC-02 | PII/영업비밀이 포함된 질문이 redaction된 형태로만 저장되고 redaction hash가 기록된다 | Test |
| AC-03 | 의미상 유사한 미답변 2건이 별도 이슈가 아닌 동일 GitHub Issue에 묶인다 | Test |
| AC-04 | RA 분류 UI/API가 4개 카테고리로 분류를 수행하고 결과가 audit_logs에 남는다 | Test / Review |
| AC-05 | 매일 08:00 스케줄러가 전날 미답변 Digest를 생성하고, 발송 실패 시 audit_logs에 기록한다 | Test |
| AC-06 | 관련 문서 ingestion 후 replay test가 citation 포함 답변으로 통과하면 queue item과 GitHub Issue가 resolved 처리된다 | Test |
| AC-07 | 생성/분류/digest/resolved 4종 이벤트가 모두 audit_logs에서 조회된다 | Test |
| AC-08 | 권한 없는 사용자가 분류 API를 호출하면 거부되고 audit_logs에 거부 기록이 남는다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `lib/db/schema/unanswered-queue.ts` — 미답변 큐 스키마
- `lib/knowledge-gap/detector.ts` — 미답변 감지 로직 (confidence/citation/검색/정책)
- `lib/knowledge-gap/redaction.ts` — PII/영업비밀 redaction 래퍼 (기존 유틸 재사용)
- `lib/knowledge-gap/clustering.ts` — 중복 질문 클러스터링
- `lib/knowledge-gap/github-issue.ts` — GitHub Issue 등록/append
- `lib/knowledge-gap/digest.ts` — 일일 Digest 생성
- `lib/knowledge-gap/replay.ts` — 폐쇄 루프 replay test 생성/검증
- `app/api/knowledge-gap/classify/route.ts` — RA 분류 API
- `app/(app)/knowledge-gap/page.tsx` — RA 분류 워크플로우 UI
- `templates/knowledge-gap-handoff.md` — handoff Markdown 템플릿

### 4.2 DB Schema

- 신규 테이블 `unanswered_queue`: id, org_id, conversation_id, message_id, redacted_question, redaction_hash, gap_reason(enum: low_confidence/low_citation/no_results/policy_blocked), cluster_id, github_issue_number, classification(enum), status(enum: open/classified/resolved), created_at, resolved_at
- 신규 플래그 컬럼: messages 테이블에 `knowledge_gap_required` boolean 추가 (기존 `expert_review_required`와 분리)
- audit_logs 활용: 신규 action 값 `knowledge_gap_created`, `knowledge_gap_classified`, `knowledge_gap_digest_sent`, `knowledge_gap_resolved`

### 4.3 API Endpoints

- `POST /api/knowledge-gap/classify` — RA 담당자 분류 (RBAC: ra-lead/admin)
- `GET /api/knowledge-gap/queue` — 미답변 큐 조회
- `POST /api/knowledge-gap/replay/:queueId` — replay test 실행
- 내부 cron: 매일 08:00 digest 작업

### 4.4 의존성

- 외부: GitHub API (이슈 생성/append/댓글), 이메일/알림 채널, 스케줄러(cron)
- 기존 SPEC: SPEC-REGULA-FOUNDATION-001(audit_logs, RBAC), SPEC-REGULA-CHAT-001(conversation/message), SPEC-REGULA-DOCINGEST-001(ingestion 완료 이벤트), SPEC-REGULA-RELEASE-HARDENING-001
- 보완 관계: SPEC-REGULA-KNOWLEDGE-PROMO-001(#50, 우수답변 승격 — 미답변과 반대 방향), SPEC-REGULA-SOURCE-GOVERNANCE-001(#48, source 변경 시 gap 영향 표시)
