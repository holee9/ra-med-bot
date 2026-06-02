// @vitest-environment node
// Unit tests for the predicate substantial-equivalence comparison builder —
// SPEC-REGULA-PREDICATE-001 (REQ-PRE-013 5-dimension structure,
// REQ-PRE-016 LLM-assisted suggestions, REQ-PRE-018 1-3 predicates).

import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createComparisonBuilder } from '../comparison-builder';
import type { ComparisonDimension, PredicateCandidate } from '../types';

const ALL_DIMENSIONS: ComparisonDimension[] = [
  'intended_use',
  'indications',
  'tech_characteristics',
  'materials',
  'performance',
];

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
 * Build a mock Anthropic client whose messages.create returns a JSON object
 * mapping each dimension to a suggestion string. The builder is expected to
 * issue exactly ONE call regardless of dimension count.
 */
function mockAnthropic(): { client: Anthropic; create: ReturnType<typeof vi.fn<any[], any>> } {
  const suggestions = ALL_DIMENSIONS.reduce<Record<string, string>>((acc, dim) => {
    acc[dim] = `LLM suggestion for ${dim}`;
    return acc;
  }, {});

  const create = vi.fn(async () => ({
    content: [{ type: 'text', text: JSON.stringify(suggestions) }],
  }));

  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

/** A mock Anthropic client that always throws — for graceful degradation. */
function failingAnthropic(): { client: Anthropic; create: ReturnType<typeof vi.fn<any[], any>> } {
  const create = vi.fn(async (): Promise<unknown> => {
    throw new Error('Anthropic API unavailable');
  });
  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

describe('createComparisonBuilder', () => {
  it('produces exactly 5 cells, one per dimension, with a single predicate', async () => {
    const { client } = mockAnthropic();
    const builder = createComparisonBuilder(client);

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
    const { client } = mockAnthropic();
    const builder = createComparisonBuilder(client);

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
    const { client } = mockAnthropic();
    const builder = createComparisonBuilder(client);

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
    const { client } = mockAnthropic();
    const builder = createComparisonBuilder(client);

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
    const { client, create } = mockAnthropic();
    const builder = createComparisonBuilder(client);

    const result = await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111')],
    });

    // REQ-PRE-016: batch into ONE API call, not 5.
    expect(create).toHaveBeenCalledTimes(1);
    for (const cell of result.cells) {
      expect(cell.llm_suggestions).toBeDefined();
      expect(cell.llm_suggestions).toHaveLength(1);
      expect(cell.llm_suggestions?.[0]).toBe(`LLM suggestion for ${cell.dimension}`);
    }
  });

  it('uses the exact claude-haiku-4-5-20251001 model id', async () => {
    const { client, create } = mockAnthropic();
    const builder = createComparisonBuilder(client);

    await builder.buildComparison({
      subject_device_name: 'My Subject Device',
      subject_inputs: subjectInputs(),
      selected_predicates: [candidate('K111')],
    });

    const callArg = create.mock.calls[0]?.[0] as { model: string };
    expect(callArg.model).toBe('claude-haiku-4-5-20251001');
  });

  it('degrades gracefully when the LLM throws (still returns a comparison)', async () => {
    const { client } = failingAnthropic();
    const builder = createComparisonBuilder(client);

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
    const { client } = mockAnthropic();
    const builder = createComparisonBuilder(client);
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
    const { client } = mockAnthropic();
    const builder = createComparisonBuilder(client);
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
