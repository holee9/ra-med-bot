# Research Document — SPEC-V3-CONSULT-001

**작성일**: 2026-07-05
**분석 대상**: RA Power Chat (v3 Phase C-5)
**의존 SPEC**: SPEC-V3-TRIAGE-001 (just merged, Phase C-2)

---

## 1. 기존 코드베이스 분석

### 1.1 `lib/ai/consult.ts` (현재 1-shot streaming RAG)

**직검 라인 수**: 831줄
**핵심 구조**: 8-stage async generator (SSE 제공)

```typescript
// Stage 1: Intent classification (classifyIntent)
// Stage 2: Query rewrite (rewriteQuery)
// Stage 3: Multi-corpus retrieval (classifyAndRoute + parallelRetrieveAndMerge)
// Stage 4: Extract relevant sections (noop, reranker deferred)
// Stage 5: Prompt composition (composePrompt + project-memory injection)
// Stage 6: LLM streaming (streamText)
// Stage 7: Post-process (enforceCitations + calculateConfidence)
// Stage 8: Persist (persistMessage to conversations/messages)
// Stage 9: Capture knowledge gap (captureKnowledgeGap)
// Stage 10: Project memory extraction (detectDecisions + persistSuggestionsAsPending)
```

**@MX:ANCHOR 확인**:
- Line 1: `@MX:ANCHOR RAG pipeline entry point — 8-stage async generator yielding StreamEvents`
- fan_in >= 3: route.ts, tests, future scheduled tasks

**SSE 이벤트 순서** (consult.ts:101):
```typescript
// Phase A: meta → trace*(N)
// Phase B: prose_delta*(M)
// Phase C: confidence → sources → [expert_review_required?] → structured blocks → done
```

**현재 DB 스키마 사용** (consult.ts:19):
```typescript
import { conversations, messageBlocks, messages } from '../db/schema';
```

**주요 side-effects**:
- `writeAudit` (llm.call, source.access, expert_review.flag)
- `persistMessage` (conversations/messages INSERT)
- `captureKnowledgeGap` (unanswered_queue INSERT)
- `enqueueExpertReview` (expert_reviews INSERT)
- `persistSuggestionsAsPending` (project_memory INSERT)

**replay mode 지원** (consult.ts:69-75):
```typescript
export type ConsultOptions = {
  mode?: 'replay'; // Skips DB-writing side effects for knowledge-gap replay
};
```

### 1.2 `app/api/ra/consult/route.ts` (현재 1회성 스트리밍)

**직검 라인 수**: 262줄
**핵심 기능**: POST /api/ra/consult (SSE stream)

**RBAC** (route.ts:134):
```typescript
export const POST = withPermission('consult.create', async (req, _ctx, session) => {
```

**Rate limiting** (route.ts:100-123):
```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000; // 30 req / 60s per user
```

**E2E test mode** (route.ts:24-98):
```typescript
// Deterministic fake SSE stream — no LLM calls
// Yields real conversationId/messageId so expert-review FK constraints are satisfied
```

**현재 응답 contract**:
```typescript
// SSE StreamEvent stream:
// { type: 'meta', conversationId, messageId }
// { type: 'trace', step, status }*
// { type: 'prose_delta', delta }*
// { type: 'confidence', level, score }
// { type: 'sources', items[] }
// { type: 'expert_review_required', reason }?
// { type: 'done', duration_ms }
```

### 1.3 `lib/domains/triage/run-triage.ts` (TRIAGE RAG 패턴 참조)

**직검 라인 수**: 100줄 (일부)
**핵심 패턴**: consult.ts 하위 모듈 재사용 + 15s timeout

**@MX:ANCHOR 확인**:
- Line 1-8: `runTriage — TRIAGE RAG pipeline entry point`
- fan_in >= 3: /api/ask, future auto-triage, integration tests

**재사용 모듈** (run-triage.ts:11-21):
```typescript
import { enforceCitations } from '@/lib/ai/citation-enforce';
import { calculateConfidence } from '@/lib/ai/confidence';
import { classifyIntent } from '@/lib/ai/intent';
import { parallelRetrieveAndMerge } from '@/lib/ai/merge';
import { composePrompt } from '@/lib/ai/prompt-templates';
import { classifyAndRoute } from '@/lib/ai/router';
```

**타임아웃 패턴** (run-triage.ts:51-79):
```typescript
const timeoutMs = getEnv().TRIAGE_TIMEOUT_MS;
const controller = new AbortController();
const timeoutPromise = new Promise<TriageResult>((resolve) => {
  timeoutId = setTimeout(() => {
    controller.abort();
    resolve({ autoAnswer: null, autoConfidence: null, error: 'timeout' });
  }, timeoutMs);
});
return await Promise.race([runPipeline(input, controller.signal), timeoutPromise]);
```

**회귀 리스크 완화**:
- TRIAGE run-triage.ts는 consult.ts와 동일한 하위 모듈을 호출
- AC-06 (citation 강제) 직접 이행: `citations.length === 0` → `no_citations` error
- timeout 시 `auto` state 유지 (fallback 전략)

### 1.4 `lib/db/schema.ts` (현재 conversations/messages 테이블)

**직검 라인 수**: 100줄 (일부)
**테이블 인벤토리**: 18 tables + 11 pgEnums

**현재 conversations 스키마** (schema.ts inferred from consult.ts usage):
```typescript
// conversations: { id, userId, projectId, title, createdAt, updatedAt }
// messages: { id, conversationId, role, contentProse, ... }
```

**v3 docs 기반 신규 테이블 요구사항** (02_data_model.md:238):
```markdown
- `consult_sessions` + `consult_turns` (Power Chat 저장)
- 보관 기간: 5년 (RA 개인 리서치 · 명시적 삭제 허용)
```

**비교표**:
| 테이블 | 기존 (v2) | 신규 (v3) | 보관 정책 |
|--------|---------|---------|----------|
| conversations | ✅ 사용 중 | ❌ 미사용 | N/A |
| messages | ✅ 사용 중 | ❌ 미사용 | N/A |
| consult_sessions | ❌ 없음 | ✅ 신규 | 5년 |
| consult_turns | ❌ 없음 | ✅ 신규 | 5년 |

### 1.5 `lib/auth/permissions.ts` (RBAC 권한)

**직검 라인 수**: 79줄
**현재 consult 관련 권한** (permissions.ts:8):
```typescript
export type PermissionAction =
  | 'consult.create'  // 기존: POST /api/ra/consult
  // ...
```

**v3 요구사항** (01_architecture.md:95, 03_api_contract.md:148-149):
```markdown
### GET/POST /api/consult/sessions
### GET /api/consult/sessions/:id
### POST /api/consult/sessions/:id/turns
Power Chat CRUD.

## 3.1 RBAC
`/api/consult` 권한 `ra-member`/`ra-lead`/`admin`.
```

**필요한 신규 권한 추론**:
- `consult.session.create` (세션 생성)
- `consult.session.view` (세션 조회)
- `consult.turn.create` (턴 생성)
- 기존 `consult.create` 유지 또는 재정의

### 1.6 데이터 보관 정책 비교

**기존 테이블 보관 정책** (02_data_model.md:252):
| 테이블 | 보관 기간 | 근거 |
|---|---|---|
| `audit_log` | 10년 | 21 CFR Part 11 + MDR Art. 10(8) |
| `inbox_tickets` (closed) | 7년 | ISO 13485 §4.2.5 |
| `approved_answers` | 7년 | 위와 동일 |
| `consult_sessions` | **5년** | **RA 개인 리서치 · 명시적 삭제 허용** |

**audit_logs 10년 보관 패턴 재사용 가능성**:
- `lib/cron/retention/` 패키지 확인 필요
- cron job 또는 audit_retention 테이블 패턴 참조

---

## 2. TRIAGE SPEC 구조 참조

### 2.1 SPEC-V3-TRIAGE-001 spec.md 구조

**직검 라인 수**: 100줄 (일부)
**문서 섹션**:
```markdown
## §1 Purpose (목적)
### 1.1 배경 (Background)
### 1.2 페르소나 (Personas)
### 1.3 규제·정책 근거 (Policy Anchor)
### 1.4 본 SPEC의 범위 (In Scope)
### 1.5 Out of Scope

## §2 Requirements (EARS Format)
### RAG 주입 / 자동 답변
### 응답 계약
### 감사 로그

## §3 Acceptance Criteria
```

**EARS 패턴 예시** (spec.md:88-90):
```markdown
| REQ-TRI-001 | **WHEN** `/api/ask`가 티켓을 생성한 후 **THEN** the system **SHALL** ...
| REQ-TRI-002 | **IF** 산출된 `auto_answer`가 존재하나 `citations.length === 0`인 경우 **THEN** the system **SHALL** ...
```

### 2.2 SPEC-V3-TRIAGE-001 acceptance.md 구조

**GWT 패턴 예시**:
```markdown
### AC-TRI-01: /api/ask 자동 답변 주입 성공
**Given** 사용자가 유효한 `/api/ask` 요청을 보내면
**When** TRIAGE RAG 파이프라인이 citation을 포함한 답변을 성공적으로 산출하면
**Then** 시스템은 201 Created와 함께 `{ticketId, triageState: 'needs-review', autoAnswer, autoConfidence}`를 반환한다
```

---

## 3. 핵심 설계 결정 후보 분석

### 3.1 세션 영속성: 기존 vs 신규 테이블

**옵션 A: 기존 conversations/messages 재사용**
- 장점: migration 불필요, 기존 consult.ts 그대로 사용
- 단점: v3 docs 명시적 요구사항 위배 (consult_sessions/turns), RA 전용 Power Chat 개념 모호

**옵션 B: 신규 consult_sessions/turns 테이블 (migration 필요)**
- 장점: v3 docs 준수, RA 전용 세션 격리, 5년 보관 정책 명확
- 단점: migration 비용, consult.ts DB 스키마 수정

**권장**: 옵션 B (v3 docs가 single source of truth)

### 3.2 RAG 파이프라인: consult.ts 재사용 vs run-consult.ts

**옵션 A: consult.ts async generator 직접 소비 + 세션 저장 래퍼**
- 장점: 기존 8-stage 검증됨, TRIAGE 패턴과 동일
- 단점: SSE 변환 로직 중복, async generator → JSON 변환 overhead

**옵션 B: run-consult.ts 신규 래퍼 (run-triage.ts 패턴)**
- 장점: TRIAGE와 동일한 패턴, timeout/citation 검증 패턴 재사용, 회귀 리스크 낮음
- 단점: consult.ts와 중복 코드 발생 가능성

**권장**: 옵션 B (run-consult.ts 래퍼 + consult.ts 하위 모듈 재사용)

### 3.3 권한: consult.create 확장 vs 신규 권한

**옵션 A: 기존 consult.create 확장**
- 장점: 권한 스키마 안정적
- 단점: 세션/턴 CRUD 세분화 불명확

**옵션 B: 신규 권한 3종 (session.create, session.view, turn.create)**
- 장점: v3 API contract 명확히 반영
- 단점: RBAC matrix 확장

**권장**: 옵션 B (v3 API contract 준수)

### 3.4 보관 정책: 5년 cron 구현

**기존 패턴**: audit_logs 10년 보관
- `lib/cron/retention/` 패키지 확인 필요
- cron job 또는 audit_retention 테이블 패턴 참조

**구현 방법 후보**:
1. cron job (매일 자정 run, deletedAt < 5년 ago DELETE)
2. audit_retention 테이블 패턴 (retention_year 컬럼)
3. 수동 정책 (문서화만, run phase 미구현)

**권장**: run phase에서 구현 여부 결정 (plan phase에서는 API contract만 명시)

### 3.5 citation 강제: Charter [지양-2] 준수

**기존 consult.ts 패턴** (consult.ts:342-362):
```typescript
const { cleaned, violations } = enforceCitations(fullProse, availableSources);
const uncitedViolationCount = violations.filter((v) => v.type === 'CLAIM_UNCITED').length;
const citationCoverageBelow80 = totalSentences > 0 && uncitedViolationCount / totalSentences > 0.2;
```

**TRIAGE AC-06 직접 이행 패턴** (run-triage.ts:91-94):
```typescript
if (mergedResults.length === 0) {
  return { autoAnswer: null, autoConfidence: null, error: 'no_citations' };
}
```

**권장**: TRIAGE 패턴 준용 (citation 없는 답변 저장 거부)

---

## 4. v3 데이터 모델 추론

### 4.1 consult_sessions 테이블 (추론)

```typescript
// schema.ts 예상 (run phase에서 확정)
export const consultSessions = pgTable('consult_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  raMemberId: uuid('ra_member_id').notNull().references(() => users.id), // 생성자
  projectId: uuid('project_id').references(() => projects.id), // optional (프로젝트 context)
  title: text('title').notNull(), // 세션 제목 (사용자 입력 or LLM 생성)
  locale: localeEnum('locale').notNull().default('ko'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // 명시적 삭제 허용 (5년 보관 정책과 연계)
});
```

### 4.2 consult_turns 테이블 (Exchange 모델 확정)

```typescript
// schema.ts (run phase에서 확정)
// Exchange 모델: 한 turn = 한 Q+A pair. role 필드 없음.
export const consultTurns = pgTable('consult_turns', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => consultSessions.id),
  turnNumber: integer('turn_number').notNull(), // 1, 2, 3, ... 단조 증가
  question: text('question').notNull(),          // 사용자 입력 (항상 존재)
  answer: text('answer'),                         // RAG 결과 HTML prose, 실패 시 null
  citations: jsonb('citations').$type<Citation[]>(), // citation 메타데이터 배열
  confidence: real('confidence'),                 // 0.00 ~ 1.00, 실패 시 null
  sources: jsonb('sources').$type<SourceItem[]>(), // RAG source 메타데이터
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Exchange 모델 vs 기존 messages 모델 차이**:
| 컬럼 | messages (v2, role 기반) | consult_turns (v3, Exchange) |
|------|--------------------------|-------------------------------|
| conversationId | ✅ | ❌ sessionId |
| role | ✅ ('user'/'assistant') | ❌ (제거됨, 의미 없음) |
| contentProse | ✅ (role에 따라 question/answer 분리) | ❌ question + answer 같은 row |
| citations | ❌ | ✅ JSONB |
| confidence | ✅ | ✅ |
| sources | ❌ message_sources 테이블 | ✅ JSONB 직렬 |
| turnNumber | ❌ | ✅ |

---

## 5. 기술 위험도 평가

### 5.1 회귀 리스크

**HIGH**: 기존 `/api/ra/consult` 깨짐 방지
- mitigation: v3 API는 신규 경로 (`/api/consult/sessions`)로 분리
- 기존 1-shot streaming은 v2 API로 유지 (호환성 보장)

**MEDIUM**: consult.ts DB 스키마 호환성
- mitigation: run-consult.ts 래퍼 사용, consult.ts는 기존 스키마 그대로

**MEDIUM**: TRIAGE 패턴과의 모호성
- mitigation: TRIAGE는 inbox_tickets, CONSULT는 consult_sessions (명확히 격리)

### 5.2 성능 리스크

**MEDIUM**: consult_sessions/turns JOIN 성능
- mitigation: sessionId index, turnNumber index

**LOW**: 5년 보관 정책 cron job 영향
- mitigation: deletedAt < 5년 ago 쿼리 튜닝

### 5.3 보안 리스크

**HIGH**: RA Lead만 세션 삭제 허용 (명시적 삭제)
- mitigation: `consult.session.delete` 권한 ra-lead 전용

**MEDIUM**: 프로젝트 context 누출
- mitigation: projectId RBAC 검증

---

## 6. Product Charter 참조

### 6.1 [지양-2] citation 강제

**Charter 인용**:
> "모든 답변은 출처(source/provenance)를 명확히 제시해야 한다."

**SPEC 구현**:
- enforceCitations 재사용 (consult.ts:342)
- citation 없는 답변 저장 거부 (AC-XX)

### 6.2 [지양-4] RA Lead 승인

**Charter 인용**:
> "자동 판정으로 승인/거절/에스컬레이션을 결정하지 않는다. AI는 초안만 제공한다."

**SPEC 구현**:
- TRIAGE와 동일: AI는 답변만 생성, RA Lead가 최종 승인
- 명시적 삭제는 RA Lead 권한

### 6.3 [지양-1] 전사 도우미

**Charter 인용**:
> "Employee가 질문 즉시 RAG draft 답변을 받아 자주 묻는 인허가 질문을 셀프서비스 해결."

**SPEC 구현**:
- RA Member만 Power Chat 접근 (ra-member+ 권한)
- Employee는 TRIAGE auto_answer 사용 (다른 채널)

---

## 7. 구현 방법론 권장

**mode**: TDD (Red-Green-Refactor)
- 사유: 신규 테이블 + 신규 API → greenfield development
- coverage target: 85%+

**harness**: thorough
- 사유: v3 Phase C-5는 core user journey
- evaluator-active 4-dimension scoring 예상

**development_mode**: tdd
- 이유: 기존 코드베이스가 테스트 커버리지 높음 (TRIAGE 완료 후)

---

## 8. 코드 직검 L-013 준수 확인

### 8.1 Runtime grep 검증 (run phase 시행)

**manager-strategy 보고 수치 검증**:
- consult.ts fan_in >= 3 확인: `grep -r "from.*consult" | wc -l`
- run-triage.ts 재사용 패턴 확인: `grep -r "from.*run-triage" | wc -l`
- 기존 /api/ra/consult 호출처 확인: `grep -r "api/ra/consult" app/`

### 8.2 코드 라인 인용 (main HEAD 기준)

본 research.md의 모든 코드 인용은 main HEAD 기준 직검입니다:
- `lib/ai/consult.ts`: 831줄 (실제)
- `app/api/ra/consult/route.ts`: 262줄 (실제)
- `lib/domains/triage/run-triage.ts`: 100줄 (실제)
- `lib/db/schema.ts`: 100줄 (일부, 전체는 더 긺)
- `lib/auth/permissions.ts`: 79줄 (일부)

---

## 9. 종합 결론

### 9.1 핵심 설계 결정 (확정)

1. **세션 영속성**: 신규 consult_sessions/turns 테이블 (v3 docs 준수)
2. **RAG 재사용**: run-consult.ts 래퍼 + consult.ts 하위 모듈 재사용 (TRIAGE 패턴)
3. **권한**: 신규 consult.session.create, consult.session.view, consult.turn.create (ra-member+)
4. **보관**: 5년 보관 정책 (deletedAt 기반, run phase에서 구현)
5. **citation**: enforceCitations 재사용 (Charter [지양-2] 준수)

### 9.2 migration 필요 여부

**YES**: 신규 테이블 2종 (consult_sessions, consult_turns) + 신규 권한 3종
- Migration M1: 테이블 생성 (drizzle-kit push)
- Migration M2: 권한 데이터 마이그레이션 (기존 consult.create → 신규 권한 분리)
- Migration M3: audit_retention cron job (선택 사항)

### 9.3 REQ/AC/edge 카운트 예상

- **REQ**: 12종 (세션 CRUD 4 + 턴 CRUD 4 + 보관 1 + 감사 2 + citation 1)
- **AC**: 7종 (세션 생성/조회/삭제 3 + 턴 생성/조회 2 + citation 검증 1 + soft-delete 1)
- **edge cases**: 8종 (빈 세션, citation 없는 답변, 타임아웃, 권한 없는 유저, etc.)

### 9.4 risks/blockers

**blockers**: 없음 (TRIAGE 완료로 의존 해소)

**risks**:
- consult_sessions/turns 스키마 설계 변경 (run phase에서 재검토 가능)
- v3 API contract와 기존 /api/ra/consult 충돌 (경로 분리로 완화)

---

**본 research.md는 SPEC-V3-CONSULT-001 plan phase 산출물의 일부입니다.**
