---
id: SPEC-REGULA-RLHF-001
version: 1.0.0
status: completed
phase: wave4
priority: Medium
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 56
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-KNOWLEDGE-GAP-001
  - SPEC-REGULA-KNOWLEDGE-PROMO-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/rag
  - component/frontend
---

# SPEC-REGULA-RLHF-001 — 사용자 피드백 기반 RAG 품질 연속 개선 (Answer Quality RLHF Loop)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #56 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

현재 Regula의 RAG 품질 평가는 오프라인 eval harness(promptfoo)에만 의존한다. 실제 사용자가 만족하거나 불만족하는 답변 패턴이 시스템 개선에 반영되지 않는다. 오프라인 eval은 사전에 정의된 시나리오만 측정하므로, 실제 현장에서 RA 전문가가 어떤 답변을 신뢰하고 어떤 답변을 거부하는지는 포착하지 못한다.

의료기기 규제 도메인은 매우 전문적이어서 오프라인 eval만으로는 실제 사용 품질을 충분히 측정할 수 없다. RA 전문가의 인라인 피드백이 가장 가치 있는 품질 신호이다. 엄지 위/아래 평가와 상세 품질 태그(citation 누락, 답변 불완전, 관할권 불일치 등)는 RAG 파이프라인 개선을 위한 직접적이고 도메인 특화된 데이터를 제공한다.

본 SPEC은 인라인 답변 평가를 수집하고, 저품질 답변을 자동 플래그하여 knowledge gap 이슈화(#35 연계)하며, 피드백 데이터로 retrieval 가중치를 조정(retrieval re-ranking)하고, 고품질 답변을 자동 프로모션 후보로 제안(#50 연계)하는 RLHF 루프를 구현한다.

피드백 이벤트는 Langfuse에 전송되어 LLM trace 품질 추적과 연결되며, 질문 유형별·코퍼스별 품질 히트맵 대시보드로 가시화된다.

### 1.2 규제 근거 (Regulatory Anchor)

- 지속적 개선(continuous improvement)은 ISO 13485의 핵심 요구이다. 사용자 피드백 루프는 RAG 품질에 대한 CAPA 입력 신호로 기능한다.
- retrieval 가중치 조정 및 모델/프롬프트 변경은 버전 메타데이터와 rollback 가능성을 보장해야 규제 환경에서 변경 통제(change control)를 만족한다.
- 피드백 수집 시 confidence/citation/expert-review 조건이 재가중치 적용 후에도 유지되어야 RA claim의 신뢰성이 보존된다.

### 1.3 본 SPEC의 범위 (In Scope)

- 인라인 답변 평가 (엄지 위/아래 + 품질 태그 + 선택적 텍스트)
- `answer_feedback` 테이블 및 qualityTags enum
- AnswerBlock 피드백 UI
- 피드백 집계 파이프라인 (평균 점수, 하락 추이 감지)
- Low-rated 답변 자동 Knowledge Gap 이슈 생성 (#35 연계)
- High-rated 답변 자동 지식 승격 후보 제안 (#50 연계)
- 피드백 기반 retrieval 재가중치 (source_sections.feedback_score)
- Langfuse 피드백 이벤트 전송
- 피드백 분석 대시보드 (품질 히트맵)

### 1.4 Out of Scope

- 모델 fine-tuning / 가중치 직접 학습 (retrieval re-ranking에 한정)
- 외부 사용자 대상 피드백 수집
- 피드백 기반 답변 자동 재생성 (제안만, 자동 적용 금지)
- 익명 피드백 (userId 추적 필수)

---

## §2 Requirements (EARS Format)

### REQ-RLHF: 피드백 수집·집계·재가중치·연계

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-RLHF-001 | THE SYSTEM SHALL `answer_feedback` 테이블에 id, messageId, userId, rating(enum: up/down), qualityTags(array), comment, createdAt를 관리한다 | High |
| REQ-RLHF-002 | THE SYSTEM SHALL qualityTags를 citation_missing, citation_wrong, answer_incomplete, answer_wrong, outdated_info, jurisdiction_mismatch, helpful, excellent enum으로 제한한다 | High |
| REQ-RLHF-003 | WHERE 사용자가 AnswerBlock을 볼 때 THE SYSTEM SHALL 엄지 아이콘, 태그 선택, 선택적 텍스트 입력 피드백 UI를 제공한다 | High |
| REQ-RLHF-004 | WHEN 사용자가 답변에 피드백을 제출할 때 THE SYSTEM SHALL userId와 함께 answer_feedback에 기록한다 | High |
| REQ-RLHF-005 | THE SYSTEM SHALL 답변별 평균 피드백 점수를 집계한다 | High |
| REQ-RLHF-006 | WHEN 피드백 점수가 하락 추이를 보일 때 THE SYSTEM SHALL 하락 추이를 감지하여 표시한다 | Medium |
| REQ-RLHF-007 | IF 답변이 low-rated로 판정되면 THEN THE SYSTEM SHALL 자동으로 Knowledge Gap 이슈(#35)를 생성한다 | High |
| REQ-RLHF-008 | IF 답변이 high-rated로 판정되면 THEN THE SYSTEM SHALL 자동으로 지식 승격 후보(#50)로 제안한다 | High |
| REQ-RLHF-009 | THE SYSTEM SHALL source_sections에 feedback_score 컬럼을 추가하고 피드백에 따라 갱신한다 | High |
| REQ-RLHF-010 | WHEN RAG retrieval을 수행할 때 THE SYSTEM SHALL feedback_score를 retrieval 재가중치(re-ranking)에 반영한다 | High |
| REQ-RLHF-011 | WHEN 피드백 이벤트가 발생할 때 THE SYSTEM SHALL Langfuse에 피드백 이벤트를 전송한다 | Medium |
| REQ-RLHF-012 | THE SYSTEM SHALL 질문 유형별·코퍼스별 품질 히트맵 대시보드를 제공한다 | Medium |
| REQ-RLHF-013 | WHEN retrieval 재가중치 또는 모델/프롬프트가 변경될 때 THE SYSTEM SHALL version metadata를 기록하고 rollback 가능하게 한다 | High |
| REQ-RLHF-014 | WHERE retrieval 재가중치가 적용된 후 THE SYSTEM SHALL confidence, citation, expert-review 조건이 유지되는지 검증한다 | High |
| REQ-RLHF-015 | THE SYSTEM SHALL high-rated 답변의 승격을 자동 확정하지 않고 후보 제안에 한정한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | AnswerBlock에서 엄지 위/아래 + 품질 태그 + 텍스트 피드백이 answer_feedback에 userId와 함께 저장된다 | Test |
| AC-02 | qualityTags enum 8종이 검증되고 enum 외 값은 거부된다 | Test |
| AC-03 | low-rated 답변이 자동으로 Knowledge Gap 이슈(#35)를 생성한다 | Test |
| AC-04 | high-rated 답변이 자동으로 지식 승격 후보(#50)로 제안되되 자동 확정되지 않는다 | Test |
| AC-05 | feedback_score가 source_sections에 반영되고 retrieval re-ranking에 영향을 준다 | Test |
| AC-06 | retrieval 재가중치 변경 시 version metadata가 기록되고 rollback이 가능하다 | Test |
| AC-07 | 재가중치 적용 후에도 confidence/citation/expert-review 조건이 유지된다 | Test |
| AC-08 | 피드백 이벤트가 Langfuse에 전송되고, 품질 히트맵 대시보드가 질문 유형별·코퍼스별로 표시된다 | Test / Review |

---

## §4 Technical Approach

### 4.1 파일 구조

- `lib/db/schema/answer-feedback.ts` — 피드백 스키마
- `lib/rlhf/feedback-aggregator.ts` — 답변별 평균 점수, 하락 추이 감지
- `lib/rlhf/reranker.ts` — feedback_score 기반 retrieval 재가중치
- `lib/rlhf/gap-promo-bridge.ts` — #35/#50 연계 자동 제안
- `lib/rlhf/langfuse-emitter.ts` — Langfuse 이벤트 전송
- `lib/rlhf/version-tracker.ts` — 재가중치/프롬프트 version metadata + rollback
- `components/answer-block/feedback-control.tsx` — 피드백 UI
- `app/api/rlhf/feedback/route.ts` — 피드백 제출 API
- `app/(app)/quality/heatmap/page.tsx` — 품질 히트맵 대시보드

### 4.2 DB Schema

- 신규 테이블 `answer_feedback`: id, message_id, user_id, rating(enum: up/down), quality_tags(array enum), comment, created_at
- 기존 테이블 확장: source_sections에 feedback_score(numeric) 컬럼 추가
- retrieval 버전 추적용 metadata 테이블 또는 컬럼 (re-ranking version, prompt version, rollback ref)
- audit_logs 활용: 신규 action `feedback_submitted`, `reranking_applied`, `reranking_rolled_back`

### 4.3 API Endpoints

- `POST /api/rlhf/feedback` — 답변 피드백 제출
- `GET /api/rlhf/heatmap` — 품질 히트맵 데이터
- `GET /api/rlhf/feedback/aggregate?messageId=` — 답변별 집계
- 내부: re-ranking 적용 시 retrieval 파이프라인 훅, Langfuse SDK 전송

### 4.4 의존성

- 외부 라이브러리: Langfuse SDK (LLM trace 품질 추적), pgvector (retrieval)
- 기존 SPEC: SPEC-REGULA-FOUNDATION-001(audit_logs, RBAC), SPEC-REGULA-CHAT-001(messages, AnswerBlock, RAG retrieval), SPEC-REGULA-BREADTH-001(messages 테이블, AnswerBlock 컴포넌트)
- 연계 SPEC: SPEC-REGULA-KNOWLEDGE-GAP-001(#35, low-rated → gap 이슈화), SPEC-REGULA-KNOWLEDGE-PROMO-001(#50, high-rated → 승격 후보)
- 기존: promptfoo eval harness (오프라인 eval과 온라인 피드백 병행)
