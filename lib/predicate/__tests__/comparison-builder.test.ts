// @vitest-environment node
// Unit tests for the predicate substantial-equivalence comparison builder —
// SPEC-REGULA-PREDICATE-001 (REQ-PRE-013 5-dimension structure,
// REQ-PRE-016 LLM-assisted suggestions, REQ-PRE-018 1-3 predicates).

import type { LanguageModel } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock generateText from the ai package. The builder now calls generateText
// internally with an injected LanguageModel, so we intercept at the ai module
// boundary rather than stubbing the model object.
const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

import { createComparisonBuilder } from '../comparison-builder';
import type { ComparisonDimension, PredicateCandidate } from '../types';

const ALL_DIMENSIONS: ComparisonDimension[] = [
  'intended_use',
  'indications',
  'tech_characteristics',
  'materials',
  'performance',
];

/** A no-op LanguageModel stub. The real LLM call is intercepted by mockGenerateText. */
const STUB_MODEL = {} as LanguageModel;

/** Build a predicate candidate with deterministic, distinguishable text. */
function candidate(k: string): PredicateCandidate {
  return {
    k_number: k,
    applicant_name: `Applicant ${k}`,
    device_name: `Device ${k}`,
    decision_date: '2020-01-01',
    decision: 'SESE',
    product_code: 'ABC',
    statement_or_summary: `Summary for ${k}`,
    device_description: `Description for ${k}`,
  };
}

/** Subject inputs covering all five comparison dimensions. */
function subjectInputs(): Record<ComparisonDimension, string> {
  return {
    intended_use: 'Subject intended use',
    indications: 'Subject indications',
    tech_characteristics: 'Subject tech characteristics',
    materials: 'Subject materials',
    performance: 'Subject performance',
  };
}

/**
 * Configure the generateText mock to return a JSON object mapping each
 * dimension to a suggestion string. The builder is expected to issue exactly
 * ONE call regardless of dimension count.
 */
function mockHappyGenerateText(): void {
  const suggestions = ALL_DIMENSIONS.reduce<Record<string, string>>((acc, dim) => {
    acc[dim] = `LLM suggestion for ${dim}`;
    return acc;
  }, {});

  mockGenerateText.mockResolvedValue({ text: JSON.stringify(suggestions) });
}

/** Configure generateText to throw — for graceful degradation. */
function mockFailingGenerateText(): void {
  mockGenerateText.mockRejectedValue(new Error('LLM API unavailable'));
}

describe('createComparisonBuilder', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('produces exactly 5 cells, one per dimension, with a single predicate', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111')],
    });

    expect(result.cells).toHaveLength(5);
    expect(result.cells.map((c) => c.dimension).sort()).toEqual([...ALL_DIMENSIONS].sort());
    for (const cell of result.cells) {
      expect(cell.predicate_texts).toHaveLength(1);
    }
  });

  it('maps predicate_texts one entry per predicate (3 predicates)', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111'), candidate('K222'), candidate('K333')],
    });

    for (const cell of result.cells) {
      expect(cell.predicate_texts).toHaveLength(3);
    }
    // Each predicate_text derives from its predicate's device_description.
    const useCell = result.cells.find((c) => c.dimension === 'intended_use');
    expect(useCell?.predicate_texts).toEqual([
      'Description for K111',
      'Description for K222',
      'Description for K333',
    ]);
  });

  it('rejects more than 3 predicates with "최대 3개" error', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    await expect(
      builder.buildComparison({
        subject_device_name: 'My Subject Device',
        subject_inputs: subjectInputs(),
        selected_predicates: [
          candidate('K111'),
          candidate('K222'),
          candidate('K333'),
          candidate('K444'),
        ],
      }),
    ).rejects.toThrow('최대 3개');
  });

  it('starts every cell.approved as an empty array (never auto-approved)', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111'), candidate('K222')],
    });

    for (const cell of result.cells) {
      expect(cell.approved).toEqual([]);
      expect(cell.approved.some((a) => a === true)).toBe(false);
    }
  });

  it('populates llm_suggestions (one per dimension) from a single LLM call', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111')],
    });

    // REQ-PRE-016: batch into ONE API call, not 5.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    for (const cell of result.cells) {
      expect(cell.llm_suggestions).toBeDefined();
      expect(cell.llm_suggestions).toHaveLength(1);
      expect(cell.llm_suggestions?.[0]).toBe(`LLM suggestion for ${cell.dimension}`);
    }
  });

  it('issues exactly one generateText call (single batched request)', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111')],
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully when the LLM throws (still returns a comparison)', async () => {
    mockFailingGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111')],
    });

    expect(result.cells).toHaveLength(5);
    for (const cell of result.cells) {
      // Suggestions are absent or empty, but the comparison structure stands.
      expect(cell.llm_suggestions ?? []).toHaveLength(0);
      expect(cell.predicate_texts).toHaveLength(1);
      expect(cell.approved).toEqual([]);
    }
  });

  it('maps subject_text from subject_inputs for each dimension', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);
    const inputs = subjectInputs();

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: inputs,
      selected_predicates: [candidate('K111')],
    });

    for (const cell of result.cells) {
      expect(cell.subject_text).toBe(inputs[cell.dimension]);
    }
  });

  it('returns subject_device_name, selected_predicates, and a Date created_at', async () => {
    mockHappyGenerateText();
    const builder = createComparisonBuilder(STUB_MODEL);
    const predicates = [candidate('K111'), candidate('K222')];

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: predicates,
    });

    expect(result.subject_device_name).toBe('My Subject Device');
    expect(result.selected_predicates).toEqual(predicates);
    expect(result.created_at).toBeInstanceOf(Date);
  });
});
