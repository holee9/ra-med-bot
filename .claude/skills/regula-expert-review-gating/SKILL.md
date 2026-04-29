---
name: regula-expert-review-gating
description: "Regula의 전문가 검토 자동 게이팅 규칙. confidence < 0.7 OR policy-blocked keyword 매칭 시 expert_review_required SSE event 발행, 토스트 표시, 전문가 큐에 푸시. 'expert review', '전문가 검토', 'confidence', 'gating', '정책 키워드', 'auto-flag' 언급 시 반드시 이 스킬 사용. RAG 파이프라인, 프론트 UI, 감사 로그 모두에 적용."
---

# Regula Expert Review Gating

Regula는 의료기기 규제 도메인이므로 **LLM 답변이 충분히 신뢰할 수 없거나, 고위험 주제를 다룰 때 인간 RA 전문가의 검토를 자동으로 요청**한다. 이는 UI 편의가 아닌 **제품 안전 게이트**이다.

## 자동 플래그 조건

### 조건 1: 낮은 confidence

```ts
if (confidence.score < 0.7) {
  emit({ type: 'expert_review_required', reason: `confidence ${confidence.score.toFixed(2)} < 0.7` });
}
```

`confidence.score`는 regula-rag-pipeline의 `lib/ai/confidence.ts`가 계산:
- retrieval score (top chunk 유사도)
- generation perplexity
- citation density (claim당 citation 수)
- 출처 다양성 (단일 출처 의존 시 감점)

### 조건 2: Policy-blocked keyword

```ts
// lib/ai/policy-keywords.ts
export const POLICY_BLOCKED_KEYWORDS = [
  // 임상시험 관련 고위험
  '임상시험 면제',
  '임상시험 생략',
  'IDE 면제',
  // 응급 / 인도적 사용
  '응급',
  'emergency use authorization',
  'humanitarian',
  // 판매 허가 우회
  '판매 허가 없이',
  '신고 없이 판매',
  // 리콜
  '리콜 회피',
  // ... 정기 업데이트
] as const;

export function detectPolicyKeyword(question: string, prose: string): string | null {
  const target = `${question}\n${prose}`.toLowerCase();
  for (const kw of POLICY_BLOCKED_KEYWORDS) {
    if (target.includes(kw.toLowerCase())) return kw;
  }
  return null;
}
```

### 조건 3: 수동 플래그

Topbar의 "전문가 검토" 버튼 클릭 시 무조건 큐에 추가:

```
POST /api/ra/expert-review
{ conversationId, messageIds?: [...], reason: 'user_manual' }
```

## SSE Event 발행 지점

`lib/ai/consult.ts`의 Phase C에서:

```ts
async function* consult(input, session) {
  // ... Phase A (trace), Phase B (prose) ...

  // Phase C에서 confidence 계산 직후
  const conf = computeConfidence(retrievalScore, perplexity, citationDensity);
  yield { type: 'confidence', level: conf.level, score: conf.score };

  // Expert review 자동 게이팅
  let reviewReason: string | null = null;
  if (conf.score < 0.7) reviewReason = `confidence ${conf.score.toFixed(2)} < 0.7`;
  const policyKw = detectPolicyKeyword(input.question, proseBuffer);
  if (policyKw) reviewReason = `policy keyword: ${policyKw}`;

  if (reviewReason) {
    yield { type: 'expert_review_required', reason: reviewReason };
    await writeAudit({
      actor: session.user.id,
      action: 'consult.expert_review_auto_flag',
      resourceType: 'message',
      resourceId: messageId,
      meta: { reason: reviewReason, score: conf.score },
    });
    await enqueueExpertReview({ messageId, reason: reviewReason });
  }

  // ... sources, checklist, ... , done
}
```

## 프론트 렌더링

```tsx
// components/chat/ExpertReviewCallout.tsx
export function ExpertReviewCallout({ reason }: { reason: string }) {
  return (
    <Callout variant="expert">
      <ShieldAlert className="h-5 w-5 text-amber-600" />
      <div>
        <p className="font-semibold">전문가 검토가 필요합니다</p>
        <p className="text-sm text-ink-600">
          이 답변은 자동으로 RA 전문가 검토 큐에 추가되었습니다.
          검토 완료까지 이 답변을 의사결정에 사용하지 마십시오.
        </p>
        <p className="mt-2 text-xs text-ink-500 font-mono">사유: {reason}</p>
      </div>
    </Callout>
  );
}
```

`AnswerBlock.tsx`에서 `structured.expertReviewRequired`가 존재하면 prose 바로 아래 (meta row 다음)에 렌더링.

## DB Schema

```ts
export const expertReviews = pgTable('expert_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  messageId: uuid('message_id').references(() => messages.id),  // 자동 플래그는 특정 message, 수동은 conversation 전체
  requestedBy: uuid('requested_by').notNull(),  // 자동이면 'system', 수동이면 user.id
  assignedTo: uuid('assigned_to'),
  status: varchar('status', { length: 16 }).notNull().default('pending'),  // pending | in_review | resolved
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
```

`messages.expert_review_required` boolean 컬럼을 함께 set하여 UI에서 과거 답변 조회 시 배지 표시.

## 토스트 + 큐 알림

```tsx
// hooks/useStreamingAnswer.ts
case 'expert_review_required':
  toast.info('전문가 검토 큐에 추가되었습니다', {
    description: ev.reason,
    duration: 5000,
  });
  setState(s => ({ ...s, structured: { ...s.structured, expertReviewRequired: ev } }));
  break;
```

## 정책 키워드 업데이트

- `lib/ai/policy-keywords.ts`는 하드코딩 list
- 월 1회 RA 리드가 검토, 새 키워드 추가 시 PR
- 동적 업데이트(DB table 기반) 전환은 Phase 7 이후 검토

## QA 회귀 테스트 (regula-compliance-qa)

```ts
// tests/eval/expert-review.eval.ts
describe('Expert review auto-flagging', () => {
  for (const kw of POLICY_BLOCKED_KEYWORDS) {
    it(`flags on "${kw}"`, async () => {
      const events = await simulateConsult(`"${kw}"에 대해 설명해줘`);
      const flag = events.find(e => e.type === 'expert_review_required');
      expect(flag?.reason).toContain(kw);
    });
  }

  it('flags when confidence < 0.7', async () => {
    mockRetrieval({ topScore: 0.5 });  // 낮은 유사도 강제
    const events = await simulateConsult('존재하지 않는 규제에 대해 설명해줘');
    expect(events.find(e => e.type === 'expert_review_required')).toBeTruthy();
  });

  it('does NOT flag on high confidence + safe keyword', async () => {
    mockRetrieval({ topScore: 0.9 });
    const events = await simulateConsult('510(k) 제출 절차를 설명해줘');
    expect(events.find(e => e.type === 'expert_review_required')).toBeUndefined();
  });
});
```

## 게이팅 우회 금지

- "이번 답변만 게이팅 제외" 요청은 거부
- 관리자도 자동 플래그를 해제할 수 없음 (resolved 상태로 이동만 가능)
- 게이팅 로직 변경은 PR 리뷰 필수, regula-compliance-qa 승인 필요

## 체크리스트

- [ ] `expert_review_required` event가 SSE 순서상 올바른 위치에서 발행되는가
- [ ] 감사 로그 `consult.expert_review_auto_flag`가 기록되는가
- [ ] `messages.expert_review_required` 컬럼이 set되는가
- [ ] 전문가 큐 DB row가 생성되는가
- [ ] 프론트에서 callout + 토스트가 렌더링되는가
- [ ] 50+ RA 질문 회귀 셋에서 위험 질문 100% 플래그
