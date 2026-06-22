---
id: SPEC-REGULA-BATCH-001
version: 1.0.0
status: draft
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 43
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-ENTERPRISE-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-BATCH-001 — 배치 질의 모드 (사전 미팅 준비·대량 규제 Q&A)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #43 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

RA 팀은 반복적으로 대량의 규제 질의를 한꺼번에 처리해야 한다. 대표적인 시나리오는 FDA Pre-Submission Meeting 준비를 위한 20~50개 질의응답 작성, EU MDR Technical File 검토를 위한 100개 항목 체크리스트 일괄 확인, 규제기관 감사 준비를 위한 기 제출 답변의 현행 규제 적합성 재검토, RA 신입 교육용 기본 규제 지식 Q&A 일괄 생성이다.

현재 Regula는 한 번에 한 질문씩만 처리한다. 이를 개별로 입력하면 20~50회의 반복 작업이 필요하여 비효율적이다. 본 SPEC은 CSV/Excel/TSV 업로드 또는 인라인 입력을 통해 다수의 질문을 한 번에 받아 병렬 RAG 처리하고, 결과를 DOCX/Excel/PDF로 export하는 배치 질의 모드를 구현한다.

배치 처리는 질문 1건을 1 job으로 큐잉하여 독립 처리 및 실패 격리를 보장하며, 중간 실패 시 완료된 부분 결과를 보존하고 재개 가능하도록 한다. 신뢰도가 낮은 답변은 자동 플래그하여 expert review로 연결한다.

본 기능은 기존 DocIngest 인프라(Cloudflare Queue 또는 Inngest)를 재활용하며, RBAC 기반 배치 접근 권한을 적용한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA: Pre-Submission Program (Q-Submission), Pre-Sub Meeting 양식
- EU MDR: Regulation (EU) 2017/745, Technical File / Technical Documentation
- PMDA: 사전 상담 (consultation)
- MFDS: Q&A 양식
- 모든 배치 처리는 audit log 기록 및 citation 포함을 요구한다.

### 1.3 본 SPEC의 범위 (In Scope)

- A. 배치 입력 인터페이스: CSV/Excel/TSV 업로드, 인라인 텍스트 편집기, 템플릿 선택(FDA Pre-Sub, EU MDR TechFile, PMDA 사전 상담, MFDS Q&A), 최대 100건 제한
- B. 배치 처리 엔진: 병렬 RAG 처리(concurrency 10), citation 포함 답변 생성, 신뢰도 < 0.7 자동 플래그, SSE 실시간 진행 업데이트, 부분 실패 복구
- C. 배치 결과 export: DOCX(질문-답변, citation 각주, 신뢰도), Excel(질문/답변/신뢰도/citation/review 컬럼), PDF(Pre-Sub Meeting 양식), batch audit log 기록
- D. 배치 히스토리: 완료된 배치 세션 저장 및 재활용, 동일 질문 배치의 이전 버전 비교(규제 개정 전/후 답변 변화 추적)

### 1.4 Out of Scope

- 실시간 협업 배치 편집 (#25 Co-editing 소관)
- 외부 고객 API (내부 사용자 전용)
- AI 기반 질문 자동 생성

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-BATCH-001 | WHEN a user uploads a CSV/Excel/TSV file of questions THE SYSTEM SHALL parse the questions into a batch job list. | High |
| REQ-BATCH-002 | WHEN a user enters questions in the inline editor THE SYSTEM SHALL accept line-delimited questions as a batch. | High |
| REQ-BATCH-003 | WHEN a user selects a template THE SYSTEM SHALL apply the corresponding format (FDA Pre-Sub, EU MDR TechFile, PMDA 사전 상담, MFDS Q&A). | Medium |
| REQ-BATCH-004 | IF a batch exceeds 100 questions THEN THE SYSTEM SHALL split it into separate processing batches. | High |
| REQ-BATCH-005 | WHEN a batch is processed THE SYSTEM SHALL run RAG in parallel with a concurrency limit of 10. | High |
| REQ-BATCH-006 | WHEN each question is answered THE SYSTEM SHALL include citations in the answer. | High |
| REQ-BATCH-007 | IF an answer's confidence score is below 0.7 THEN THE SYSTEM SHALL automatically flag it and recommend expert review. | High |
| REQ-BATCH-008 | WHILE a batch is processing THE SYSTEM SHALL emit SSE updates indicating N/M completed. | High |
| REQ-BATCH-009 | IF a question job fails mid-batch THEN THE SYSTEM SHALL preserve completed partial results and allow the batch to resume. | High |
| REQ-BATCH-010 | WHEN a batch completes THE SYSTEM SHALL support export to DOCX, Excel, and PDF formats. | High |
| REQ-BATCH-011 | WHEN a batch session is recorded THE SYSTEM SHALL write a batch audit log entry (batch_id, question count, confidence distribution, expert flag count). | High |
| REQ-BATCH-012 | WHEN a batch completes THE SYSTEM SHALL save the session for later reuse in batch history. | Medium |
| REQ-BATCH-013 | WHEN a user compares two versions of the same question batch THE SYSTEM SHALL show answer changes before/after regulatory revisions. | Low |
| REQ-BATCH-014 | WHILE a user lacks the required RBAC permission for batch access THE SYSTEM SHALL deny the batch operation. | High |
| REQ-BATCH-015 | WHEN 100 questions are processed THE SYSTEM SHALL complete within 5 minutes. | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | CSV 업로드 → 배치 RAG 처리 → DOCX/Excel/PDF export가 동작한다. | Test |
| AC-02 | 처리 중 실시간 진행 상황(N/M)이 SSE로 표시된다. | Test |
| AC-03 | 신뢰도 낮은 답변이 자동 플래그되고 expert review로 연결된다. | Test |
| AC-04 | 100건 처리 기준 완료 시간이 5분 이내이다. | Test |
| AC-05 | 배치 세션이 audit_logs에 일괄 기록된다. | Test |
| AC-06 | 중간 실패 시 완료된 부분 결과가 보존된다. | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `app/(workflows)/batch/page.tsx` — 배치 질의 진입 UI (업로드/인라인/템플릿 선택)
- `app/api/batch/route.ts` — 배치 생성 API
- `app/api/batch/[id]/stream/route.ts` — SSE 진행 상황 스트림
- `lib/batch/parser.ts` — CSV/Excel/TSV 파서
- `lib/batch/queue.ts` — 큐 단위 job 처리 (Cloudflare Queue / Inngest)
- `lib/batch/aggregator.ts` — Redis/KV 결과 집계 및 병합
- `lib/batch/export.ts` — DOCX/Excel/PDF export

### 4.2 DB Schema

- `batch_sessions` (신규): batch_id, user_id, question_count, status, confidence_distribution, expert_flag_count, created_at
- `batch_questions` (신규): batch_id, question, answer, confidence, citations JSON, review_required, status
- `audit_logs` (기존): 배치 세션 일괄 기록

### 4.3 API Endpoints

- `POST /api/batch` — 배치 생성 (입력: 질문 목록 또는 파일)
- `GET /api/batch/[id]/stream` — SSE 진행 상황
- `GET /api/batch/[id]/export?format=docx|xlsx|pdf` — 결과 export
- `GET /api/batch/history` — 배치 히스토리 조회

### 4.4 의존성

- SPEC-REGULA-CHAT-001 (RAG core)
- SPEC-REGULA-ENTERPRISE-001 (RBAC, 배치 접근 권한)
- #35 Knowledge Gap Ops (답변 불가 → gap 자동 등록)
- #36 Review Ops (expert review 연결)
- DocIngest 인프라 (Cloudflare Queue / Inngest), Redis/KV
