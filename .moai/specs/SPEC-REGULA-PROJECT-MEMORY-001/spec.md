---
id: SPEC-REGULA-PROJECT-MEMORY-001
version: 1.0.0
status: draft
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 51
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-BREADTH-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/rag
  - component/frontend
---

# SPEC-REGULA-PROJECT-MEMORY-001 — 프로젝트 지속 컨텍스트 메모리 (의사결정 누적 & 크로스 세션 기억)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #51 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

현재 Regula의 대화(conversation)는 각각 독립적이다. 같은 프로젝트 내에서도 이전 세션에서 결정한 디바이스 분류(device classification)나 목표 시장(target market) 전략을 새 대화에서 AI가 기억하지 못한다. 사용자는 매 대화마다 동일한 컨텍스트를 반복 입력해야 하며, 이는 비효율을 넘어 규제 일관성을 위협한다.

의료기기 개발 프로젝트는 수년에 걸쳐 진행된다. 디바이스 분류, 목표 시장, 심사 전략, predicate device 같은 핵심 의사결정은 프로젝트 수명 전반에 걸쳐 일관되게 유지되어야 한다. 프로젝트 범위의 누적 컨텍스트는 단순 편의 기능이 아니라 규제 일관성의 핵심이다.

본 SPEC은 프로젝트 단위로 RA 의사결정 메모리를 누적하고, 새 대화 시작 시 프로젝트 컨텍스트를 자동 주입하며, RA Lead가 프로젝트 메모리를 명시적으로 편집/검토할 수 있게 하고, 메모리 변경 이력을 감사 목적으로 추적하도록 만든다.

AI는 대화에서 의사결정을 감지하면 메모리 업데이트를 제안하되, 자동 확정이 아닌 사용자 검토를 거치도록 설계한다. 이는 잘못된 자동 판단이 프로젝트 컨텍스트를 오염시키는 것을 방지한다.

### 1.2 규제 근거 (Regulatory Anchor)

- 규제 제출물의 일관성은 ISO 13485 및 design control(21 CFR 820.30)의 요구이다. 디바이스 분류, 위험 등급(risk class), predicate device 결정은 프로젝트 전반에서 일관되게 유지되어야 한다.
- 21 CFR Part 11에 따라 프로젝트 메모리의 생성·수정·무효화 이력은 감사 가능해야 한다.
- 팀원 교체 시 컨텍스트 유실은 규제 일관성 리스크이며, 본 SPEC의 메모리 누적이 이를 완화한다.

### 1.3 본 SPEC의 범위 (In Scope)

- 프로젝트 단위 RA 의사결정 메모리 누적 (`project_memory` 테이블)
- memoryType enum: device_classification, target_markets, submission_strategy, predicate_device, risk_class, custom
- 새 대화 시작 시 project memory 자동 주입 (시스템 프롬프트 앞부분)
- AI 의사결정 감지 시 메모리 업데이트 제안
- 프로젝트 메모리 관리 UI (편집/검토)
- 감사 로그: memory_created, memory_updated, memory_invalidated

### 1.4 Out of Scope

- 프로젝트 간 메모리 공유/상속
- 메모리 자동 확정 (사용자 검토 없는 자동 적용 금지)
- 메모리 충돌 자동 해소 (충돌 시 사용자 판단에 위임)
- 외부 PLM/QMS 시스템과의 메모리 동기화

---

## §2 Requirements (EARS Format)

### REQ-PROJECT-MEMORY: 메모리 누적·주입·편집·감사

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-PROJECT-MEMORY-001 | THE SYSTEM SHALL `project_memory` 테이블에 id, projectId, memoryType, key, value, sourceConversationId, createdBy, validFrom, validUntil를 관리한다 | High |
| REQ-PROJECT-MEMORY-002 | THE SYSTEM SHALL memoryType을 device_classification, target_markets, submission_strategy, predicate_device, risk_class, custom enum으로 제한한다 | High |
| REQ-PROJECT-MEMORY-003 | WHEN 새 대화가 시작될 때 THE SYSTEM SHALL 해당 프로젝트의 유효한(validFrom~validUntil 범위 내) project memory를 시스템 프롬프트 앞부분에 자동 주입한다 | High |
| REQ-PROJECT-MEMORY-004 | WHEN AI가 대화에서 의사결정을 감지할 때 THE SYSTEM SHALL 메모리 업데이트를 제안한다 | High |
| REQ-PROJECT-MEMORY-005 | THE SYSTEM SHALL AI가 제안한 메모리 업데이트를 사용자 검토 없이 자동 확정하지 않는다 | High |
| REQ-PROJECT-MEMORY-006 | WHERE RA Lead가 프로젝트 메모리 관리 UI를 사용할 때 THE SYSTEM SHALL 메모리 항목의 편집/검토 기능을 제공한다 | High |
| REQ-PROJECT-MEMORY-007 | WHEN 메모리가 생성될 때 THE SYSTEM SHALL audit_logs에 memory_created 이벤트를 기록한다 | High |
| REQ-PROJECT-MEMORY-008 | WHEN 메모리가 수정될 때 THE SYSTEM SHALL audit_logs에 memory_updated 이벤트를 기록한다 | High |
| REQ-PROJECT-MEMORY-009 | WHEN 메모리가 무효화(invalidate)될 때 THE SYSTEM SHALL validUntil을 설정하고 audit_logs에 memory_invalidated 이벤트를 기록한다 | High |
| REQ-PROJECT-MEMORY-010 | WHEN 메모리를 주입할 때 THE SYSTEM SHALL validUntil이 만료된 메모리를 주입 대상에서 제외한다 | High |
| REQ-PROJECT-MEMORY-011 | IF 메모리 편집을 요청한 사용자의 권한이 부족하면 THEN THE SYSTEM SHALL 편집을 거부하고 audit_logs에 기록한다 | High |
| REQ-PROJECT-MEMORY-012 | WHERE 동일 projectId 및 동일 key의 메모리가 갱신될 때 THE SYSTEM SHALL 기존 메모리를 무효화하고 새 메모리를 생성하여 변경 이력을 보존한다 | Medium |
| REQ-PROJECT-MEMORY-013 | THE SYSTEM SHALL sourceConversationId를 통해 메모리의 출처 대화를 추적 가능하게 한다 | Medium |
| REQ-PROJECT-MEMORY-014 | WHEN 사용자가 AI 제안 메모리를 승인할 때 THE SYSTEM SHALL 해당 메모리를 project_memory에 반영하고 createdBy를 기록한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | project_memory 테이블이 6종 memoryType으로 메모리를 저장하고 조회한다 | Test |
| AC-02 | 새 대화 시작 시 해당 프로젝트의 유효한 메모리가 시스템 프롬프트에 자동 주입된다 | Test |
| AC-03 | AI가 대화에서 디바이스 분류 결정을 감지하면 메모리 업데이트를 제안하되 자동 확정하지 않는다 | Test |
| AC-04 | RA Lead가 메모리 관리 UI에서 메모리를 편집/검토할 수 있다 | Test / Review |
| AC-05 | memory_created/updated/invalidated 이벤트가 audit_logs에 기록된다 | Test |
| AC-06 | validUntil이 만료된 메모리가 주입 대상에서 제외된다 | Test |
| AC-07 | 동일 key 메모리 갱신 시 기존 메모리가 무효화되고 변경 이력이 보존된다 | Test |
| AC-08 | 권한 없는 사용자의 메모리 편집이 거부되고 audit_logs에 기록된다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `lib/db/schema/project-memory.ts` — 프로젝트 메모리 스키마
- `lib/project-memory/injector.ts` — 시스템 프롬프트 메모리 주입기
- `lib/project-memory/extractor.ts` — AI 의사결정 감지 및 메모리 제안
- `lib/project-memory/manager.ts` — 메모리 생성/수정/무효화 + 이력 보존
- `app/api/project-memory/route.ts` — 메모리 CRUD API
- `app/api/project-memory/suggest/route.ts` — AI 제안 승인 API
- `app/(app)/projects/[id]/memory/page.tsx` — 프로젝트 메모리 관리 UI

### 4.2 DB Schema

- 신규 테이블 `project_memory`: id, project_id, memory_type(enum: device_classification/target_markets/submission_strategy/predicate_device/risk_class/custom), key, value, source_conversation_id, created_by, valid_from, valid_until
- 인덱스: (project_id, key, valid_until) — 유효 메모리 조회 최적화
- audit_logs 활용: 신규 action `memory_created`, `memory_updated`, `memory_invalidated`

### 4.3 API Endpoints

- `GET /api/project-memory?projectId=` — 프로젝트 유효 메모리 조회
- `POST /api/project-memory` — 메모리 생성 (RBAC: ra-lead)
- `PATCH /api/project-memory/:id` — 메모리 수정 (RBAC: ra-lead)
- `DELETE /api/project-memory/:id` — 메모리 무효화 (RBAC: ra-lead)
- `POST /api/project-memory/suggest/approve` — AI 제안 승인

### 4.4 의존성

- 기존 SPEC: SPEC-REGULA-BREADTH-001(projects 테이블 — 완료), SPEC-REGULA-FOUNDATION-001(audit_logs, RBAC), SPEC-REGULA-CHAT-001(conversation, 시스템 프롬프트 파이프라인)
- 외부 이슈 보완 관계: #47 Evidence Traceability(메모리 출처 추적)
- 외부: LLM(의사결정 감지/추출)
