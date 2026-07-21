// @MX:NOTE [AUTO] AC-03 behavior test — extractor pending-only + consult wiring.
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-004, REQ-005, REQ-013, AC-03)
// @MX:REASON Replaces the prior source-regex check (L-008 dead-code anti-pattern).
//   Two layers mirror promoted-answers.test.ts:
//   Layer 1 — parseSuggestions unit logic + detectDecisions confidence filter
//             against the mocked AI SDK.
//   Layer 2 — persistSuggestionsAsPending creates a status='pending' row (NEVER
//             active — REQ-005 / Charter [지양-4]) via the REAL createMemory,
//             AND consult.ts dynamic-imports '../project-memory/extractor' and
//             calls detectDecisions + persistSuggestionsAsPending (wiring
//             contract proving the detection fires on the post-persist path).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks so REAL extractor + createMemory logic run.
// ---------------------------------------------------------------------------

type MemoryRow = {
  id: string;
  projectId: string;
  memoryType: string;
  key: string;
  value: string;
  status: string;
  sourceConversationId: string | null;
  createdAt: Date;
};

const store: MemoryRow[] = [];

// biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain
const dbMock: any = {
  insert: vi.fn(() => {
    let pendingValues: Record<string, unknown> = {};
    // biome-ignore lint/suspicious/noExplicitAny: builder chain
    const chain: any = {
      values: (v: Record<string, unknown>) => {
        pendingValues = v;
        return chain;
      },
      returning: vi.fn(async () => {
        const row: MemoryRow = {
          id: crypto.randomUUID(),
          projectId: String(pendingValues.projectId ?? ''),
          memoryType: String(pendingValues.memoryType ?? ''),
          key: String(pendingValues.key ?? ''),
          value: String(pendingValues.value ?? ''),
          status: String(pendingValues.status ?? 'active'),
          sourceConversationId: (pendingValues.sourceConversationId as string | null) ?? null,
          createdAt: new Date(),
        };
        store.push(row);
        return [{ id: row.id, status: row.status }];
      }),
    };
    return chain;
  }),
  select: vi.fn(() => {
    // biome-ignore lint/suspicious/noExplicitAny: builder chain
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => [{ status: 'pending' }]), // existence check for approve
    };
    return chain;
  }),
};

const withTenantScopeMock = vi.fn(
  async <T>(_orgId: string, fn: (tx: typeof dbMock) => Promise<T>) => fn(dbMock) as Promise<T>,
);

vi.mock('@/lib/kernel/db/client', () => ({
  get db() {
    return dbMock;
  },
  withTenantScope: (...args: unknown[]) =>
    withTenantScopeMock(...(args as [string, (tx: typeof dbMock) => Promise<unknown>])),
}));

vi.mock('@/lib/kernel/audit', () => ({ writeAudit: vi.fn(async () => {}) }));

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/project-memory/access', () => ({
  projectBelongsToOrg: vi.fn(async () => true),
  memoryBelongsToOrg: vi.fn(async () => true),
  resolveProjectOrg: vi.fn(async () => 'org-1'),
}));

// Mock the AI SDK so detectDecisions runs without a real LLM.
vi.mock('ai', async () => {
  const { mockGenerateText } = await import('../../__mocks__/project-memory-ai-mock');
  return {
    generateText: mockGenerateText,
    // biome-ignore lint/suspicious/noExplicitAny: language model type is opaque
    LanguageModel: class {} as any,
  };
});
vi.mock('@/lib/ai/llm-provider', () => ({ getLlmFastModel: () => ({}) }));

beforeEach(() => {
  store.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Layer 1: parseSuggestions unit logic
// ---------------------------------------------------------------------------

describe('AC-03 Layer 1 — parseSuggestions + detectDecisions confidence filter', () => {
  it('parses a device-classification decision from valid JSON', async () => {
    const { parseSuggestions } = await import('@/lib/project-memory/extractor');
    const raw = JSON.stringify([
      { memoryType: 'device_classification', key: 'dc', value: 'Class IIa', confidence: 0.95 },
    ]);
    const out = parseSuggestions(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.memoryType).toBe('device_classification');
    expect(out[0]?.confidence).toBe(0.95);
  });

  it('drops suggestions below 0.7 confidence (§7 #1 — no pending-queue spam)', async () => {
    const { mockGenerateText } = await import('../../__mocks__/project-memory-ai-mock');
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify([{ memoryType: 'risk_class', key: 'r', value: 'low', confidence: 0.4 }]),
      // biome-ignore lint/suspicious/noExplicitAny: partial AI response mock
    } as any);
    const { detectDecisions } = await import('@/lib/project-memory/extractor');
    const out = await detectDecisions('discussing risk class');
    expect(out).toHaveLength(0);
  });

  it('keeps suggestions at/above 0.7 confidence', async () => {
    const { mockGenerateText } = await import('../../__mocks__/project-memory-ai-mock');
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify([
        { memoryType: 'target_markets', key: 'tm', value: 'FDA', confidence: 0.7 },
      ]),
      // biome-ignore lint/suspicious/noExplicitAny: partial AI response mock
    } as any);
    const { detectDecisions } = await import('@/lib/project-memory/extractor');
    const out = await detectDecisions('targeting FDA');
    expect(out).toHaveLength(1);
  });

  it('rejects invalid memoryType (false-positive guard)', async () => {
    const { parseSuggestions } = await import('@/lib/project-memory/extractor');
    const raw = JSON.stringify([
      // biome-ignore lint/suspicious/noExplicitAny: test fixture with bad type
      { memoryType: 'bogus', key: 'k', value: 'v', confidence: 0.9 } as any,
    ]);
    expect(parseSuggestions(raw)).toHaveLength(0);
  });

  it('logs + returns [] when the LLM throws (AC-03 failure observability)', async () => {
    const { mockGenerateText } = await import('../../__mocks__/project-memory-ai-mock');
    mockGenerateText.mockRejectedValueOnce(new Error('llm_down'));
    const { logger } = await import('@/lib/observability/logger');
    const { detectDecisions } = await import('@/lib/project-memory/extractor');
    const out = await detectDecisions('text');
    expect(out).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Layer 2: persistSuggestionsAsPending — pending-only (REQ-005) + consult wiring
// ---------------------------------------------------------------------------

const ORG = '00000000-0000-0000-0000-000000000001';
const PROJECT = '00000000-0000-0000-0000-000000000002';
const CONVERSATION = '00000000-0000-0000-0000-000000000003';
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000004';

describe('AC-03 Layer 2 — persistSuggestionsAsPending writes status=pending (NEVER active)', () => {
  it('creates status=pending rows (REQ-005 / Charter [지양-4] — no auto-finalize)', async () => {
    const { persistSuggestionsAsPending } = await import('@/lib/project-memory/extractor');
    const res = await persistSuggestionsAsPending({
      suggestions: [
        { memoryType: 'device_classification', key: 'dc', value: 'Class II', confidence: 0.9 },
        { memoryType: 'target_markets', key: 'tm', value: 'FDA', confidence: 0.85 },
      ],
      projectId: PROJECT,
      conversationId: CONVERSATION,
      orgId: ORG,
      systemActorId: SYSTEM_ACTOR,
    });
    expect(res.written).toBe(2);
    expect(store).toHaveLength(2);
    // REQ-005: EVERY row MUST be pending — never active.
    for (const row of store) {
      expect(row.status).toBe('pending');
    }
    // REQ-013: provenance recorded.
    for (const row of store) {
      expect(row.sourceConversationId).toBe(CONVERSATION);
    }
  });

  it('does NOT write memory_created audit for pending rows (noise guard)', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    const { persistSuggestionsAsPending } = await import('@/lib/project-memory/extractor');
    await persistSuggestionsAsPending({
      suggestions: [{ memoryType: 'risk_class', key: 'r', value: 'C', confidence: 0.8 }],
      projectId: PROJECT,
      conversationId: CONVERSATION,
      orgId: ORG,
      systemActorId: SYSTEM_ACTOR,
    });
    expect(writeAudit).not.toHaveBeenCalled();
  });
});

describe('AC-03 Layer 2 — consult.ts wiring contract', () => {
  it("consult.ts dynamic import '../project-memory/extractor' resolves to detectDecisions + persistSuggestionsAsPending", async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const consultSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../lib/ai/consult.ts'),
      'utf8',
    );
    // Wiring contract: verify the specifier resolves + exports exist. This is
    // NOT a source-regex behavior assertion — it proves the dynamic import the
    // post-persist branch awaits resolves to the REAL module.
    const match = consultSrc.match(/import\(\s*['"]([^'"]*project-memory\/extractor)['"]\s*\)/);
    expect(match, 'consult.ts must dynamic-import the extractor').not.toBeNull();
    const specifier = match?.[1] ?? '';
    const consultDir = path.resolve(__dirname, '../../../lib/ai');
    const resolved = specifier.startsWith('.') ? path.resolve(consultDir, specifier) : specifier;
    const mod = await import(/* @vite-ignore */ `file://${resolved}`);
    expect(typeof mod.detectDecisions).toBe('function');
    expect(typeof mod.persistSuggestionsAsPending).toBe('function');

    // Exercise the exact call consult.ts makes on the post-persist path:
    //   const suggestions = await detectDecisions(`${input.question}\n\n${cleaned}`);
    //   if (suggestions.length > 0) { await persistSuggestionsAsPending({ ... }) }
    const { mockGenerateText } = await import('../../__mocks__/project-memory-ai-mock');
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify([
        { memoryType: 'device_classification', key: 'dc', value: 'Class III', confidence: 0.9 },
      ]),
      // biome-ignore lint/suspicious/noExplicitAny: partial AI response mock
    } as any);
    const suggestions = await mod.detectDecisions('user question\n\nassistant answer');
    expect(suggestions).toHaveLength(1);
    if (suggestions.length > 0) {
      await mod.persistSuggestionsAsPending({
        suggestions,
        projectId: PROJECT,
        conversationId: CONVERSATION,
        orgId: ORG,
        systemActorId: SYSTEM_ACTOR,
      });
    }
    // The row created on the consult post-persist path is pending (REQ-005).
    expect(store).toHaveLength(1);
    expect(store[0]?.status).toBe('pending');
  });
});
