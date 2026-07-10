// SPEC-REGULA-WORKFLOWS-LLM-002 M1 — submission-drafter executor unit tests (gx10 mocked).
// REQ-WFLLM-001/002/009/011 / AC-01/04/05/11: gx10-backed step execution + citation markers.
//
// The executor's contract is with `_shared/streaming-chain` (streamSection +
// judgeStructured), NOT with the raw `ai` SDK. The streaming-chain test suite
// covers the ai SDK + gx10 integration. Here we mock streaming-chain so the
// executor's step logic, citation derivation, and chaining are tested in
// isolation without a real gx10 call or the 30s default timeout.
// Pattern: lib/workflows/_shared/__tests__/streaming-chain.test.ts (vi.mock + vi.mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock streaming-chain with vi.fn() inside the factory so the mocked functions
// are accessible via import + vi.mocked() after hoisting. The path resolves to
// lib/workflows/_shared/streaming-chain — the same module the executor imports.
vi.mock('../../_shared/streaming-chain', () => ({
  streamSection: vi.fn(),
  judgeStructured: vi.fn(),
  DEFAULT_STREAM_TIMEOUT_MS: 30_000,
  WorkflowLlmError: class WorkflowLlmError extends Error {
    readonly kind: 'timeout' | 'runtime' | 'schema';
    readonly stepName: string;
    constructor(kind: 'timeout' | 'runtime' | 'schema', stepName: string, message: string) {
      super(message);
      this.name = 'WorkflowLlmError';
      this.kind = kind;
      this.stepName = stepName;
    }
  },
}));

import { WorkflowLlmError, judgeStructured, streamSection } from '../../_shared/streaming-chain';
import { UnknownStepError, buildWorkflowSummary, executeStep } from '../executor';
import type { StepExecutionContext } from '../executor';

/** Citation-rich prose fixture (every sentence cited → coverage 1.0). */
const CITED_PROSE =
  'The predicate device K123456 has the same intended use.<sup class="cite" data-source="1">1</sup> ' +
  'Technological characteristics are substantially equivalent.<sup class="cite" data-source="2">2</sup> ' +
  'Performance data confirms equivalence.<sup class="cite" data-source="3">3</sup>';

function makeCtx(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    workflowRunId: 'run-test-1',
    input: {
      product_name: 'Cardiac Monitor X100',
      device_class: 'II',
      indications_for_use:
        'For continuous monitoring of cardiac rhythm in adult patients in clinical settings.',
      target_jurisdiction: 'US_FDA',
      predicate_k_numbers: ['K123456'],
      predicateResults: {
        predicateDevices: [
          {
            kNumber: 'K123456',
            deviceName: 'Cardiac Monitor Pro',
            productCode: 'DQA',
            similarityScore: 0.92,
          },
        ],
        searchStrategy: 'semantic',
      },
    },
    previousResults: [],
    ...overrides,
  };
}

describe('submission-drafter executor: device_classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated classification via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      classification: 'II',
      regulatoryPath: '510(k)',
      rationale: 'The device is a non-invasive monitor classified under 21 CFR 870.2900.',
      confidence: 0.88,
    });

    const result = await executeStep('device_classification', makeCtx());

    expect(result.stepName).toBe('device_classification');
    expect(result.output).toEqual({
      classification: 'II',
      regulatoryPath: '510(k)',
      rationale: 'The device is a non-invasive monitor classified under 21 CFR 870.2900.',
    });
    expect(result.confidenceScores).toEqual([{ source: 'llm', score: 0.88, weight: 1 }]);
    expect(judgeStructured).toHaveBeenCalledTimes(1);
  });

  it('passes product name and indications to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      classification: 'II',
      regulatoryPath: '510(k)',
      rationale: 'ok',
      confidence: 0.9,
    });

    await executeStep('device_classification', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('Cardiac Monitor X100');
    expect(call?.prompt).toContain('cardiac rhythm');
  });
});

describe('submission-drafter executor: substantial_equivalence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated SE verdict via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      equivalent: true,
      rationale: 'Same intended use and technological characteristics.',
      predicateReferences: ['K123456'],
      confidence: 0.82,
    });

    const result = await executeStep('substantial_equivalence', makeCtx());

    expect(result.output).toEqual({
      equivalent: true,
      rationale: 'Same intended use and technological characteristics.',
      predicateReferences: ['K123456'],
    });
    expect(result.confidenceScores[0]?.score).toBe(0.82);
  });
});

describe('submission-drafter executor: labeling_review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated labeling compliance via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      compliant: false,
      issues: [
        { severity: 'major', description: 'Missing contraindications section.' },
        { severity: 'minor', description: 'Precautions need expansion.' },
      ],
      confidence: 0.75,
    });

    const result = await executeStep('labeling_review', makeCtx());

    expect(result.output).toEqual({
      compliant: false,
      issues: [
        { severity: 'major', description: 'Missing contraindications section.' },
        { severity: 'minor', description: 'Precautions need expansion.' },
      ],
    });
    expect(result.confidenceScores[0]?.score).toBe(0.75);
  });
});

describe('submission-drafter executor: predicate_search (prose)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams prose with citation markers and derives confidence from coverage', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const result = await executeStep('predicate_search', makeCtx());

    expect(result.output.text).toContain('<sup class="cite"');
    expect(result.output.status).toBe('ok');
    // Coverage 1.0 (3 cited / 3 sentences) → citation score 1.0
    const citationScore = result.confidenceScores.find((s) => s.source === 'citation');
    expect(citationScore?.score).toBe(1);
    const llmScore = result.confidenceScores.find((s) => s.source === 'llm');
    expect(llmScore?.score).toBe(0.8);
  });

  it('handles stub predicate input (dependency #22 not integrated)', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const ctx = makeCtx({
      input: {
        ...makeCtx().input,
        predicateResults: { isStub: true },
      },
    });

    const result = await executeStep('predicate_search', ctx);

    expect(result.output.status).toBe('ok');
    // The K-numbers are passed via the `context` param, which streamSection
    // prepends to the `system` field. Assert the context contains the K-number.
    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('K123456');
  });

  it('records failed status and low confidence when streamSection fails', async () => {
    vi.mocked(streamSection).mockResolvedValue({
      text: 'Partial text.',
      status: 'failed',
      error: new WorkflowLlmError(
        'timeout',
        'predicate_search',
        'streamSection timed out after 30000ms',
      ),
    });

    const result = await executeStep('predicate_search', makeCtx());

    expect(result.output.status).toBe('failed');
    const llmScore = result.confidenceScores.find((s) => s.source === 'llm');
    expect(llmScore?.score).toBe(0.3);
  });

  it('passes real predicate device data as context when available', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    await executeStep('predicate_search', makeCtx());

    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('K123456');
    expect(call?.context).toContain('Cardiac Monitor Pro');
    expect(call?.context).toContain('DQA');
  });
});

describe('submission-drafter executor: performance_summary (prose)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams performance data prose with citation markers', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const result = await executeStep('performance_summary', makeCtx());

    expect(result.output.text).toContain('<sup class="cite"');
    expect(result.output.testingRequired).toEqual(
      expect.arrayContaining(['biocompatibility', 'electrical_safety', 'emc']),
    );
    const citationScore = result.confidenceScores.find((s) => s.source === 'citation');
    expect(citationScore?.score).toBe(1);
  });
});

describe('submission-drafter executor: submission_assembly (prose, chained)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes prior step results as context', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const priorResults = [
      {
        stepName: 'device_classification',
        output: { classification: 'II', regulatoryPath: '510(k)' },
        confidenceScores: [{ source: 'llm', score: 0.9, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 'substantial_equivalence',
        output: { equivalent: true, rationale: 'Same intended use.' },
        confidenceScores: [{ source: 'llm', score: 0.85, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    const ctx = makeCtx({ previousResults: priorResults });
    const result = await executeStep('submission_assembly', ctx);

    expect(result.output.text).toContain('<sup class="cite"');
    expect(result.output.sectionsGenerated).toBe(3);

    // The context passed to streamSection should contain prior step summaries.
    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('device_classification');
    expect(call?.context).toContain('substantial_equivalence');
  });
});

describe('submission-drafter executor: unknown step', () => {
  it('throws UnknownStepError for unrecognized step names', async () => {
    await expect(executeStep('unknown_step', makeCtx())).rejects.toBeInstanceOf(UnknownStepError);
  });
});

describe('submission-drafter executor: buildWorkflowSummary', () => {
  it('removes _mock flag (AC-01 D4) and keeps requiresReview true (Expert Review Gate)', () => {
    const results = [
      {
        stepName: 'device_classification',
        output: {},
        confidenceScores: [{ source: 'llm', score: 0.9, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    const summary = buildWorkflowSummary(results);

    expect(summary).not.toHaveProperty('_mock');
    expect(summary.requiresReview).toBe(true);
    expect(summary.totalSteps).toBe(1);
    expect(summary.completedSteps).toBe(1);
    expect(summary.overallConfidence).toBe(0.9);
  });

  it('returns empty summary with requiresReview false for zero results', () => {
    const summary = buildWorkflowSummary([]);

    expect(summary.totalSteps).toBe(0);
    expect(summary.requiresReview).toBe(false);
    expect(summary.overallConfidence).toBe(0);
    expect(summary).not.toHaveProperty('_mock');
  });

  it('aggregates confidence across multiple steps', () => {
    const results = [
      {
        stepName: 's1',
        output: {},
        confidenceScores: [{ source: 'llm', score: 0.8, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 's2',
        output: {},
        confidenceScores: [{ source: 'citation', score: 1, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    const summary = buildWorkflowSummary(results);

    // (0.8*1 + 1.0*1) / (1+1) = 0.9
    expect(summary.overallConfidence).toBe(0.9);
    expect(summary.requiresReview).toBe(true);
  });
});
