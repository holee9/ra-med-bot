// @MX:NOTE [AUTO] T-009 TDD RED phase — router.ts tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-038)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock generateText from the ai SDK so no real Haiku calls are made.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({})),
}));

describe('lib/ai/router.ts (REQ-BREADTH-038)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('router.ts file exists', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '..', '..', '..');
    const filePath = path.join(root, 'lib', 'ai', 'router.ts');
    expect(fs.existsSync(filePath), 'lib/ai/router.ts does not exist').toBe(true);
  });

  it('exports classifyAndRoute function', async () => {
    const mod = await import('@/lib/ai/router');
    expect(typeof mod.classifyAndRoute).toBe('function');
  });

  it('exports intentToCorpora mapping', async () => {
    const mod = await import('@/lib/ai/router');
    expect(mod.intentToCorpora).toBeDefined();
    expect(typeof mod.intentToCorpora).toBe('object');
  });

  it('classifyAndRoute returns intent and corpora', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'regulation-lookup',
    } as Awaited<ReturnType<typeof generateText>>);

    const { classifyAndRoute } = await import('@/lib/ai/router');
    const result = await classifyAndRoute('What is 21 CFR Part 820?', ['us']);

    expect(result).toHaveProperty('intent');
    expect(result).toHaveProperty('corpora');
    expect(Array.isArray(result.corpora)).toBe(true);
  });

  it('classifyAndRoute maps regulation-lookup intent to fda corpus for us market', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'regulation-lookup',
    } as Awaited<ReturnType<typeof generateText>>);

    const { classifyAndRoute } = await import('@/lib/ai/router');
    const result = await classifyAndRoute('Tell me about 510(k)', ['us']);

    expect(result.intent).toBe('regulation-lookup');
    expect(result.corpora).toContain('fda');
  });

  it('classifyAndRoute maps regulation-lookup intent to eu-mdr corpus for eu market', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'regulation-lookup',
    } as Awaited<ReturnType<typeof generateText>>);

    const { classifyAndRoute } = await import('@/lib/ai/router');
    const result = await classifyAndRoute('What does EU MDR Article 5 say?', ['eu']);

    expect(result.intent).toBe('regulation-lookup');
    expect(result.corpora).toContain('eu-mdr');
  });

  it('classifyAndRoute includes multiple corpora for multiple target markets', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'regulation-lookup',
    } as Awaited<ReturnType<typeof generateText>>);

    const { classifyAndRoute } = await import('@/lib/ai/router');
    const result = await classifyAndRoute('Compare FDA vs MDR requirements', ['us', 'eu']);

    expect(result.corpora.length).toBeGreaterThanOrEqual(2);
    expect(result.corpora).toContain('fda');
    expect(result.corpora).toContain('eu-mdr');
  });

  it('classifyAndRoute defaults to general intent when Haiku returns unknown text', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'unknown-gibberish',
    } as Awaited<ReturnType<typeof generateText>>);

    const { classifyAndRoute } = await import('@/lib/ai/router');
    const result = await classifyAndRoute('Hello', ['us']);

    expect(result.intent).toBe('general');
  });

  it('classifyAndRoute always includes internal-sops corpus', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'general',
    } as Awaited<ReturnType<typeof generateText>>);

    const { classifyAndRoute } = await import('@/lib/ai/router');
    const result = await classifyAndRoute('How do I prepare a submission?', ['us']);

    expect(result.corpora).toContain('internal-sops');
  });

  // AC-04 dead-code regression (SPEC-REGULA-KNOWLEDGE-PROMO-001, REQ-009/010):
  // org_promoted MUST be in the corpora set for every intent so
  // PromotedAnswersRetriever actually fires in merge.ts. Before the 2026-06-26
  // fix this assertion failed for all intents — the retriever was registered
  // but never selected, making the entire knowledge-promo feature dead code.
  it('classifyAndRoute always includes org_promoted corpus (AC-04 regression)', async () => {
    const { generateText } = await import('ai');
    const { classifyAndRoute } = await import('@/lib/ai/router');
    const intents = ['regulation-lookup', 'strategy', 'comparison', 'timeline', 'general'];
    for (const intent of intents) {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: intent,
      } as Awaited<ReturnType<typeof generateText>>);
      const result = await classifyAndRoute('q', ['us']);
      expect(result.corpora).toContain('org_promoted');
    }
  });

  it('intentToCorpora has entries for all expected intent types', async () => {
    const { intentToCorpora } = await import('@/lib/ai/router');
    const expectedIntents = ['regulation-lookup', 'strategy', 'comparison', 'timeline', 'general'];

    for (const intent of expectedIntents) {
      expect(intentToCorpora).toHaveProperty(intent);
    }
  });
});
