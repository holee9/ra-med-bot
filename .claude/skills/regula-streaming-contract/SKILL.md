---
name: regula-streaming-contract
description: "Regula의 SSE 스트리밍 계약. trace → prose → structured JSON blocks 3단계 순서, 9가지 event type, useStreamingAnswer 훅 시그니처. 'SSE', 'streaming', 'streaming answer', 'useStreamingAnswer', 'trace step', 'prose_delta', 'structured block' 언급 시 반드시 이 스킬 사용. API 백엔드, 프론트 훅, QA E2E 테스트 모두에 적용."
---

# Regula Streaming Contract

Regula의 SSE (Server-Sent Events) 스트리밍 계약. handoff README §11.1을 단일 진실원으로 한다.

## 3단계 스트리밍 순서 (HARD)

반드시 이 순서를 지킨다. 순서 위반은 프론트 렌더링 버그로 직결.

```
Phase A: Trace (retrieval 과정 노출)
  → event: meta
  → event: trace (step: "분류 중...", status: "active")
  → event: trace (step: "분류 중...", status: "done")
  → event: trace (step: "검색 중...", status: "active")
  → ...

Phase B: Prose (답변 본문)
  → event: prose_delta (delta: "510(k) 제출은")
  → event: prose_delta (delta: " FDA의...")
  → ... (token by token)

Phase C: Structured blocks (prose 완료 후)
  → event: confidence
  → event: sources
  → event: checklist (조건부)
  → event: comparison (조건부)
  → event: timeline (조건부)
  → event: related
  → event: expert_review_required (조건부)
  → event: done
```

## 9가지 Event Type (TypeScript Union)

```ts
// types/streaming.ts — 프론트/백엔드 공유

export type StreamEvent =
  | MetaEvent
  | TraceEvent
  | ProseDeltaEvent
  | ConfidenceEvent
  | SourcesEvent
  | ChecklistEvent
  | ComparisonEvent
  | TimelineEvent
  | RelatedEvent
  | ExpertReviewRequiredEvent
  | DoneEvent
  | ErrorEvent;

export interface MetaEvent {
  type: 'meta';
  conversationId: string;
  messageId: string;
}

export interface TraceEvent {
  type: 'trace';
  step: string;                      // "분류 중", "검색 중: FDA", ...
  status: 'active' | 'done';
}

export interface ProseDeltaEvent {
  type: 'prose_delta';
  delta: string;                     // token chunk (may include <sup>)
}

export interface ConfidenceEvent {
  type: 'confidence';
  level: 'high' | 'med' | 'low';
  score: number;                     // 0.0 ~ 1.0
}

export interface SourcesEvent {
  type: 'sources';
  items: Source[];
}

export interface Source {
  citeIndex: number;
  id: string;
  orgLabel: string;
  title: string;
  year: string;
  type: 'Regulation' | 'Guidance' | 'Standard' | 'Industry' | 'Internal';
  region: string;
  url?: string;
}

export interface ChecklistEvent {
  type: 'checklist';
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  ref?: string;                      // 예: "21 CFR §807.81(a)"
  completed: boolean;
}

export interface ComparisonEvent {
  type: 'comparison';
  title: string;
  cols: string[];                    // 예: ["FDA", "EU MDR", "MFDS"]
  rows: string[][];                  // 각 row는 cols 길이와 동일
}

export interface TimelineEvent {
  type: 'timeline';
  items: TimelineItem[];
}

export interface TimelineItem {
  date: string;                      // YYYY-MM-DD
  title: string;
  description: string;
  current?: boolean;                 // 현재 단계면 amber 강조
}

export interface RelatedEvent {
  type: 'related';
  items: string[];                   // suggested follow-up questions
}

export interface ExpertReviewRequiredEvent {
  type: 'expert_review_required';
  reason: string;                    // "confidence < 0.7" | "policy keyword: 임상시험 면제"
}

export interface DoneEvent {
  type: 'done';
  duration_ms: number;
}

export interface ErrorEvent {
  type: 'error';
  code: string;                      // "llm_unavailable" | "rate_limit" | ...
  message: string;
}
```

## 백엔드: Route Handler 구현

```ts
// app/api/ra/consult/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  const input = ConsultRequestSchema.parse(await req.json());
  await rateLimitCheck(session.user.id);
  await writeAudit({ actor: session.user.id, action: 'consult.start', ... });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of consult(input, session)) {
          controller.enqueue(encodeSSE(event));
        }
      } catch (e) {
        controller.enqueue(encodeSSE({ type: 'error', code: 'llm_failure', message: 'Internal error' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',   // Vercel/nginx 버퍼링 방지
    },
  });
}

function encodeSSE(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}
```

## 프론트: useStreamingAnswer 훅

```ts
// hooks/useStreamingAnswer.ts
export function useStreamingAnswer() {
  const [state, setState] = useState<StreamingState>({
    status: 'idle',
    traceSteps: [],
    prose: '',
    structured: {},
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (input: ConsultRequest) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({ status: 'streaming', traceSteps: [], prose: '', structured: {}, error: null });

    const res = await fetch('/api/ra/consult', {
      method: 'POST',
      body: JSON.stringify(input),
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok || !res.body) {
      setState(s => ({ ...s, status: 'error', error: 'connection_failed' }));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = parseSSEBuffer(buffer);
      buffer = events.remainder;

      for (const ev of events.parsed) {
        applyEvent(setState, ev);
      }
    }
  }, []);

  const abort = () => abortRef.current?.abort();

  return { ...state, start, abort };
}

function applyEvent(setState: Setter, ev: StreamEvent) {
  switch (ev.type) {
    case 'meta':        setState(s => ({ ...s, meta: ev })); break;
    case 'trace':       setState(s => ({ ...s, traceSteps: [...s.traceSteps, ev] })); break;
    case 'prose_delta': setState(s => ({ ...s, prose: s.prose + ev.delta })); break;
    case 'confidence':  setState(s => ({ ...s, structured: { ...s.structured, confidence: ev } })); break;
    case 'sources':     setState(s => ({ ...s, structured: { ...s.structured, sources: ev.items } })); break;
    case 'checklist':   setState(s => ({ ...s, structured: { ...s.structured, checklist: ev.items } })); break;
    case 'comparison':  setState(s => ({ ...s, structured: { ...s.structured, comparison: ev } })); break;
    case 'timeline':    setState(s => ({ ...s, structured: { ...s.structured, timeline: ev.items } })); break;
    case 'related':     setState(s => ({ ...s, structured: { ...s.structured, related: ev.items } })); break;
    case 'expert_review_required':
                        setState(s => ({ ...s, structured: { ...s.structured, expertReviewRequired: ev } })); break;
    case 'done':        setState(s => ({ ...s, status: 'done', duration_ms: ev.duration_ms })); break;
    case 'error':       setState(s => ({ ...s, status: 'error', error: ev.code })); break;
  }
}
```

## 계약 위반 감지 (regula-compliance-qa)

- [ ] `prose_delta`가 `sources`보다 먼저 도착하는가 (순서 위반 시 버그)
- [ ] 모든 prose 종료 후에만 structured blocks가 방출되는가
- [ ] `meta` event가 맨 처음에 정확히 1회만 발행되는가
- [ ] `done` 또는 `error`가 마지막에 정확히 1회 발행되는가
- [ ] `data-source`의 index가 `sources` event의 `citeIndex`와 일치하는가
- [ ] abort 시 서버 측 cleanup 수행 (Langfuse trace에 incomplete 마킹)

## Race condition 방지

- 사용자가 질문 제출 후 즉시 새 질문 제출 시: 기존 `AbortController.abort()` 먼저
- SSE buffer에서 불완전한 event는 다음 chunk로 이월 (위 `parseSSEBuffer`가 처리)
- React 18 strict mode에서 `useEffect` cleanup 시 abort 호출 필수
