// SPEC-REGULA-WORKFLOWS-LLM-002 M3 — indication-impact executor unit tests (gx10 mocked).
// REQ-WFLLM-005/009/011 / AC-03/04/05: gx10-backed step execution + 3-axis impact + citation markers.
//
// The executor's contract is with `_shared/streaming-chain` (streamSection +
// judgeStructured), NOT with the raw `ai` SDK. The streaming-chain test suite
// covers the ai SDK + gx10 integration. Here we mock streaming-chain so the
// executor's step logic, 3-axis judgment, citation derivation, and chaining
// are tested in isolation without a real gx10 call or the 30s default timeout.
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
  'The proposed indication expands the patient population.<sup class="cite" data-source="1">1</sup> ' +
  'The 510(k) predicate remains valid under 21 CFR 807.<sup class="cite" data-source="2">2</sup> ' +
  'EU MDR classification is unchanged at Class IIa.<sup class="cite" data-source="3">3</sup>';

function makeCtx(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    workflowRunId: 'run-test-1',
    input: {
      current_indication:
        'For continuous monitoring of cardiac rhythm in adult patients in clinical settings.',
      proposed_indication:
        'For continuous monitoring of cardiac rhythm in adult and pediatric patients in clinical settings.',
      target_markets: ['US', 'EU', 'KR'],
    },
    previousResults: [],
    ...overrides,
  };
}

// ── 3-axis (1): predicate_impact_analysis — 510(k) SE re-assessment ──────

describe('indication-impact executor: predicate_impact_analysis (3-axis: 510(k) SE)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated SE re-assessment via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      reAssessmentRequired: true,
      rationale:
        'The expanded patient population invalidates the predicate SE per 21 CFR 807.92(a)(3).',
      predicateImpact: 'new_predicate_needed',
      confidence: 0.85,
    });

    const result = await executeStep('predicate_impact_analysis', makeCtx());

    expect(result.stepName).toBe('predicate_impact_analysis');
    expect(result.output).toEqual({
      reAssessmentRequired: true,
      rationale:
        'The expanded patient population invalidates the predicate SE per 21 CFR 807.92(a)(3).',
      predicateImpact: 'new_predicate_needed',
    });
    expect(result.confidenceScores).toEqual([{ source: 'llm', score: 0.85, weight: 1 }]);
    expect(judgeStructured).toHaveBeenCalledTimes(1);
  });

  it('passes current and proposed indications to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      reAssessmentRequired: false,
      rationale: 'ok',
      predicateImpact: 'still_valid',
      confidence: 0.9,
    });

    await executeStep('predicate_impact_analysis', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('cardiac rhythm');
    expect(call?.prompt).toContain('pediatric');
    expect(call?.prompt).toContain('21 CFR 807.92');
  });
});

// ── 3-axis (2): regulatory_pathway_assessment — EU MDR classification ────

describe('indication-impact executor: regulatory_pathway_assessment (3-axis: EU MDR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated classification change via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      classificationChangeRequired: true,
      newClass: 'IIb',
      rationale: 'The pediatric indication triggers Rule 11 under EU MDR Annex VIII.',
      confidence: 0.82,
    });

    const result = await executeStep('regulatory_pathway_assessment', makeCtx());

    expect(result.stepName).toBe('regulatory_pathway_assessment');
    expect(result.output).toEqual({
      classificationChangeRequired: true,
      newClass: 'IIb',
      rationale: 'The pediatric indication triggers Rule 11 under EU MDR Annex VIII.',
    });
    expect(result.confidenceScores[0]?.score).toBe(0.82);
  });

  it('includes target markets in the prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      classificationChangeRequired: false,
      newClass: 'IIa',
      rationale: 'ok',
      confidence: 0.88,
    });

    await executeStep('regulatory_pathway_assessment', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('US');
    expect(call?.prompt).toContain('EU');
    expect(call?.prompt).toContain('Annex VIII');
  });
});

// ── 3-axis (3): clinical_data_gap_analysis ───────────────────────────────

describe('indication-impact executor: clinical_data_gap_analysis (3-axis: clinical gap)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated clinical data gap via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      additionalClinicalDataRequired: true,
      gapDescription: 'Pediatric clinical data is required under EU MDR Annex XIV.',
      confidence: 0.78,
    });

    const result = await executeStep('clinical_data_gap_analysis', makeCtx());

    expect(result.stepName).toBe('clinical_data_gap_analysis');
    expect(result.output).toEqual({
      additionalClinicalDataRequired: true,
      gapDescription: 'Pediatric clinical data is required under EU MDR Annex XIV.',
    });
    expect(result.confidenceScores[0]?.score).toBe(0.78);
  });

  it('passes indication context to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      additionalClinicalDataRequired: false,
      gapDescription: 'Existing data suffices.',
      confidence: 0.9,
    });

    await executeStep('clinical_data_gap_analysis', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('Annex XIV');
    expect(call?.prompt).toContain('pediatric');
  });
});

// ── Other judgment steps ──────────────────────────────────────────────────

describe('indication-impact executor: indication_comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated comparison via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      changeType: 'expansion',
      riskLevel: 'moderate',
      summary: 'The proposed indication expands the patient population to include pediatrics.',
      confidence: 0.88,
    });

    const result = await executeStep('indication_comparison', makeCtx());

    expect(result.stepName).toBe('indication_comparison');
    expect(result.output).toEqual({
      changeType: 'expansion',
      riskLevel: 'moderate',
      summary: 'The proposed indication expands the patient population to include pediatrics.',
    });
    expect(result.confidenceScores[0]?.score).toBe(0.88);
  });
});

describe('indication-impact executor: market_specific_requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Zod-validated market requirements via judgeStructured', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      marketsAnalyzed: ['US', 'EU', 'KR'],
      additionalRequirements: ['CE mark update', 'PMDA notification', 'NMPA re-registration'],
      confidence: 0.83,
    });

    const result = await executeStep('market_specific_requirements', makeCtx());

    expect(result.stepName).toBe('market_specific_requirements');
    expect(result.output).toEqual({
      marketsAnalyzed: ['US', 'EU', 'KR'],
      additionalRequirements: ['CE mark update', 'PMDA notification', 'NMPA re-registration'],
    });
    expect(result.confidenceScores[0]?.score).toBe(0.83);
  });

  it('passes target markets to the LLM prompt', async () => {
    vi.mocked(judgeStructured).mockResolvedValue({
      marketsAnalyzed: [],
      additionalRequirements: [],
      confidence: 0.9,
    });

    await executeStep('market_specific_requirements', makeCtx());

    const call = vi.mocked(judgeStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('US');
    expect(call?.prompt).toContain('EU');
    expect(call?.prompt).toContain('KR');
  });
});

// ── Prose-draft step: impact_report_generation ───────────────────────────

describe('indication-impact executor: impact_report_generation (prose, chained)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams impact report prose with citation markers', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const result = await executeStep('impact_report_generation', makeCtx());

    expect(result.output.text).toContain('<sup class="cite"');
    expect(result.output.status).toBe('ok');
    // Coverage 1.0 (3 cited / 3 sentences) → citation score 1.0
    const citationScore = result.confidenceScores.find((s) => s.source === 'citation');
    expect(citationScore?.score).toBe(1);
    const llmScore = result.confidenceScores.find((s) => s.source === 'llm');
    expect(llmScore?.score).toBe(0.8);
  });

  it('consumes prior step results as context', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const priorResults = [
      {
        stepName: 'indication_comparison',
        output: { changeType: 'expansion', riskLevel: 'moderate' },
        confidenceScores: [{ source: 'llm', score: 0.9, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 'predicate_impact_analysis',
        output: {
          reAssessmentRequired: true,
          predicateImpact: 'new_predicate_needed',
        },
        confidenceScores: [{ source: 'llm', score: 0.85, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 'regulatory_pathway_assessment',
        output: {
          classificationChangeRequired: true,
          newClass: 'IIb',
        },
        confidenceScores: [{ source: 'llm', score: 0.82, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
      {
        stepName: 'clinical_data_gap_analysis',
        output: {
          additionalClinicalDataRequired: true,
          gapDescription: 'Pediatric clinical data required.',
        },
        confidenceScores: [{ source: 'llm', score: 0.78, weight: 1 }],
        completedAt: new Date().toISOString(),
      },
    ];

    const ctx = makeCtx({ previousResults: priorResults });
    const result = await executeStep('impact_report_generation', ctx);

    expect(result.output.text).toContain('<sup class="cite"');

    // The context passed to streamSection should contain prior step summaries.
    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('indication_comparison');
    expect(call?.context).toContain('predicate_impact_analysis');
    expect(call?.context).toContain('regulatory_pathway_assessment');
    expect(call?.context).toContain('clinical_data_gap_analysis');
  });

  it('records failed status and low confidence when streamSection fails', async () => {
    vi.mocked(streamSection).mockResolvedValue({
      text: 'Partial text.',
      status: 'failed',
      error: new WorkflowLlmError(
        'timeout',
        'impact_report_generation',
        'streamSection timed out after 30000ms',
      ),
    });

    const result = await executeStep('impact_report_generation', makeCtx());

    expect(result.output.status).toBe('failed');
    const llmScore = result.confidenceScores.find((s) => s.source === 'llm');
    expect(llmScore?.score).toBe(0.3);
  });

  it('handles PCCP stub context (dependency #24 not integrated)', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const ctx = makeCtx({
      input: {
        ...makeCtx().input,
        pccpContext: { isStub: true },
      },
    });

    const result = await executeStep('impact_report_generation', ctx);

    expect(result.output.status).toBe('ok');
    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('PCCP context unavailable');
  });

  it('passes real PCCP context when available', async () => {
    vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });

    const ctx = makeCtx({
      input: {
        ...makeCtx().input,
        pccpContext: {
          pccpVersionId: 'pccp-uuid-123',
          algorithmDescription: 'ML-based arrhythmia detection v2',
          modificationProtocol: 'Retraining with pediatric data',
        },
      },
    });

    const result = await executeStep('impact_report_generation', ctx);

    expect(result.output.status).toBe('ok');
    const call = vi.mocked(streamSection).mock.calls[0]?.[0];
    expect(call?.context).toContain('pccp-uuid-123');
    expect(call?.context).toContain('ML-based arrhythmia detection');
    expect(call?.context).toContain('Retraining with pediatric data');
  });
});

// ── Unknown step ──────────────────────────────────────────────────────────

describe('indication-impact executor: unknown step', () => {
  it('throws UnknownStepError for unrecognized step names', async () => {
    await expect(executeStep('unknown_step', makeCtx())).rejects.toBeInstanceOf(UnknownStepError);
  });
});

// ── buildWorkflowSummary ─────────────────────────────────────────────────

describe('indication-impact executor: buildWorkflowSummary', () => {
  it('removes _mock flag (AC-03) and keeps requiresReview true (Expert Review Gate)', () => {
    const results = [
      {
        stepName: 'indication_comparison',
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
        confidenceScores: [
          { source: 'citation', score: 1, weight: 1 },
          { source: 'llm', score: 0.8, weight: 0.5 },
        ],
        completedAt: new Date().toISOString(),
      },
    ];

    const summary = buildWorkflowSummary(results);

    // (0.8*1 + 1.0*1 + 0.8*0.5) / (1 + 1 + 0.5) = (0.8 + 1.0 + 0.4) / 2.5 = 2.2 / 2.5 = 0.88
    expect(summary.overallConfidence).toBeCloseTo(0.88, 5);
    expect(summary.requiresReview).toBe(true);
  });
});
