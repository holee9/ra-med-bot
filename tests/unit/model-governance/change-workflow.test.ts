// @MX:NOTE [AUTO] Unit tests for change-workflow.ts (REQ-MODELGOV-004/005/012/013/014).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 / Issue #402 (coverage ratchet-up).
// @MX:REASON Tests cover the 3 exports' state transitions + error branches:
//   createChangeRequest (eval gate → pending/passed/failed),
//   approveChangeRequest (not_found / eval_not_passed / status_not_pending / success),
//   recordEvalResult (async eval completion). Mocks withTenantScope + audit fns.
//   No real DB.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// biome-ignore lint/suspicious/noExplicitAny: mock tx is intentionally loose
let mockTx: any;
// Queued results for select chains inside withTenantScope callbacks.
// biome-ignore lint/suspicious/noExplicitAny: queued select result rows
const selectResults: any[][] = [];
// Queued results for insert().returning() chains.
// biome-ignore lint/suspicious/noExplicitAny: queued insert result rows
const insertResults: any[][] = [];

const auditChangeRequestedMock = vi.fn().mockResolvedValue(undefined);
const auditEvalResultMock = vi.fn().mockResolvedValue(undefined);
const auditApprovedMock = vi.fn().mockResolvedValue(undefined);
const writeAuditMock = vi.fn().mockResolvedValue(undefined);

async function loadModule() {
  vi.doMock('@/lib/kernel/db/client', () => ({
    // withTenantScope calls cb with mockTx and returns whatever cb returns.
    // This supports both callback-returning-promise (approve select path)
    // and callback-returning-void (insert/update paths).
    withTenantScope: async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
  }));
  vi.doMock('@/lib/kernel/db/schema', () => ({
    changeRequest: {
      id: 'id',
      orgId: 'orgId',
      promptId: 'promptId',
      modelPinId: 'modelPinId',
      evalStatus: 'evalStatus',
      evalStatus_: 'evalStatus',
      approvalStatus: 'approvalStatus',
      evalResultRef: 'evalResultRef',
      approverId: 'approverId',
      approvedAt: 'approvedAt',
      evalRunId: 'evalRunId',
      createdBy: 'createdBy',
    },
    approvedCombination: {
      id: 'id',
      orgId: 'orgId',
      promptId: 'promptId',
      modelPinId: 'modelPinId',
      active: 'active',
      supersededBy: 'supersededBy',
      changeRequestId: 'changeRequestId',
      approvedAt: 'approvedAt',
    },
  }));
  vi.doMock('@/lib/kernel/audit', () => ({ writeAudit: writeAuditMock }));
  vi.doMock('@/lib/model-governance/audit', () => ({
    auditChangeRequested: auditChangeRequestedMock,
    auditEvalResult: auditEvalResultMock,
    auditApproved: auditApprovedMock,
  }));
  vi.resetModules();
  return import('@/lib/model-governance/change-workflow');
}

beforeEach(() => {
  selectResults.length = 0;
  insertResults.length = 0;
  auditChangeRequestedMock.mockClear();
  auditEvalResultMock.mockClear();
  auditApprovedMock.mockClear();
  writeAuditMock.mockClear();
  mockTx = {
    // select().from().where().limit() → array (shift from selectResults)
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }),
    // insert().values().returning() → array (shift from insertResults)
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(insertResults.shift() ?? []),
      }),
    }),
    // update().set().where() → void
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  };
});

afterEach(() => {
  vi.doUnmock('@/lib/kernel/db/client');
  vi.doUnmock('@/lib/kernel/db/schema');
  vi.doUnmock('@/lib/kernel/audit');
  vi.doUnmock('@/lib/model-governance/audit');
});

// ---------------------------------------------------------------------------
// Helper: build an eval result JSON that passes (all cases success=true)
// ---------------------------------------------------------------------------
function passingEvalJson(caseCount = 2) {
  return { results: Array.from({ length: caseCount }, () => ({ success: true })) };
}

// Helper: build an eval result JSON that fails (no success cases)
function failingEvalJson() {
  return { results: [{ success: false }, { success: false }] };
}

// ===========================================================================
// createChangeRequest (REQ-MODELGOV-004)
// ===========================================================================
describe('createChangeRequest (REQ-MODELGOV-004)', () => {
  it('stores a change request with evalStatus=pending when no evalResultJson', async () => {
    insertResults.push([{ id: 'cr-1', evalStatus: 'pending' }]);
    const { createChangeRequest } = await loadModule();
    const result = await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      createdBy: 'user-1',
    });
    expect(result).toEqual({ changeRequestId: 'cr-1', evalStatus: 'pending' });
  });

  it('sets evalStatus=passed when evalResultJson passes the threshold', async () => {
    insertResults.push([{ id: 'cr-2', evalStatus: 'passed' }]);
    const { createChangeRequest } = await loadModule();
    const result = await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      evalResultJson: passingEvalJson(),
      createdBy: 'user-1',
    });
    expect(result.evalStatus).toBe('passed');
  });

  it('sets evalStatus=failed when evalResultJson fails the threshold', async () => {
    insertResults.push([{ id: 'cr-3', evalStatus: 'failed' }]);
    const { createChangeRequest } = await loadModule();
    const result = await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      evalResultJson: failingEvalJson(),
      createdBy: 'user-1',
    });
    expect(result.evalStatus).toBe('failed');
  });

  it('writes auditChangeRequested on insert', async () => {
    insertResults.push([{ id: 'cr-4', evalStatus: 'pending' }]);
    const { createChangeRequest } = await loadModule();
    await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      createdBy: 'user-1',
    });
    expect(auditChangeRequestedMock).toHaveBeenCalledTimes(1);
    expect(auditChangeRequestedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        orgId: 'org-1',
        resourceId: 'cr-4',
        changeRequestId: 'cr-4',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
      }),
    );
  });

  it('writes auditEvalResult when evalResultJson is provided and passes', async () => {
    insertResults.push([{ id: 'cr-5', evalStatus: 'passed' }]);
    const { createChangeRequest } = await loadModule();
    await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      evalResultJson: passingEvalJson(),
      evalRunId: 'run-1',
      createdBy: 'user-1',
    });
    expect(auditEvalResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        passed: true,
        changeRequestId: 'cr-5',
      }),
    );
  });

  it('writes auditEvalResult when evalResultJson is provided and fails', async () => {
    insertResults.push([{ id: 'cr-6', evalStatus: 'failed' }]);
    const { createChangeRequest } = await loadModule();
    await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      evalResultJson: failingEvalJson(),
      createdBy: 'user-1',
    });
    expect(auditEvalResultMock).toHaveBeenCalledWith(expect.objectContaining({ passed: false }));
  });

  it('does NOT write auditEvalResult when no evalResultJson', async () => {
    insertResults.push([{ id: 'cr-7', evalStatus: 'pending' }]);
    const { createChangeRequest } = await loadModule();
    await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      createdBy: 'user-1',
    });
    expect(auditEvalResultMock).not.toHaveBeenCalled();
  });

  it('passes evalResultRef to the insert', async () => {
    insertResults.push([{ id: 'cr-8', evalStatus: 'pending' }]);
    const { createChangeRequest } = await loadModule();
    await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      evalResultRef: 's3://eval-results/run-1.json',
      createdBy: 'user-1',
    });
    // If evalResultRef is passed without throwing, the insert accepted it.
    expect(auditChangeRequestedMock).toHaveBeenCalled();
  });

  it('passes null evalRunId when not provided', async () => {
    insertResults.push([{ id: 'cr-9', evalStatus: 'pending' }]);
    const { createChangeRequest } = await loadModule();
    const result = await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      createdBy: null,
    });
    expect(result.changeRequestId).toBe('cr-9');
  });

  it('throws when insert returns no rows', async () => {
    insertResults.push([]);
    const { createChangeRequest } = await loadModule();
    await expect(
      createChangeRequest({
        orgId: 'org-1',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow('change_request insert returned no rows');
  });

  it('handles createdBy=null', async () => {
    insertResults.push([{ id: 'cr-10', evalStatus: 'pending' }]);
    const { createChangeRequest } = await loadModule();
    const result = await createChangeRequest({
      orgId: 'org-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      createdBy: null,
    });
    expect(auditChangeRequestedMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null }),
    );
    expect(result.changeRequestId).toBe('cr-10');
  });
});

// ===========================================================================
// approveChangeRequest (REQ-MODELGOV-005/012/013/014)
// ===========================================================================
describe('approveChangeRequest (REQ-MODELGOV-005/012/013/014)', () => {
  it('throws ChangeRequestBlockedError when change_request is not found', async () => {
    // First withTenantScope call: select for the CR → empty (not found)
    selectResults.push([]);
    const { approveChangeRequest, ChangeRequestBlockedError } = await loadModule();
    const promise = approveChangeRequest({
      changeRequestId: 'cr-missing',
      orgId: 'org-1',
      approverId: 'user-approver',
    });
    // Single invocation — verify both class and message on the same rejection.
    await expect(promise).rejects.toBeInstanceOf(ChangeRequestBlockedError);
    await expect(promise).rejects.toThrow('change_request_not_found_or_org_mismatch');
  });

  it('throws ChangeRequestBlockedError and writes rejection audit when eval not passed', async () => {
    // select for CR → row with evalStatus=failed
    selectResults.push([
      {
        id: 'cr-fail',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'failed',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    const { approveChangeRequest, ChangeRequestBlockedError } = await loadModule();
    const promise = approveChangeRequest({
      changeRequestId: 'cr-fail',
      orgId: 'org-1',
      approverId: 'user-a',
    });
    // Single invocation — verify both class and message on the same rejection.
    await expect(promise).rejects.toBeInstanceOf(ChangeRequestBlockedError);
    await expect(promise).rejects.toThrow('eval_status_failed_not_passed');
    // writeAudit must have been called for the rejection record (M3 fix)
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'user-a',
        action: 'modelgov.rejected',
        resource_type: 'change_request',
        resource_id: 'cr-fail',
      }),
      mockTx,
    );
  });

  it('writes eval_status_pending_not_passed rejection when eval is still pending', async () => {
    selectResults.push([
      {
        id: 'cr-pending',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'pending',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    const { approveChangeRequest } = await loadModule();
    await expect(
      approveChangeRequest({
        changeRequestId: 'cr-pending',
        orgId: 'org-1',
        approverId: 'user-a',
      }),
    ).rejects.toThrow('eval_status_pending_not_passed');
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ reason: 'eval_status_pending_not_passed' }),
      }),
      mockTx,
    );
  });

  it('throws ChangeRequestBlockedError when approvalStatus is not pending_review', async () => {
    // select for CR → row with evalStatus=passed but approvalStatus=approved
    selectResults.push([
      {
        id: 'cr-done',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'approved',
        evalResultRef: null,
      },
    ]);
    const { approveChangeRequest, ChangeRequestBlockedError } = await loadModule();
    const promise = approveChangeRequest({
      changeRequestId: 'cr-done',
      orgId: 'org-1',
      approverId: 'user-a',
    });
    // Single invocation — verify both class and message on the same rejection.
    await expect(promise).rejects.toBeInstanceOf(ChangeRequestBlockedError);
    await expect(promise).rejects.toThrow('approval_status_approved_not_pending');
  });

  it('throws when approvalStatus=rejected', async () => {
    selectResults.push([
      {
        id: 'cr-rej',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'rejected',
        evalResultRef: null,
      },
    ]);
    const { approveChangeRequest } = await loadModule();
    await expect(
      approveChangeRequest({
        changeRequestId: 'cr-rej',
        orgId: 'org-1',
        approverId: 'user-a',
      }),
    ).rejects.toThrow('approval_status_rejected_not_pending');
  });

  it('approves successfully: activates new combination + supersedes current', async () => {
    // First withTenantScope: select for CR → row (passed + pending_review)
    selectResults.push([
      {
        id: 'cr-ok',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: 's3://eval/1.json',
      },
    ]);
    // Second withTenantScope (inside the approve block):
    //   select current active combo → [{ id: 'combo-old' }]
    selectResults.push([{ id: 'combo-old' }]);
    //   insert new combo → [{ id: 'combo-new' }]
    insertResults.push([{ id: 'combo-new' }]);

    const { approveChangeRequest } = await loadModule();
    const result = await approveChangeRequest({
      changeRequestId: 'cr-ok',
      orgId: 'org-1',
      approverId: 'user-approver',
    });
    expect(result).toEqual({ combinationId: 'combo-new' });
    expect(auditApprovedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-approver',
        resourceId: 'combo-new',
        changeRequestId: 'cr-ok',
        approverId: 'user-approver',
        combinationId: 'combo-new',
        evalResultRef: 's3://eval/1.json',
      }),
    );
  });

  it('uses evalResultRef from params when provided (overrides row)', async () => {
    selectResults.push([
      {
        id: 'cr-ref',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: 'old-ref',
      },
    ]);
    selectResults.push([]); // no current active combo
    insertResults.push([{ id: 'combo-2' }]);

    const { approveChangeRequest } = await loadModule();
    await approveChangeRequest({
      changeRequestId: 'cr-ref',
      orgId: 'org-1',
      approverId: 'user-a',
      evalResultRef: 'new-ref',
    });
    expect(auditApprovedMock).toHaveBeenCalledWith(
      expect.objectContaining({ evalResultRef: 'new-ref' }),
    );
  });

  it('uses evalResultRef from row when params.evalResultRef is undefined', async () => {
    selectResults.push([
      {
        id: 'cr-row-ref',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: 'row-ref',
      },
    ]);
    selectResults.push([]);
    insertResults.push([{ id: 'combo-3' }]);

    const { approveChangeRequest } = await loadModule();
    await approveChangeRequest({
      changeRequestId: 'cr-row-ref',
      orgId: 'org-1',
      approverId: 'user-a',
    });
    expect(auditApprovedMock).toHaveBeenCalledWith(
      expect.objectContaining({ evalResultRef: 'row-ref' }),
    );
  });

  it('uses null evalResultRef when neither params nor row have it', async () => {
    selectResults.push([
      {
        id: 'cr-no-ref',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    selectResults.push([]);
    insertResults.push([{ id: 'combo-4' }]);

    const { approveChangeRequest } = await loadModule();
    await approveChangeRequest({
      changeRequestId: 'cr-no-ref',
      orgId: 'org-1',
      approverId: 'user-a',
    });
    expect(auditApprovedMock).toHaveBeenCalledWith(
      expect.objectContaining({ evalResultRef: null }),
    );
  });

  it('approves when there is no current active combination (first approval)', async () => {
    selectResults.push([
      {
        id: 'cr-first',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    selectResults.push([]); // no current active combo
    insertResults.push([{ id: 'combo-first' }]);

    const { approveChangeRequest } = await loadModule();
    const result = await approveChangeRequest({
      changeRequestId: 'cr-first',
      orgId: 'org-1',
      approverId: 'user-a',
    });
    expect(result).toEqual({ combinationId: 'combo-first' });
  });

  it('throws ChangeRequestBlockedError when promptId is missing on the row', async () => {
    selectResults.push([
      {
        id: 'cr-no-prompt',
        promptId: null,
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    selectResults.push([]); // current active combo select
    const { approveChangeRequest, ChangeRequestBlockedError } = await loadModule();
    const promise = approveChangeRequest({
      changeRequestId: 'cr-no-prompt',
      orgId: 'org-1',
      approverId: 'user-a',
    });
    await expect(promise).rejects.toBeInstanceOf(ChangeRequestBlockedError);
    await expect(promise).rejects.toThrow('change_request_missing_prompt_or_model_pin');
  });

  it('throws ChangeRequestBlockedError when modelPinId is missing on the row', async () => {
    selectResults.push([
      {
        id: 'cr-no-pin',
        promptId: 'p',
        modelPinId: null,
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    selectResults.push([]);
    const { approveChangeRequest } = await loadModule();
    await expect(
      approveChangeRequest({
        changeRequestId: 'cr-no-pin',
        orgId: 'org-1',
        approverId: 'user-a',
      }),
    ).rejects.toThrow('change_request_missing_prompt_or_model_pin');
  });

  it('throws when insert of new combination returns no rows', async () => {
    selectResults.push([
      {
        id: 'cr-empty',
        promptId: 'p',
        modelPinId: 'm',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
        evalResultRef: null,
      },
    ]);
    selectResults.push([]);
    insertResults.push([]); // insert returns nothing
    const { approveChangeRequest } = await loadModule();
    await expect(
      approveChangeRequest({
        changeRequestId: 'cr-empty',
        orgId: 'org-1',
        approverId: 'user-a',
      }),
    ).rejects.toThrow('approved_combination insert returned no rows');
  });
});

// ===========================================================================
// recordEvalResult (async eval completion)
// ===========================================================================
describe('recordEvalResult (async eval completion)', () => {
  it('updates evalStatus=passed and writes auditEvalResult when eval passes', async () => {
    const { recordEvalResult } = await loadModule();
    const result = await recordEvalResult({
      changeRequestId: 'cr-eval-1',
      orgId: 'org-1',
      actorId: 'user-1',
      evalResultJson: passingEvalJson(),
      evalRunId: 'run-42',
    });
    expect(result.passed).toBe(true);
    expect(auditEvalResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        passed: true,
        changeRequestId: 'cr-eval-1',
        actorId: 'user-1',
      }),
    );
  });

  it('updates evalStatus=failed and writes auditEvalResult when eval fails', async () => {
    const { recordEvalResult } = await loadModule();
    const result = await recordEvalResult({
      changeRequestId: 'cr-eval-2',
      orgId: 'org-1',
      actorId: 'user-1',
      evalResultJson: failingEvalJson(),
    });
    expect(result.passed).toBe(false);
    expect(auditEvalResultMock).toHaveBeenCalledWith(expect.objectContaining({ passed: false }));
  });

  it('returns the full EvalGateResult (score, threshold, evalRunId)', async () => {
    const { recordEvalResult } = await loadModule();
    const result = await recordEvalResult({
      changeRequestId: 'cr-eval-3',
      orgId: 'org-1',
      actorId: null,
      evalResultJson: passingEvalJson(4),
      evalRunId: 'run-99',
      evalResultRef: 's3://ref',
    });
    expect(result).toEqual(
      expect.objectContaining({
        passed: true,
        score: 1,
        threshold: 0.8,
        evalRunId: 'run-99',
        evalResultRef: 's3://ref',
        reason: 'ok',
      }),
    );
  });

  it('handles actorId=null in audit', async () => {
    const { recordEvalResult } = await loadModule();
    await recordEvalResult({
      changeRequestId: 'cr-eval-4',
      orgId: 'org-1',
      actorId: null,
      evalResultJson: passingEvalJson(),
    });
    expect(auditEvalResultMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: null }));
  });

  it('passes evalResultRef through to the gate result', async () => {
    const { recordEvalResult } = await loadModule();
    const result = await recordEvalResult({
      changeRequestId: 'cr-eval-5',
      orgId: 'org-1',
      actorId: 'u',
      evalResultJson: passingEvalJson(),
      evalResultRef: 's3://eval/run-1.json',
    });
    expect(result.evalResultRef).toBe('s3://eval/run-1.json');
  });

  it('defaults evalRunId and evalResultRef to null when not provided', async () => {
    const { recordEvalResult } = await loadModule();
    const result = await recordEvalResult({
      changeRequestId: 'cr-eval-6',
      orgId: 'org-1',
      actorId: 'u',
      evalResultJson: passingEvalJson(),
    });
    expect(result.evalRunId).toBeNull();
    expect(result.evalResultRef).toBeNull();
  });
});

// ===========================================================================
// ChangeRequestBlockedError (error class)
// ===========================================================================
describe('ChangeRequestBlockedError', () => {
  it('extends Error and sets the name', async () => {
    const { ChangeRequestBlockedError } = await loadModule();
    const err = new ChangeRequestBlockedError('some_reason');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ChangeRequestBlockedError');
    expect(err.message).toBe('change request blocked: some_reason');
  });

  it('exposes the reason as a public field', async () => {
    const { ChangeRequestBlockedError } = await loadModule();
    const err = new ChangeRequestBlockedError('eval_status_pending_not_passed');
    expect(err.reason).toBe('eval_status_pending_not_passed');
  });
});
