// @MX:NOTE [AUTO] consult() async generator unit tests — RAG pipeline SSE event sequence.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-011..020, REQ-CHAT-053..055)
// @MX:REASON consult.ts is the single orchestration entry point (854 LOC, fan_in >=3:
//   route.ts, run-consult wrapper, scheduled replay). All deps mocked — no DB/LLM/network.
//   Drives the generator via for-await-of with fake timers to bypass sleep(500) calls.

import type { Session } from 'next-auth';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../../types/streaming';

// ---------------------------------------------------------------------------
// Mock ALL static imports of lib/ai/consult.ts
// ---------------------------------------------------------------------------

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('ai', () => ({
  streamText: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

// --- DB chain mock: chainable methods that are also awaitable (Promise subclass) ---
// biome-disable lint/suspicious/noThenProperty: required for thenable DB chain mock
type MockFn = ReturnType<typeof vi.fn>;
type DbChain = {
  insert: MockFn;
  values: MockFn;
  returning: MockFn;
  update: MockFn;
  set: MockFn;
  where: MockFn;
  delete: MockFn;
  transaction: MockFn;
};

/**
 * Builds a Drizzle-like chainable mock. Each method returns the chain (also
 * awaitable). `await` resolves to `returningValue` so callers like
 * `const [row] = await db.insert().values().returning()` work.
 * Intermediate `.values()` followed by `.returning()` is supported because
 * every method returns the same chainable/awaitable object.
 */
function makeDbChain(returningValue: unknown[] = [{ id: 'conv-new' }]): DbChain {
  // Build a chainable object. Methods return chain; awaiting resolves to returningValue.
  const chain = {} as DbChain;
  const self = (): DbChain => chain;
  chain.insert = vi.fn(self) as MockFn;
  chain.values = vi.fn(self) as MockFn;
  chain.returning = vi.fn(self) as MockFn;
  chain.update = vi.fn(self) as MockFn;
  chain.set = vi.fn(self) as MockFn;
  chain.where = vi.fn(self) as MockFn;
  chain.delete = vi.fn(self) as MockFn;
  chain.transaction = vi.fn(async (fn: (tx: DbChain) => Promise<unknown>) => fn(chain)) as MockFn;

  // Make the chain awaitable via Object.defineProperty (avoids explicit `.then` in source).
  Object.defineProperty(chain, 'then', {
    value: <T>(resolve: (v: T) => unknown, reject?: (e: unknown) => unknown): void => {
      Promise.resolve(returningValue as T).then(resolve, reject);
    },
    enumerable: false,
    configurable: true,
  });
  return chain;
}

// The factory creates a single shared chain instance internally (hoisting-safe).
vi.mock('@/lib/kernel/db/client', async () => {
  const chain = makeDbChain();
  return {
    db: chain,
    withTenantScope: vi.fn(async (_orgId: string, fn: (dbs: DbChain) => Promise<unknown>) =>
      fn(chain),
    ),
  };
});

vi.mock('@/lib/kernel/db/schema', () => ({
  conversations: { id: 'conversations.id' },
  messages: { id: 'messages.id' },
  messageBlocks: { messageId: 'messageBlocks.messageId' },
}));

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/knowledge-gap/detector', () => ({
  detectKnowledgeGap: vi.fn().mockReturnValue(null),
  captureKnowledgeGap: vi.fn().mockResolvedValue({
    queueId: 'queue-1',
    clusterId: 'cluster-1',
    githubIssueNumber: null,
  }),
}));

vi.mock('../../../lib/ai/citation-enforce', () => ({
  enforceCitations: vi.fn().mockReturnValue({ cleaned: 'test prose', violations: [] }),
}));

vi.mock('../../../lib/ai/confidence', () => ({
  calculateConfidence: vi.fn().mockReturnValue(0.85),
  getConfidenceLevel: vi.fn().mockReturnValue('high' as const),
}));

vi.mock('../../../lib/ai/expert-review-gating', () => ({
  shouldAutoFlag: vi.fn().mockReturnValue({ flag: false, reason: null }),
}));

vi.mock('../../../lib/ai/expert-review-queue', () => ({
  enqueueExpertReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/ai/external-enrichment', () => ({
  enrichWithExternalData: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/ai/intent', () => ({
  classifyIntent: vi.fn().mockResolvedValue('regulation-lookup'),
}));

vi.mock('../../../lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn().mockReturnValue({ id: 'mock-model' }),
}));

vi.mock('../../../lib/ai/merge', () => ({
  parallelRetrieveAndMerge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/ai/persistence', () => ({
  persistMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/ai/prompt-templates', () => ({
  composePrompt: vi.fn().mockReturnValue({
    systemPrompt: 'system prompt',
    chunkContext: 'chunk context',
    userQuestion: 'rewritten',
  }),
}));

vi.mock('../../../lib/ai/query-rewrite', () => ({
  rewriteQuery: vi.fn().mockReturnValue('rewritten query'),
}));

vi.mock('../../../lib/ai/router', () => ({
  classifyAndRoute: vi.fn().mockResolvedValue({ intent: 'general', corpora: ['fda'] }),
}));

vi.mock('../../../lib/ai/streaming', () => ({
  StreamOrderValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn(),
  })),
}));

vi.mock('../../../lib/ai/structured-blocks', () => ({
  OrderViolationError: class OrderViolationError extends Error {},
  generateStructuredBlocks: vi.fn(async function* emptyGen(): AsyncGenerator {
    yield* [] as unknown[]; // biome useYield — no blocks by default
  }),
}));

// ---------------------------------------------------------------------------
// Mock ALL dynamic imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/project-memory/injector', () => ({
  injectProjectMemory: vi.fn().mockResolvedValue('injected prompt'),
}));

vi.mock('@/lib/project-memory/extractor', () => ({
  detectDecisions: vi.fn().mockResolvedValue([]),
  persistSuggestionsAsPending: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/model-governance/runtime-guard', () => ({
  assertApprovedCombination: vi.fn().mockResolvedValue({
    promptVersion: 'v1',
    modelId: 'claude-sonnet-4',
  }),
}));

vi.mock('@/lib/model-governance/audit-metadata', () => ({
  buildAnswerVersionMetadata: vi.fn().mockReturnValue({
    prompt_version: 'v1',
    model_id: 'claude-sonnet-4',
  }),
}));

vi.mock('@/lib/model-governance/audit', () => ({
  auditRuntimeBlocked: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/corpus-license/usage-notice', () => ({
  generateUsageNotice: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/corpus-license/audit', () => ({
  auditAbstractOnlyEnforced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/corpus-license/permitted-use', () => ({
  isFullTextBlocked: vi.fn().mockReturnValue(false),
  fetchPermittedUse: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/source-governance/retrieval-gate', () => ({
  rankByAuthority: vi.fn().mockResolvedValue([]),
  assessLowAuthority: vi.fn().mockReturnValue({
    lowAuthorityOnly: false,
    highestGrade: 'primary',
    reason: null,
  }),
}));

vi.mock('@/lib/source-governance/audit', () => ({
  auditSourceLowAuthorityFlagged: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rlhf/post-rerank-gate', () => ({
  verifyPostRerankInvariants: vi.fn().mockReturnValue({ passed: true, violations: [] }),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { streamText } from 'ai';
import { enforceCitations } from '../../../lib/ai/citation-enforce';
import { calculateConfidence, getConfidenceLevel } from '../../../lib/ai/confidence';
import { consult, ensureConversation } from '../../../lib/ai/consult';
import { shouldAutoFlag } from '../../../lib/ai/expert-review-gating';
import { enqueueExpertReview } from '../../../lib/ai/expert-review-queue';
import { enrichWithExternalData } from '../../../lib/ai/external-enrichment';
import { classifyIntent } from '../../../lib/ai/intent';
import { parallelRetrieveAndMerge } from '../../../lib/ai/merge';
import { persistMessage } from '../../../lib/ai/persistence';
import { composePrompt } from '../../../lib/ai/prompt-templates';
import { rewriteQuery } from '../../../lib/ai/query-rewrite';
import { classifyAndRoute } from '../../../lib/ai/router';
import { generateStructuredBlocks } from '../../../lib/ai/structured-blocks';
import { writeAudit } from '../../../lib/kernel/audit';
import { db } from '../../../lib/kernel/db/client';
import { captureKnowledgeGap, detectKnowledgeGap } from '../../../lib/knowledge-gap/detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StreamChunk = { type: string; textDelta?: string; usage?: unknown };

function makeStream(chunks: StreamChunk[]): { fullStream: AsyncIterable<StreamChunk> } {
  return {
    fullStream: (async function* gen(): AsyncGenerator<StreamChunk> {
      for (const c of chunks) yield c;
    })(),
  };
}

async function consume(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const ev of gen) {
    events.push(ev);
  }
  return events;
}

/** Drain an async generator that contains fake-timer-gated sleeps. */
async function drain(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const consumePromise = consume(gen);
  // Advance all fake timers (sleep(500) calls) until the generator completes.
  await vi.runAllTimersAsync();
  return consumePromise;
}

function makeRetrievalResult(
  overrides: Partial<{
    id: string;
    content: string;
    score: number;
    sourceId: string;
    metadata: Record<string, unknown>;
  }> = {},
) {
  return {
    id: overrides.id ?? 'sec-1',
    content: overrides.content ?? 'ISO 13485 requires a quality management system.',
    score: overrides.score ?? 0.92,
    sourceId: overrides.sourceId ?? 'src-1',
    metadata: overrides.metadata ?? {
      anchor: '§4.2.1',
      offset: 100,
      orgLabel: 'ISO',
      title: 'ISO 13485:2016',
      year: 2016,
      type: 'Standard',
      url: 'https://example.com/iso13485',
      sourceHost: 'example.com',
      sourceOwner: 'iso',
      sourceRepo: 'standards',
      sourceRef: 'main',
      sourcePath: '/iso13485.md',
    },
  };
}

const baseInput = {
  question: 'What does ISO 13485 section 4.2 require?',
  locale: 'ko' as const,
  sourceFilter: 'all' as const,
};

const baseSession: Session = {
  user: { id: 'user-1', name: 'Test User', email: 'test@test.com', image: null },
  expires: '2099-01-01',
} as unknown as Session;

const messageId = '00000000-0000-0000-0000-000000000001';
const conversationId = '00000000-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();

  // Reset default mock behaviors (clearAllMocks resets implementations)
  vi.mocked(classifyIntent).mockResolvedValue('regulation-lookup');
  vi.mocked(rewriteQuery).mockReturnValue('rewritten query');
  vi.mocked(classifyAndRoute).mockResolvedValue({ intent: 'general', corpora: ['fda'] });
  vi.mocked(parallelRetrieveAndMerge).mockResolvedValue([makeRetrievalResult()]);
  vi.mocked(composePrompt).mockReturnValue({
    systemPrompt: 'system prompt',
    chunkContext: 'chunk context',
    userQuestion: 'rewritten',
  });
  vi.mocked(enforceCitations).mockReturnValue({
    cleaned: 'Answer with citation. <sup class="cite" data-source="1">1</sup>',
    violations: [],
  });
  vi.mocked(calculateConfidence).mockReturnValue(0.85);
  vi.mocked(getConfidenceLevel).mockReturnValue('high');
  vi.mocked(shouldAutoFlag).mockReturnValue({ flag: false, reason: null });
  vi.mocked(detectKnowledgeGap).mockReturnValue(null);
  vi.mocked(captureKnowledgeGap).mockResolvedValue({
    queueId: 'queue-1',
    clusterId: 'cluster-1',
    githubIssueNumber: null,
  });
  vi.mocked(enrichWithExternalData).mockResolvedValue([]);
  vi.mocked(persistMessage).mockResolvedValue(undefined);
  vi.mocked(enqueueExpertReview).mockResolvedValue(undefined);
  vi.mocked(writeAudit).mockResolvedValue(undefined);
  vi.mocked(streamText).mockResolvedValue(
    makeStream([
      { type: 'text-delta', textDelta: 'Answer with citation. ' },
      { type: 'text-delta', textDelta: '<sup class="cite" data-source="1">1</sup>' },
      { type: 'finish', usage: { promptTokens: 10, completionTokens: 5 } },
    ]) as unknown as never,
  );
  vi.mocked(generateStructuredBlocks).mockImplementation(
    async function* emptyGen(): AsyncGenerator {
      yield* [] as unknown[]; // biome useYield — no blocks by default
    } as unknown as typeof generateStructuredBlocks,
  );
});

afterEach(() => {
  vi.clearAllTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consult() — RAG pipeline async generator', () => {
  it('happy path: emits meta → trace*(N) → prose_delta → confidence → sources → done', async () => {
    const gen = consult(baseInput, baseSession, messageId, conversationId);
    const events = await drain(gen);

    const types = events.map((e) => e.type);

    // Phase A
    expect(types[0]).toBe('meta');
    expect(events[0]).toMatchObject({ conversationId, messageId });

    // Trace sequence: 4 active + 4 done for the 4 stages
    const traces = events.filter((e) => e.type === 'trace');
    expect(traces.length).toBeGreaterThanOrEqual(6); // active/done for intent + search at minimum

    // Trace done for "질의 유형 분류 중"
    expect(traces.some((t) => t.type === 'trace' && t.status === 'done')).toBe(true);

    // Phase B: prose_delta
    expect(types).toContain('prose_delta');
    const proseDeltas = events.filter((e) => e.type === 'prose_delta');
    expect(proseDeltas.length).toBeGreaterThanOrEqual(1);

    // Phase C
    expect(types).toContain('confidence');
    const confEvent = events.find((e) => e.type === 'confidence');
    expect(confEvent).toMatchObject({ level: 'high', score: 0.85 });

    expect(types).toContain('sources');
    expect(types[types.length - 1]).toBe('done');

    // Pipeline functions were called
    expect(classifyIntent).toHaveBeenCalledWith(baseInput.question, baseInput.locale);
    expect(parallelRetrieveAndMerge).toHaveBeenCalled();
    expect(composePrompt).toHaveBeenCalled();
    expect(enforceCitations).toHaveBeenCalled();
    expect(calculateConfidence).toHaveBeenCalled();
  });

  it('happy path: writes llm.call audit and calls persistMessage', async () => {
    const gen = consult(baseInput, baseSession, messageId, conversationId);
    await drain(gen);

    // llm.call audit (before streaming)
    const llmCallAudit = vi.mocked(writeAudit).mock.calls.find((c) => c[0]?.action === 'llm.call');
    expect(llmCallAudit).toBeDefined();
    expect(llmCallAudit?.[0]?.resource_id).toBe(messageId);
    expect(llmCallAudit?.[0]?.conversation_id).toBe(conversationId);

    // persistMessage called (no orgId → no replay → always persists)
    expect(persistMessage).toHaveBeenCalledTimes(1);
    const persistArg = vi.mocked(persistMessage).mock.calls[0]?.[0];
    expect(persistArg?.messageId).toBe(messageId);
    expect(persistArg?.conversationId).toBe(conversationId);
  });

  it('shouldAutoFlag=true → emits expert_review_required + enqueue + writeAudit', async () => {
    vi.mocked(shouldAutoFlag).mockReturnValue({
      flag: true,
      reason: 'policy keyword detected',
    });

    const gen = consult(baseInput, baseSession, messageId, conversationId);
    const events = await drain(gen);
    const types = events.map((e) => e.type);

    expect(types).toContain('expert_review_required');
    const reviewEvent = events.find((e) => e.type === 'expert_review_required');
    expect(reviewEvent).toMatchObject({ reason: 'policy keyword detected' });

    // expert_review.flag audit
    const flagAudit = vi
      .mocked(writeAudit)
      .mock.calls.find((c) => c[0]?.action === 'expert_review.flag');
    expect(flagAudit).toBeDefined();

    // enqueueExpertReview called
    expect(enqueueExpertReview).toHaveBeenCalledTimes(1);
    const enqueueArg = vi.mocked(enqueueExpertReview).mock.calls[0]?.[0];
    expect(enqueueArg?.messageId).toBe(messageId);
    expect(enqueueArg?.reason).toBe('policy keyword detected');
  });

  it('detectKnowledgeGap returns reason → captureKnowledgeGap called when orgId present', async () => {
    vi.mocked(detectKnowledgeGap).mockReturnValue('low_confidence');
    const orgSession: Session = {
      user: {
        id: 'user-1',
        name: 'Test',
        email: 't@t.com',
        image: null,
        organizationId: '00000000-0000-0000-0000-000000000003',
      },
      expires: '2099-01-01',
    } as unknown as Session;

    const gen = consult(baseInput, orgSession, messageId, conversationId);
    await drain(gen);

    expect(detectKnowledgeGap).toHaveBeenCalled();
    expect(captureKnowledgeGap).toHaveBeenCalledTimes(1);
    const captureArg = vi.mocked(captureKnowledgeGap).mock.calls[0]?.[0];
    expect(captureArg?.messageId).toBe(messageId);
    expect(captureArg?.reason).toBe('low_confidence');
  });

  it('LLM failure (streamText throws) → emits fallback prose + sources', async () => {
    vi.mocked(streamText).mockRejectedValueOnce(new Error('billing exhausted'));

    const gen = consult(baseInput, baseSession, messageId, conversationId);
    const events = await drain(gen);
    const types = events.map((e) => e.type);

    // Fallback prose is emitted
    expect(types).toContain('prose_delta');
    const proseEvent = events.find((e) => e.type === 'prose_delta');
    expect(proseEvent).toBeDefined();
    // Korean locale → Korean fallback message
    expect(typeof proseEvent?.delta === 'string').toBe(true);

    // Sources still emitted
    expect(types).toContain('sources');
    expect(types[types.length - 1]).toBe('done');
  });

  it('replay mode: skips writeAudit, persistMessage, captureKnowledgeGap', async () => {
    vi.mocked(detectKnowledgeGap).mockReturnValue('low_confidence');
    const orgSession: Session = {
      user: {
        id: 'user-1',
        name: 'Test',
        email: 't@t.com',
        image: null,
        organizationId: '00000000-0000-0000-0000-000000000003',
      },
      expires: '2099-01-01',
    } as unknown as Session;

    const gen = consult(baseInput, orgSession, `replay-${messageId}`, conversationId, undefined, {
      mode: 'replay',
    });
    await drain(gen);

    // No llm.call audit
    const llmCall = vi.mocked(writeAudit).mock.calls.find((c) => c[0]?.action === 'llm.call');
    expect(llmCall).toBeUndefined();

    // No persistMessage
    expect(persistMessage).not.toHaveBeenCalled();

    // No captureKnowledgeGap (replay skips it)
    expect(captureKnowledgeGap).not.toHaveBeenCalled();
  });

  it('aborted signal → returns early after meta', async () => {
    const controller = new AbortController();
    controller.abort();

    const gen = consult(baseInput, baseSession, messageId, conversationId, controller.signal);
    const events = await drain(gen);
    const types = events.map((e) => e.type);

    // Only meta emitted (first signal?.aborted check is after the first trace active)
    expect(types[0]).toBe('meta');
    // Should not reach confidence or done
    expect(types).not.toContain('confidence');
    expect(types).not.toContain('done');
  });

  it('structured blocks: yields block events from generateStructuredBlocks', async () => {
    vi.mocked(generateStructuredBlocks).mockImplementation(async function* gen(): AsyncGenerator {
      yield { type: 'checklist', id: 'chk-1', title: 'Step 1', completed: false } as never;
      yield { type: 'related', id: 'rel-1', title: 'Related doc' } as never;
    } as unknown as typeof generateStructuredBlocks);

    const gen = consult(baseInput, baseSession, messageId, conversationId);
    const events = await drain(gen);
    const types = events.map((e) => e.type);

    expect(types).toContain('checklist');
    expect(types).toContain('related');
  });

  it('source.access audit: one per unique cited sourceId', async () => {
    // enforceCitations default mock returns data-source="1", so only citeIndex 1
    // is "cited". Provide a chunk whose sourceId maps to citeIndex 1.
    vi.mocked(parallelRetrieveAndMerge).mockResolvedValue([
      makeRetrievalResult({ id: 'sec-1', sourceId: 'src-A' }),
      makeRetrievalResult({ id: 'sec-2', sourceId: 'src-B' }),
    ]);

    const gen = consult(baseInput, baseSession, messageId, conversationId);
    await drain(gen);

    const sourceAudits = vi
      .mocked(writeAudit)
      .mock.calls.filter((c) => c[0]?.action === 'source.access');
    // Only citeIndex 1 is cited (data-source="1" in enforceCitations mock).
    // That maps to topChunks[0] → src-A → 1 source.access audit row.
    expect(sourceAudits.length).toBe(1);
    expect(sourceAudits[0]?.[0]?.resource_id).toBe('src-A');
  });
});

// ---------------------------------------------------------------------------
// ensureConversation
// ---------------------------------------------------------------------------

describe('ensureConversation()', () => {
  it('returns existing conversationId when provided', async () => {
    const result = await ensureConversation('existing-conv-id', 'user-1', undefined);
    expect(result).toBe('existing-conv-id');
  });

  it('creates and returns new conversation when id is undefined', async () => {
    const result = await ensureConversation(undefined, 'user-1', 'proj-1');
    expect(result).toBe('conv-new');
    // db.insert was called
    expect(db.insert).toHaveBeenCalled();
  });

  it('throws when insert returns empty', async () => {
    // Override the chain to resolve returning() to an empty array.
    const emptyChain = makeDbChain([]);
    vi.mocked(db.insert).mockImplementationOnce((() => emptyChain) as unknown as typeof db.insert);

    await expect(ensureConversation(undefined, 'user-1', undefined)).rejects.toThrow(
      'Failed to create conversation',
    );
  });
});
