// SPEC-REGULA-WORKFLOWS-LLM-002 — audit-response pipeline integration tests.
// M1-M3 rewrote executors from synthetic mock → real gx10 via _shared/streaming-chain
// (judgeStructured/streamSection). This test mocks streaming-chain at the executor
// boundary so the full pipeline (executeStep × 6 steps + buildWorkflowSummary) runs
// with controlled LLM output, asserting the NEW behavior: 6 steps run in sequence,
// legal_review_gate returns the new Zod-validated shape (no handoffId), summary has
// overallConfidence 0-1, _mock absent.
//
// Pattern: lib/workflows/audit-response/__tests__/executor.test.ts (vi.mock + vi.mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/workflows/_shared/streaming-chain', () => ({
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

import { judgeStructured, streamSection } from '../../../lib/workflows/_shared/streaming-chain';
import {
  type StepResult,
  buildWorkflowSummary,
  executeStep,
} from '../../../lib/workflows/audit-response/executor';
import { AUDIT_RESPONSE_STEPS } from '../../../lib/workflows/audit-response/steps';
import { AuditResponseInputSchema } from '../../../lib/workflows/types';

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

/**
 * Dispatch mock responses by stepName. Structured-judgment steps (4) return
 * Zod-schema-shaped objects with `confidence`; prose-draft steps (2) return
 * `{ text, status }`. This lets the full 6-step pipeline run with controlled
 * output without a real gx10 call.
 */
function mockStreamingChain(): void {
  vi.mocked(judgeStructured).mockImplementation(async (params) => {
    switch (params.stepName) {
      case 'deficiency_analysis':
        return {
          deficiencyType: 'CAPA',
          severity: 'major',
          regulatoryBasis: '21 CFR 820.100',
          confidence: 0.85,
        } as never;
      case 'root_cause_identification':
        return {
          rootCauses: ['inadequate_training', 'process_gap'],
          methodology: 'fishbone',
          confidence: 0.78,
        } as never;
      case 'regulatory_reference_mapping':
        return {
          citations: ['21 CFR 820.100', '21 CFR 820.20'],
          matches: 2,
          confidence: 0.92,
        } as never;
      case 'legal_review_gate':
        return {
          proceedToResponse: true,
          legalRisks: [],
          conditions: [],
          confidence: 0.88,
        } as never;
      default:
        throw new Error(`unexpected judgeStructured step: ${params.stepName}`);
    }
  });

  vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });
}

const BASE_CTX = {
  workflowRunId: 'run-audit-001',
  input: {
    input_type: 'fda_483' as const,
    input_format: 'text' as const,
    input_content: SAMPLE_OBSERVATION,
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    establishment_fei: '3001234567',
  },
  previousResults: [] as StepResult[],
};

describe('Audit Response — full pipeline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamingChain();
  });

  it('executes all 6 steps in sequence', async () => {
    const results: StepResult[] = [];

    for (const step of AUDIT_RESPONSE_STEPS) {
      const result = await executeStep(step, {
        ...BASE_CTX,
        previousResults: results,
      });
      results.push(result);
    }

    expect(results).toHaveLength(6);
    expect(results.map((r) => r.stepName)).toEqual([...AUDIT_RESPONSE_STEPS]);
  });

  it('legal_review_gate step returns Zod-validated verdict (no handoffId)', async () => {
    // M2: legal_review_gate now returns {proceedToResponse, legalRisks, conditions}
    // via judgeStructured — the old synthetic handoffId is gone (Expert Review Gate
    // is handled by the runner, not the executor output).
    const result = await executeStep('legal_review_gate', BASE_CTX);

    expect(result.stepName).toBe('legal_review_gate');
    expect(result.output).not.toHaveProperty('handoffId');
    expect(result.output).toHaveProperty('proceedToResponse');
    expect(result.output).toHaveProperty('legalRisks');
    expect(result.output).toHaveProperty('conditions');
    expect(typeof result.output.proceedToResponse).toBe('boolean');
  });

  it('workflow summary has overallConfidence between 0 and 1', async () => {
    const results: StepResult[] = [];
    for (const step of AUDIT_RESPONSE_STEPS) {
      results.push(await executeStep(step, { ...BASE_CTX, previousResults: results }));
    }

    const summary = buildWorkflowSummary(results);
    expect(summary.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(summary.overallConfidence).toBeLessThanOrEqual(1);
    // AC-02: _mock flag must be absent from the new summary.
    expect(summary).not.toHaveProperty('_mock');
  });

  it('AuditResponseInputSchema rejects input_content shorter than 100 chars', () => {
    const result = AuditResponseInputSchema.safeParse({
      input_type: 'fda_483',
      input_format: 'text',
      input_content: 'Too short.',
      project_id: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(false);
  });

  it('AuditResponseInputSchema accepts valid input with all fields', () => {
    const result = AuditResponseInputSchema.safeParse({
      input_type: 'fda_483',
      input_format: 'text',
      input_content:
        'During the inspection conducted on 2026-01-15, the following observations were noted: ' +
        'The CAPA system failed to identify root causes for recurring non-conformances. ' +
        'Training records for personnel involved in critical manufacturing operations were incomplete.',
      project_id: '00000000-0000-0000-0000-000000000002',
      establishment_fei: '1234567',
    });
    expect(result.success).toBe(true);
  });
});
