// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/model-governance/audit (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-001..014)

import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});

vi.mock('@/lib/audit', () => ({ writeAudit }));

const {
  auditApproved,
  auditChangeRequested,
  auditEvalResult,
  auditPromptRegistered,
  auditRejected,
  auditRolledBack,
  auditRuntimeBlocked,
} = await import('../audit');

function lastAudit(): AuditInput {
  const calls = writeAudit.mock.calls as unknown[][];
  return calls[calls.length - 1]?.[0] as AuditInput;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lib/model-governance/audit (REQ-MODELGOV)', () => {
  it('auditPromptRegistered writes modelgov.prompt_registered with hash', async () => {
    await auditPromptRegistered({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'p-1',
      promptId: 'p-1',
      kind: 'prompt',
      version: 1,
      contentHash: 'abc123',
    });
    expect(lastAudit()).toMatchObject({
      action: 'modelgov.prompt_registered',
      resource_type: 'prompt_registry',
    });
    expect(lastAudit().meta_json).toMatchObject({ content_hash: 'abc123', version: 1 });
  });

  it('auditChangeRequested writes modelgov.change_requested', async () => {
    await auditChangeRequested({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'cr-1',
      changeRequestId: 'cr-1',
      promptId: 'p-1',
      modelPinId: 'mp-1',
    });
    expect(lastAudit().action).toBe('modelgov.change_requested');
  });

  it('auditApproved writes modelgov.approved with approver + eval link', async () => {
    await auditApproved({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'combo-1',
      changeRequestId: 'cr-1',
      approverId: 'u-2',
      combinationId: 'combo-1',
      evalResultRef: 'eval-9',
    });
    expect(lastAudit().meta_json).toMatchObject({ approver_id: 'u-2', eval_result_ref: 'eval-9' });
  });

  it('auditRejected writes modelgov.rejected with reason', async () => {
    await auditRejected({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'cr-1',
      changeRequestId: 'cr-1',
      approverId: 'u-2',
      reason: 'eval_failed',
    });
    expect(lastAudit().meta_json).toMatchObject({ reason: 'eval_failed' });
  });

  it('auditRolledBack writes modelgov.rolled_back with from/to ids', async () => {
    await auditRolledBack({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'combo-1',
      fromCombinationId: 'combo-2',
      toCombinationId: 'combo-1',
    });
    expect(lastAudit().meta_json).toMatchObject({
      from_combination_id: 'combo-2',
      to_combination_id: 'combo-1',
    });
  });

  it('auditRuntimeBlocked writes modelgov.runtime_blocked', async () => {
    await auditRuntimeBlocked({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'combo-x',
      reason: 'not_approved',
    });
    expect(lastAudit().action).toBe('modelgov.runtime_blocked');
  });

  it('auditEvalResult writes eval_passed when passed=true', async () => {
    await auditEvalResult({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'cr-1',
      changeRequestId: 'cr-1',
      passed: true,
      score: 0.92,
      threshold: 0.85,
      evalRunId: 'run-1',
    });
    expect(lastAudit().action).toBe('modelgov.eval_passed');
    expect(lastAudit().meta_json).toMatchObject({ score: 0.92, threshold: 0.85 });
  });

  it('auditEvalResult writes eval_failed when passed=false', async () => {
    await auditEvalResult({
      actorId: 'u-1',
      orgId: 'org-1',
      resourceId: 'cr-1',
      changeRequestId: 'cr-1',
      passed: false,
      score: 0.3,
      threshold: 0.85,
      evalRunId: null,
    });
    expect(lastAudit().action).toBe('modelgov.eval_failed');
  });
});
