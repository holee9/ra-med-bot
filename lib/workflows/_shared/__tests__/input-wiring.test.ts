// SPEC-REGULA-WORKFLOWS-LLM-002 M0-5 — input-wiring unit tests.
// REQ-WFLLM-001/003/005: map dependency outputs → StepExecutionContext.input.

import { describe, expect, it, vi } from 'vitest';
import {
  wireAuditResponseInput,
  wireIndicationImpactInput,
  wireSubmissionDrafterInput,
} from '../input-wiring';
import type { CerBuilderOutput, PccpBuilderOutput, PredicateSearchOutput } from '../input-wiring';

const baseWorkflowInput = {
  product_name: 'Cardiac Stent X',
  device_class: 'II' as const,
  indications_for_use: 'Treatment of coronary artery disease',
  target_jurisdiction: 'US_FDA' as const,
  predicate_k_numbers: ['K123456'],
  project_id: '00000000-0000-0000-0000-000000000000',
};

describe('input-wiring: wireSubmissionDrafterInput', () => {
  it('maps workflow input fields through to the step input', () => {
    const result = wireSubmissionDrafterInput({
      workflowInput: baseWorkflowInput,
    });
    expect(result.product_name).toBe('Cardiac Stent X');
    expect(result.device_class).toBe('II');
    expect(result.indications_for_use).toBe('Treatment of coronary artery disease');
    expect(result.target_jurisdiction).toBe('US_FDA');
    expect(result.predicate_k_numbers).toEqual(['K123456']);
  });

  it('passes real predicate results through when #22 output available', () => {
    const predicateResults: PredicateSearchOutput = {
      predicateDevices: [
        {
          kNumber: 'K123456',
          deviceName: 'Predicate Stent',
          productCode: 'QBB',
          similarityScore: 0.92,
        },
      ],
      searchStrategy: 'semantic',
    };
    const result = wireSubmissionDrafterInput({
      workflowInput: baseWorkflowInput,
      predicateResults,
    });
    expect(result.predicateResults).toEqual(predicateResults);
    expect((result.predicateResults as { isStub?: true }).isStub).toBeUndefined();
  });

  it('falls back to stub predicate input when #22 output absent (logged)', () => {
    const warnSpy = vi.fn();
    const result = wireSubmissionDrafterInput({
      workflowInput: baseWorkflowInput,
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
      },
    });
    expect(result.predicateResults).toEqual({ isStub: true });
    expect(warnSpy).toHaveBeenCalledOnce();
    // The warn call should carry workflowType + dependency metadata.
    const meta = warnSpy.mock.calls[0]?.[1];
    expect(meta).toMatchObject({
      workflowType: 'submission_drafter',
      dependency: 'predicate_search',
    });
  });
});

describe('input-wiring: wireAuditResponseInput', () => {
  it('maps audit-response input fields', () => {
    const result = wireAuditResponseInput({
      workflowInput: {
        input_type: 'fda_483',
        input_format: 'text',
        input_content: 'Observation 1: Procedure not followed.',
        project_id: '00000000-0000-0000-0000-000000000000',
        establishment_fei: 'FEI123',
      },
    });
    expect(result.input_type).toBe('fda_483');
    expect(result.input_content).toContain('Observation 1');
    expect(result.establishment_fei).toBe('FEI123');
  });

  it('passes CER context through when #23 output available', () => {
    const cerResults: CerBuilderOutput = {
      cerId: 'cer-1',
      clinicalEvidenceSummary: 'summary',
      literatureReferences: [],
    };
    const result = wireAuditResponseInput({
      workflowInput: {
        input_type: 'fda_483',
        input_format: 'text',
        input_content: 'x'.repeat(200),
        project_id: '00000000-0000-0000-0000-000000000000',
      },
      cerResults,
    });
    expect(result.cerContext).toEqual(cerResults);
  });
});

describe('input-wiring: wireIndicationImpactInput', () => {
  it('maps indication-impact input fields', () => {
    const result = wireIndicationImpactInput({
      workflowInput: {
        project_id: '00000000-0000-0000-0000-000000000000',
        current_indication: 'Treatment of CAD in adults',
        proposed_indication: 'Treatment of CAD in pediatric patients',
        target_markets: ['US', 'EU'],
      },
    });
    expect(result.current_indication).toContain('CAD in adults');
    expect(result.proposed_indication).toContain('pediatric');
    expect(result.target_markets).toEqual(['US', 'EU']);
  });

  it('passes PCCP context through when #24 output available', () => {
    const pccpResults: PccpBuilderOutput = {
      pccpVersionId: 'pccp-1',
      algorithmDescription: 'desc',
      modificationProtocol: 'protocol',
    };
    const result = wireIndicationImpactInput({
      workflowInput: {
        project_id: '00000000-0000-0000-0000-000000000000',
        current_indication: 'x'.repeat(30),
        proposed_indication: 'y'.repeat(30),
        target_markets: ['US'],
      },
      pccpResults,
    });
    expect(result.pccpContext).toEqual(pccpResults);
  });
});
