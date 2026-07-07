---
id: SPEC-REGULA-KNOWLEDGE-PROMO-001
version: 1.0.0
status: completed
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 50
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-KNOWLEDGE-GAP-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/rag
  - component/frontend
---

# SPEC-REGULA-KNOWLEDGE-PROMO-001 — 대화 시맨틱 검색 & 우수 답변 팀 지식 승격

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #50 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Phase 1-9 완료 후 Regula는 수천 건의 규제 Q&A 대화를 축적하게 된다. 그러나 현재 구조에서는 이 대화들이 사용자 개인 히스토리에만 머물며, 팀 전체의 집단 지성으로 승화되지 않는다. 예를 들어 RA Lead가 1년 전 작성한 완벽한 FDA 510(k) 실질동등성(substantial equivalence) 답변이 있어도, 다른 팀원은 같은 질문을 다시 던지고 처음부터 답을 만들어야 한다.

이는 조직 차원에서 중대한 지식 낭비이다. 기관 고유의 사내 판례(precedent)가 누적되지 못하면, 동일 질문에 대해 팀원마다 다른 답을 받게 되어 규제 당국 대응 시 일관성이 깨질 위험이 있다.

본 SPEC은 전체 조직 대화에 대한 시맨틱 검색(키워드 + 의미 기반)을 지원하고, RA Lead/Admin이 우수 답변을 팀 지식 라이브러리로 승격할 수 있게 하며, 승격된 답변을 RAG 검색 시 우선 표시 및 citation으로 활용하도록 만든다. 이를 통해 기관 고유의 사내 판례가 누적되어 답변 품질이 지속적으로 향상된다.

승격은 권한이 통제되어야 한다. ra-lead/admin만 승격할 수 있고, 모든 멤버가 열람할 수 있으며, 승격 행위는 감사 로그로 추적된다.

### 1.2 규제 근거 (Regulatory Anchor)

- 규제 당국 대응의 일관성(consistency)은 ISO 13485 품질 시스템의 핵심 원칙이다. 승격된 사내 판례는 동일 입장 유지를 위한 통제된 지식 자산이 된다.
- 21 CFR Part 11에 따라 지식 승격(promotion) 행위는 누가·언제·무엇을 승격했는지 감사 가능해야 한다.
- 승격된 답변이 RAG citation으로 활용될 때, 그 출처(원본 message)가 추적 가능해야 규제 제출물의 근거 추적성(traceability)을 만족한다.

### 1.3 본 SPEC의 범위 (In Scope)

- 조직 전체 대화에 대한 full-text + 시맨틱 검색 API
- 답변 승격 UI (메시지 단위 / 대화 단위 승격 버튼)
- 승격된 답변 전용 테이블 (`promoted_answers`)
- RAG 파이프라인에 promoted_answers retriever 추가 (내부 문서보다 높은 가중치)
- 지식 라이브러리 뷰 (Personal Library 페이지 확장)
- 승격 감사 로그
- RBAC: ra-lead/admin만 승격 가능, 전 멤버 열람 가능

### 1.4 Out of Scope

- 외부 조직 간 지식 공유
- 승격 답변의 자동 만료/재검증 (별도 후속 SPEC, #48 source governance와 연계 검토)
- 승격 답변에 대한 협업 편집 (SPEC-REGULA-COEDIT-001 영역)
- 승격 우선순위 자동 학습 (RLHF #56 영역)

---

## §2 Requirements (EARS Format)

### REQ-KNOWLEDGE-PROMO: 시맨틱 검색·승격·RAG 통합·RBAC

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-KNOWLEDGE-PROMO-001 | THE SYSTEM SHALL 조직 전체 대화에 대한 full-text 검색 API를 제공한다 | High |
| REQ-KNOWLEDGE-PROMO-002 | THE SYSTEM SHALL 조직 전체 대화에 대한 시맨틱(의미 기반) 검색 API를 제공한다 | High |
| REQ-KNOWLEDGE-PROMO-003 | WHEN 사용자가 검색을 수행할 때 THE SYSTEM SHALL 자신의 org 범위 내 대화만 결과로 반환한다 | High |
| REQ-KNOWLEDGE-PROMO-004 | WHERE 사용자가 메시지 단위로 승격을 요청할 때 THE SYSTEM SHALL 해당 메시지를 승격 대상으로 처리하는 UI를 제공한다 | High |
| REQ-KNOWLEDGE-PROMO-005 | WHERE 사용자가 대화 단위로 승격을 요청할 때 THE SYSTEM SHALL 해당 대화를 승격 대상으로 처리하는 UI를 제공한다 | Medium |
| REQ-KNOWLEDGE-PROMO-006 | WHEN 답변이 승격될 때 THE SYSTEM SHALL `promoted_answers` 테이블에 id, orgId, sourceMessageId, title, tags, promotedBy, promotedAt를 기록한다 | High |
| REQ-KNOWLEDGE-PROMO-007 | IF 승격을 요청한 사용자의 역할이 ra-lead 또는 admin이 아니면 THEN THE SYSTEM SHALL 승격을 거부한다 | High |
| REQ-KNOWLEDGE-PROMO-008 | THE SYSTEM SHALL org의 전 멤버가 승격된 답변을 열람할 수 있도록 허용한다 | High |
| REQ-KNOWLEDGE-PROMO-009 | WHEN RAG 검색을 수행할 때 THE SYSTEM SHALL promoted_answers retriever를 포함하여 검색한다 | High |
| REQ-KNOWLEDGE-PROMO-010 | WHERE promoted answer가 검색될 때 THE SYSTEM SHALL 내부 문서보다 높은 가중치를 부여한다 | High |
| REQ-KNOWLEDGE-PROMO-011 | WHEN promoted answer가 citation으로 사용될 때 THE SYSTEM SHALL 원본 sourceMessageId로 추적 가능한 citation을 생성한다 | High |
| REQ-KNOWLEDGE-PROMO-012 | THE SYSTEM SHALL 지식 라이브러리 뷰에서 승격된 답변 목록을 title/tags로 탐색 가능하게 표시한다 | Medium |
| REQ-KNOWLEDGE-PROMO-013 | WHEN 답변이 승격될 때 THE SYSTEM SHALL audit_logs에 승격 action(누가·무엇을·언제)을 기록한다 | High |
| REQ-KNOWLEDGE-PROMO-014 | WHEN 승격이 취소(unpromote)될 때 THE SYSTEM SHALL audit_logs에 취소 action을 기록하고 RAG 검색에서 제외한다 | Medium |
| REQ-KNOWLEDGE-PROMO-015 | THE SYSTEM SHALL 승격 시 부여한 tags로 promoted_answers를 필터링하는 기능을 제공한다 | Low |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | full-text 검색과 시맨틱 검색 API가 org 범위 내 대화를 반환하고, 타 org 대화는 노출되지 않는다 | Test |
| AC-02 | ra-lead/admin이 메시지 단위 및 대화 단위로 답변을 승격하면 promoted_answers에 레코드가 생성된다 | Test |
| AC-03 | ra-lead/admin이 아닌 멤버가 승격을 시도하면 거부되고 audit_logs에 기록된다 | Test |
| AC-04 | 승격된 답변이 RAG 검색에서 내부 문서보다 높은 가중치로 우선 표시된다 | Test |
| AC-05 | 승격된 답변이 citation으로 사용될 때 원본 sourceMessageId로 추적된다 | Test |
| AC-06 | 전 멤버가 지식 라이브러리 뷰에서 승격된 답변을 열람할 수 있다 | Test / Review |
| AC-07 | 승격/취소 action이 audit_logs에 기록된다 | Test |
| AC-08 | unpromote된 답변이 RAG 검색 결과에서 제외된다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `lib/db/schema/promoted-answers.ts` — 승격 답변 스키마
- `lib/knowledge-promo/semantic-search.ts` — full-text + 시맨틱 검색 (pgvector)
- `lib/knowledge-promo/promote.ts` — 메시지/대화 승격 로직 + RBAC 검증
- `lib/rag/retrievers/promoted-answers-retriever.ts` — RAG 가중치 retriever
- `app/api/knowledge-promo/search/route.ts` — 조직 대화 검색 API
- `app/api/knowledge-promo/promote/route.ts` — 승격/취소 API
- `components/answer-block/promote-button.tsx` — 승격 UI 버튼
- `app/(app)/library/page.tsx` — 지식 라이브러리 뷰 (Personal Library 확장)

### 4.2 DB Schema

- 신규 테이블 `promoted_answers`: id, org_id, source_message_id, title, tags(array), promoted_by, promoted_at, status(enum: active/unpromoted)
- 대화/메시지 검색용 pgvector 인덱스 (기존 임베딩 활용 또는 신규 임베딩 컬럼)
- audit_logs 활용: 신규 action `answer_promoted`, `answer_unpromoted`

### 4.3 API Endpoints

- `GET /api/knowledge-promo/search?q=&mode=fulltext|semantic` — 조직 대화 검색
- `POST /api/knowledge-promo/promote` — 승격 (RBAC: ra-lead/admin)
- `DELETE /api/knowledge-promo/promote/:id` — 승격 취소 (RBAC: ra-lead/admin)
- `GET /api/knowledge-promo/library` — 지식 라이브러리 목록

### 4.4 의존성

- 외부 라이브러리: pgvector (시맨틱 검색), Drizzle ORM
- 기존 SPEC: SPEC-REGULA-FOUNDATION-001(RBAC, audit_logs), SPEC-REGULA-CHAT-001(conversation/message, RAG 파이프라인), SPEC-REGULA-PERSONAL-LIB-001(library 뷰 확장)
- 외부 이슈 의존: #34 Quality Elevation(코퍼스 시드 후 적용)
- 보완 관계: SPEC-REGULA-KNOWLEDGE-GAP-001(#35, 미답변 이슈화 ↔ 우수답변 승격), SPEC-REGULA-RLHF-001(#56, high-rated → 승격 후보 제안)
