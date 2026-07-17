// SPEC-REGULA-WORKFLOWS-LLM-002 M2 — audit-response executor unit tests (gx10 mocked).
// REQ-WFLLM-003/004/009/011 / AC-02/04/05/11: gx10-backed step execution + citation markers.
//
// The executor's contract is with `_shared/streaming-chain` (streamSection +
// judgeStructured), NOT with the raw `ai` SDK. The streaming-chain test suite
// covers the ai SDK + gx10 integration. Here we mock streaming-chain so the
// executor's step logic, citation derivation, and chaining are tested in
// isolation without a real gx10 call or the 30s default timeout.
// Pattern: lib/workflows/submission-drafter/__tests__/executor.test.ts (vi.mock + vi.mocked).

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
  'The deficiency relates to inadequate CAPA procedures under 21 CFR 820 section 100.<sup class="cite" data-source="1">1</sup> ' +
  'Root cause analysis identified a training gap in the quality department.<sup class="cite" data-source="2">2</sup> ' +
  'Corrective actions include revised SOPs and personnel retraining.<sup class="cite" data-source="3">3</sup>';

const SAMPLE_OBSERVATION =
  'FDA Form 483 Observation: During the inspection of the manufacturing facility, ' +
  'it was observed that the Corrective and Preventive Action (CAPA) procedure ' +
  'does not adequately address the requirements of 21 CFR 820.100. Specifically, ' +
  'there is no documented evidence of investigation into nonconformance reports ' +
  'for the months of January through March 2026.';

function makeCtx(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    workflowRunId: 'run-test-2',
    input: {
      input_type: 'fda_483',
      input_format: 'text',
      input_content: SAMPLE_OBSERVATION,
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      establishment_fei: '3001234567',
    },
    previousResults: [],
    ...overrides,
  };
}

describe('audit-response executor: deficiency_analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated deficiency analysis via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      deficiencyType: 'CAPA',
      severity: 'major',
      regulatoryBasis: '21 CFR 820.100',
      confidence: 0.85,
    });

    const result = await executeStep('deficiency_analysis', makeCtx());

    expect(result.stepName).toBe('deficiency_analysis');
    expect(result.output).toEqual({
      deficiencyType: 'CAPA',
      severity: 'major',
      regulatoryBasis: '21 CFR 820.100',
    });
    expect(result.confidenceScores).toEqual([{ source: 'llm', score: 0.85, weight: 1 }]);
    expect(judgeStructured).toHaveBeenCalledTimes(1);
  });

  it('passes observation text to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      deficiencyType: 'CAPA',
      severity: 'major',
      regulatoryBasis: '21 CFR 820.100',
      confidence: 0.9,
    });

    await executeStep('deficiency_analysis', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('fda_483');
    expect(call?.prompt).toContain('CAPA');
    expect(call?.prompt).toContain('3001234567');
  });
});

describe('audit-response executor: root_cause_identification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated root causes via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      rootCauses: ['inadequate_training', 'process_gap'],
      methodology: 'fishbone',
      confidence: 0.78,
    });

    const result = await executeStep('root_cause_identification', makeCtx());

    expect(result.output).toEqual({
      rootCauses: ['inadequate_training', 'process_gap'],
      methodology: 'fishbone',
    });
    expect(result.confidenceScores[0]?.score).toBe(0.78);
  });

  it('consumes prior step results as context', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      rootCauses: ['training_gap'],
      methodology: '5-Whys',
      confidence: 0.8,
    });

    const priorResults = [
      {
        stepName: 'deficiency_analysis',
        output: { deficiencyType: 'CAPA', severity: 'major', regulatoryBasis: '21 CFR 820.100' },
        confidenceScores: [{ source: 'llm', score: 0.85, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    await executeStep('root_cause_identification', makeCtx({ previousResults: priorResults }));

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('deficiency_analysis');
    expect(call?.prompt).toContain('CAPA');
  });
});

describe('audit-response executor: corrective_action_plan (prose)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams prose with citation markers and derives confidence from coverage', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const result = await executeStep('corrective_action_plan', makeCtx());

    expect(result.output.text).toContain('<sup class="cite"');
    expect(result.output.status).toBe('ok');
    // Coverage 1.0 (3 cited / 3 sentences) → citation score 1.0
    const citationScore = result.confidenceScores.find((s) => s.source === 'citation');
    expect(citationScore?.score).toBe(1);
    const llmScore = result.confidenceScores.find((s) => s.source === 'llm');
    expect(llmScore?.score).toBe(0.8);
  });

  it('records failed status and low confidence when streamSection fails', async () => {
    vi.mocked(streamSection).mockResolvedValue({
      text: 'Partial text.',
      status: 'failed',
      error: new WorkflowLlmError(
        'timeout',
        'corrective_action_plan',
        'streamSection timed out after 30000ms',
      ),
    });

    const result = await executeStep('corrective_action_plan', makeCtx());

    expect(result.output.status).toBe('failed');
    const llmScore = result.confidenceScores.find((s) => s.source === 'llm');
    expect(llmScore?.score).toBe(0.3);
  });

  it('passes observation text and prior results as context', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const priorResults = [
      {
        stepName: 'root_cause_identification',
        output: { rootCauses: ['training_gap'], methodology: 'fishbone' },
        confidenceScores: [{ source: 'llm', score: 0.78, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    await executeStep('corrective_action_plan', makeCtx({ previousResults: priorResults }));

    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('fda_483');
    expect(call?.context).toContain('root_cause_identification');
  });
});

describe('audit-response executor: regulatory_reference_mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated citations via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      citations: ['21 CFR 820.100', '21 CFR 820.20', 'ISO 13485:2016 §8.5.2'],
      matches: 3,
      confidence: 0.92,
    });

    const result = await executeStep('regulatory_reference_mapping', makeCtx());

    expect(result.output).toEqual({
      citations: ['21 CFR 820.100', '21 CFR 820.20', 'ISO 13485:2016 §8.5.2'],
      matches: 3,
    });
    expect(result.confidenceScores[0]?.score).toBe(0.92);
  });

  it('passes input_type to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      citations: ['21 CFR 820.100'],
      matches: 1,
      confidence: 0.9,
    });

    await executeStep('regulatory_reference_mapping', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('fda_483');
  });
});

describe('audit-response executor: response_drafting (prose, chained)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams formal response prose with citation markers', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const result = await executeStep('response_drafting', makeCtx());

    expect(result.output.text).toContain('<sup class="cite"');
    expect(result.output.sectionsGenerated).toBe(3);
    const citationScore = result.confidenceScores.find((s) => s.source === 'citation');
    expect(citationScore?.score).toBe(1);
  });

  it('consumes prior step results as context', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const priorResults = [
      {
        stepName: 'deficiency_analysis',
        output: { deficiencyType: 'CAPA', severity: 'major' },
        confidenceScores: [{ source: 'llm', score: 0.85, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 'corrective_action_plan',
        output: { status: 'ok' },
        confidenceScores: [{ source: 'citation', score: 1, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    const ctx = makeCtx({ previousResults: priorResults });
    const result = await executeStep('response_drafting', ctx);

    expect(result.output.text).toContain('<sup class="cite"');
    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('deficiency_analysis');
    expect(call?.context).toContain('corrective_action_plan');
  });

  it('includes establishment FEI in context when provided', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    await executeStep('response_drafting', makeCtx());

    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('3001234567');
  });
});

describe('audit-response executor: legal_review_gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated legal review verdict via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      proceedToResponse: false,
      legalRisks: [
        { severity: 'critical', description: 'Response admits liability without qualification.' },
        { severity: 'major', description: 'Corrective action timeline is insufficient.' },
      ],
      conditions: ['Revise liability language', 'Extend CAPA timeline to 90 days'],
      confidence: 0.82,
    });

    const result = await executeStep('legal_review_gate', makeCtx());

    expect(result.output).toEqual({
      proceedToResponse: false,
      legalRisks: [
        { severity: 'critical', description: 'Response admits liability without qualification.' },
        { severity: 'major', description: 'Corrective action timeline is insufficient.' },
      ],
      conditions: ['Revise liability language', 'Extend CAPA timeline to 90 days'],
    });
    expect(result.confidenceScores[0]?.score).toBe(0.82);
  });

  it('passes prior step results to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      proceedToResponse: true,
      legalRisks: [],
      conditions: [],
      confidence: 0.9,
    });

    const priorResults = [
      {
        stepName: 'response_drafting',
        output: { sectionsGenerated: 3, status: 'ok' },
        confidenceScores: [{ source: 'citation', score: 1, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    await executeStep('legal_review_gate', makeCtx({ previousResults: priorResults }));

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('response_drafting');
  });
});

describe('audit-response executor: unknown step', () => {
  it('throws UnknownStepError for unrecognized step names', async () => {
    await expect(executeStep('unknown_step', makeCtx())).rejects.toBeInstanceOf(UnknownStepError);
  });
});

describe('audit-response executor: buildWorkflowSummary', () => {
  it('removes _mock flag (AC-02) and keeps requiresReview true (Expert Review Gate)', () => {
    const results = [
      {
        stepName: 'deficiency_analysis',
        output: {},
        confidenceScores: [{ source: 'llm', score: 0.85, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    const summary = buildWorkflowSummary(results);

    expect(summary).not.toHaveProperty('_mock');
    expect(summary.requiresReview).toBe(true);
    expect(summary.totalSteps).toBe(1);
    expect(summary.completedSteps).toBe(1);
    expect(summary.overallConfidence).toBe(0.85);
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
        stepName: 'deficiency_analysis',
        output: {},
        confidenceScores: [{ source: 'llm', score: 0.8, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 'corrective_action_plan',
        output: {},
        confidenceScores: [
          { source: 'citation', score: 1, weight: 1 },
          { source: 'llm', score: 0.8, weight: 0.5 },
        ],
        completedAt: new Date().toISOString(),
      },
    ];

    const summary = buildWorkflowSummary(results);

    // (0.8*1 + 1.0*1 + 0.8*0.5) / (1+1+0.5) = (0.8 + 1.0 + 0.4) / 2.5 = 2.2 / 2.5 = 0.88
    expect(summary.overallConfidence).toBeCloseTo(0.88, 5);
    expect(summary.requiresReview).toBe(true);
  });
});
