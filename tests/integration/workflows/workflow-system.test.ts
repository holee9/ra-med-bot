import { describe, expect, it } from 'vitest';
import { AUDIT_RESPONSE_STEPS } from '../../../lib/workflows/audit-response/steps';
import { CER_STEPS } from '../../../lib/workflows/cer/steps';
import { defaultReviewQueue } from '../../../lib/workflows/common/review-queue';
import { INDICATION_IMPACT_STEPS } from '../../../lib/workflows/indication-impact/steps';
import { PCCP_STEPS } from '../../../lib/workflows/pccp/steps';
import { WORKFLOW_REGISTRY } from '../../../lib/workflows/registry';
import { SUBMISSION_DRAFTER_STEPS } from '../../../lib/workflows/submission-drafter/steps';

describe('Workflow System — cross-workflow validation', () => {
  it('WORKFLOW_REGISTRY entries match step counts from steps modules', () => {
    const stepCountMap: Record<string, number> = {
      'submission-drafter': SUBMISSION_DRAFTER_STEPS.length,
      'audit-response': AUDIT_RESPONSE_STEPS.length,
      'indication-impact': INDICATION_IMPACT_STEPS.length,
      cer: CER_STEPS.length,
      pccp: PCCP_STEPS.length,
      samd: 5,
      dhf: 4,
      esubmit: 4,
      // SPEC-REGULA-PMS-001: 3 PMS workflows (no steps module — section-based).
      'pms-report': 4,
      'pmcf-plan': 4,
      'pmcf-evaluation': 3,
    };

    for (const entry of WORKFLOW_REGISTRY) {
      const expected = stepCountMap[entry.id];
      expect(expected, `No step count mapping found for registry id: ${entry.id}`).toBeDefined();
      expect(entry.stepCount).toBe(expected);
    }
  });

  it('SUBMISSION_DRAFTER, AUDIT_RESPONSE, INDICATION_IMPACT have exactly 6 steps', () => {
    expect(SUBMISSION_DRAFTER_STEPS).toHaveLength(6);
    expect(AUDIT_RESPONSE_STEPS).toHaveLength(6);
    expect(INDICATION_IMPACT_STEPS).toHaveLength(6);
  });

  it('PCCP_STEPS has exactly 4 steps', () => {
    expect(PCCP_STEPS).toHaveLength(4);
  });

  it('workflow type strings match registry ids', () => {
    const registryIds = WORKFLOW_REGISTRY.map((e) => e.id);
    expect(registryIds).toContain('submission-drafter');
    expect(registryIds).toContain('audit-response');
    expect(registryIds).toContain('indication-impact');
    expect(registryIds).toContain('cer');
    expect(registryIds).toContain('pccp');
    expect(registryIds).toContain('samd');
    expect(registryIds).toContain('dhf');
    expect(registryIds).toContain('esubmit');
  });

  it('review-queue singleton is consistent', () => {
    // Verify singleton behaviour: mutations on the imported reference persist
    // across calls (same in-memory Map underneath).
    const sizeBefore = defaultReviewQueue.size();

    const added = defaultReviewQueue.enqueue({
      workflowRunId: 'singleton-test-run',
      workflowType: 'submission_drafter',
      priority: 'normal',
      requestedAt: new Date().toISOString(),
    });

    expect(defaultReviewQueue.size()).toBe(sizeBefore + 1);
    expect(defaultReviewQueue.peek(added.id)).toBeDefined();

    // Cleanup to avoid leaking state into other tests
    defaultReviewQueue.dequeue(added.id);
    expect(defaultReviewQueue.size()).toBe(sizeBefore);
  });
});
