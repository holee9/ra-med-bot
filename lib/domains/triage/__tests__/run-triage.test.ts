// @vitest-environment node
/**
 * T-004..T-007: TRIAGE RAG pipeline wrapper tests.
 *
 * Tests exercise runTriage() against mocked consult sub-modules
 * (classifyAndRoute, parallelRetrieveAndMerge, classifyIntent, composePrompt,
 * streamText). enforceCitations and calculateConfidence run as the real
 * implementations because they are pure functions under test.
 *
 * @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-001..007, AC-TRI-01/02/04/07)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (must be set up before importing the module under test) ---

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(),
}));

vi.mock('@/lib/ai/router', () => ({
  classifyAndRoute: vi.fn(async () => ({ intent: 'general', corpora: ['internal'] })),
}));

vi.mock('@/lib/ai/merge', () => ({
  parallelRetrieveAndMerge: vi.fn(async () => []),
}));

vi.mock('@/lib/ai/intent', () => ({
  classifyIntent: vi.fn(async () => 'general'),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => ({ provider: 'test', modelId: 'test' })),
}));

vi.mock('@/lib/ai/prompt-templates', () => ({
  composePrompt: vi.fn(() => ({
    systemPrompt: 'system-prompt',
    chunkContext: 'chunk-context',
    userQuestion: 'question',
  })),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(),
}));

import { classifyIntent } from '@/lib/ai/intent';
import { parallelRetrieveAndMerge } from '@/lib/ai/merge';
import { composePrompt } from '@/lib/ai/prompt-templates';
import { classifyAndRoute } from '@/lib/ai/router';
import { getEnv } from '@/lib/env';
import { streamText } from 'ai';
import { runTriage } from '../run-triage';

// --- Helpers ---

type RetrievalResultLike = {
  id: string;
  content: string;
  score: number;
  sourceId: string;
  metadata: Record<string, unknown>;
};

function makeChunks(count: number): RetrievalResultLike[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `chunk-${index}`,
    content: `content ${index}`,
    score: 0.9 - index * 0.05,
    sourceId: `src-${index}`,
    metadata: {
      title: `Title ${index}`,
      anchor: `anchor-${index}`,
      offset: index * 10,
      orgLabel: 'org',
      type: 'regulation',
      url: null,
      year: 2024,
    },
  }));
}

function makeProseStream(prose: string): AsyncIterable<{ type: string; textDelta?: string }> {
  return (async function* generator() {
    yield { type: 'text-delta', textDelta: prose };
  })();
}

function mockStreamText(prose: string): void {
  const result = { fullStream: makeProseStream(prose) };
  // biome-ignore lint/suspicious/noExplicitAny: streamText mock returns a partial stream shape
  vi.mocked(streamText).mockResolvedValue(result as any);
}

// --- Tests ---

describe('runTriage (SPEC-V3-TRIAGE-001 M2)', () => {
  const baseInput = { question: '510(k) pathway?', orgId: 'org-001', actorId: 'user-001' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockReturnValue({
      TRIAGE_TIMEOUT_MS: 15000,
    } as ReturnType<typeof getEnv>);
    vi.mocked(classifyAndRoute).mockResolvedValue({ intent: 'general', corpora: ['internal'] });
    vi.mocked(parallelRetrieveAndMerge).mockResolvedValue([]);
    vi.mocked(classifyIntent).mockResolvedValue('general');
  });

  /**
   * T-004: normal flow — chunks + cited prose → autoAnswer + autoConfidence.
   */
  it('T-004 returns autoAnswer and confidence on cited success', async () => {
    vi.mocked(parallelRetrieveAndMerge).mockResolvedValue(makeChunks(3));
    const prose =
      'Answer <sup class="cite" data-source="1">1</sup> more <sup class="cite" data-source="2">2</sup>';
    mockStreamText(prose);

    const result = await runTriage(baseInput);

    expect(result.error).toBeUndefined();
    expect(result.autoAnswer).not.toBeNull();
    expect(result.autoAnswer?.answer).toContain('Answer');
    expect(result.autoAnswer?.citations.length).toBe(2);
    expect(result.autoConfidence).not.toBeNull();
    expect(result.autoConfidence ?? 0).toBeGreaterThan(0);
    expect(result.autoConfidence ?? 2).toBeLessThanOrEqual(1);

    // Pipeline call order
    expect(classifyAndRoute).toHaveBeenCalledWith('510(k) pathway?', ['us']);
    expect(parallelRetrieveAndMerge).toHaveBeenCalled();
    expect(classifyIntent).toHaveBeenCalled();
    expect(composePrompt).toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
  });

  /**
   * T-005a (E-01): empty retrieval → no_citations, LLM never called.
   */
  it('T-005a returns no_citations when retrieval yields zero chunks', async () => {
    vi.mocked(parallelRetrieveAndMerge).mockResolvedValue([]);

    const result = await runTriage(baseInput);

    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('no_citations');
    expect(streamText).not.toHaveBeenCalled();
  });

  /**
   * T-005b (AC-06): chunks returned but LLM emitted zero citations → no_citations.
   */
  it('T-005b returns no_citations when LLM prose lacks citations (AC-06)', async () => {
    vi.mocked(parallelRetrieveAndMerge).mockResolvedValue(makeChunks(2));
    mockStreamText('Answer with no citations at all, just plain text.');

    const result = await runTriage(baseInput);

    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('no_citations');
  });

  /**
   * T-006a: timeout — retrieval never resolves within TRIAGE_TIMEOUT_MS.
   */
  it('T-006a returns timeout when pipeline exceeds TRIAGE_TIMEOUT_MS', async () => {
    vi.mocked(getEnv).mockReturnValue({
      TRIAGE_TIMEOUT_MS: 50,
    } as ReturnType<typeof getEnv>);
    vi.mocked(parallelRetrieveAndMerge).mockImplementation(
      () => new Promise<RetrievalResultLike[]>(() => undefined),
    );

    const result = await runTriage(baseInput);

    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('timeout');
  });

  /**
   * T-006b: runtime error — retrieval throws.
   */
  it('T-006b returns runtime_error when retrieval throws', async () => {
    vi.mocked(parallelRetrieveAndMerge).mockRejectedValue(new Error('db down'));

    const result = await runTriage(baseInput);

    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('runtime_error');
  });

  /**
   * T-007: extractCitations compatibility — autoAnswer JSON shape matches
   * promote.ts:24-40 parser ({ answer, citations[{ source, quote? }] }).
   */
  it('T-007 produces autoAnswer JSON compatible with extractCitations parser', async () => {
    const chunks = makeChunks(2);
    vi.mocked(parallelRetrieveAndMerge).mockResolvedValue(chunks);
    const prose =
      'Claim one <sup class="cite" data-source="1">1</sup>. Claim two <sup class="cite" data-source="2">2</sup>.';
    mockStreamText(prose);

    const result = await runTriage(baseInput);

    expect(result.autoAnswer).not.toBeNull();
    const autoAnswerJson = JSON.stringify(result.autoAnswer);
    const parsed = JSON.parse(autoAnswerJson) as {
      answer: string;
      citations: Array<{ source: string }>;
    };
    expect(parsed.answer).toBe(result.autoAnswer?.answer);
    expect(Array.isArray(parsed.citations)).toBe(true);
    expect(parsed.citations).toHaveLength(2);
    expect(parsed.citations[0]).toMatchObject({ source: 'src-0' });
    expect(parsed.citations[1]).toMatchObject({ source: 'src-1' });
  });
});
