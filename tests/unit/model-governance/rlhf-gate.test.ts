// @MX:NOTE [AUTO] Unit tests for submitRlhfProposal (REQ-MODELGOV-009).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 / Issue #402 (coverage ratchet-up).
// @MX:REASON REQ-MODELGOV-009 — RLHF improvement proposals are stored as
//   pending_review change_requests and NEVER applied without the full eval
//   + approval workflow. Tests verify the pending gate + SHA-256 hash + audit.
//   Mocks withTenantScope (calls cb with mock tx) + writeAudit. No real DB.

import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// biome-ignore lint/suspicious/noExplicitAny: mock tx is intentionally loose
let mockTx: any;
// biome-ignore lint/suspicious/noExplicitAny: queued insert result rows
const insertResults: any[][] = [];
const writeAuditMock = vi.fn().mockResolvedValue(undefined);

async function loadModule() {
  vi.doMock('@/lib/kernel/db/client', () => ({
    withTenantScope: async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
    db: {},
  }));
  vi.doMock('@/lib/kernel/db/schema', () => ({
    changeRequest: {
      id: 'id',
      orgId: 'orgId',
      promptId: 'promptId',
      modelPinId: 'modelPinId',
      evalStatus: 'evalStatus',
      approvalStatus: 'approvalStatus',
      createdBy: 'createdBy',
    },
  }));
  vi.doMock('@/lib/kernel/audit', () => ({ writeAudit: writeAuditMock }));
  vi.resetModules();
  return import('@/lib/model-governance/rlhf-gate');
}

beforeEach(() => {
  insertResults.length = 0;
  writeAuditMock.mockClear();
  mockTx = {
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(insertResults.shift() ?? []),
      }),
    }),
  };
});

afterEach(() => {
  vi.doUnmock('@/lib/kernel/db/client');
  vi.doUnmock('@/lib/kernel/db/schema');
  vi.doUnmock('@/lib/kernel/audit');
});

describe('submitRlhfProposal (REQ-MODELGOV-009)', () => {
  it('stores the proposal as a pending_review change_request and returns the id', async () => {
    insertResults.push([{ id: 'cr-rlhf-1' }]);
    const { submitRlhfProposal } = await loadModule();
    const result = await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'user-1',
      proposalText: 'Make answers more concise',
    });
    expect(result).toEqual({ changeRequestId: 'cr-rlhf-1' });
  });

  it('writes an audit row with action=modelgov.change_requested', async () => {
    insertResults.push([{ id: 'cr-rlhf-2' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'user-1',
      proposalText: 'Improve citation format',
    });
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'modelgov.change_requested',
        resource_type: 'change_request',
        resource_id: 'cr-rlhf-2',
      }),
      mockTx,
    );
  });

  it('stores source=rlhf in audit meta_json', async () => {
    insertResults.push([{ id: 'cr-3' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'text',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ source: 'rlhf' }),
      }),
      mockTx,
    );
  });

  it('stores a sha256-prefixed hash of the proposal text (not the raw text)', async () => {
    insertResults.push([{ id: 'cr-4' }]);
    const { submitRlhfProposal } = await loadModule();
    const proposalText = 'Add more disclaimers';
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText,
    });
    const expectedHash = `sha256:${createHash('sha256').update(proposalText, 'utf8').digest('hex')}`;
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ proposal_text_hash: expectedHash }),
      }),
      mockTx,
    );
  });

  it('does NOT store the raw proposal text in audit meta_json (PII-safe)', async () => {
    insertResults.push([{ id: 'cr-5' }]);
    const { submitRlhfProposal } = await loadModule();
    const proposalText = 'unique-proposal-text-for-pii-check';
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText,
    });
    const call = writeAuditMock.mock.calls[0]?.[0];
    const metaJson = call?.meta_json;
    expect(JSON.stringify(metaJson)).not.toContain(proposalText);
  });

  it('stores org_id in audit meta_json', async () => {
    insertResults.push([{ id: 'cr-6' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-abc',
      submittedBy: 'u',
      proposalText: 'text',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ org_id: 'org-abc' }),
      }),
      mockTx,
    );
  });

  it('stores prompt_id=null in audit meta when no promptId is provided', async () => {
    insertResults.push([{ id: 'cr-7' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'general improvement',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ prompt_id: null }),
      }),
      mockTx,
    );
  });

  it('stores prompt_id in audit meta when a promptId is provided', async () => {
    insertResults.push([{ id: 'cr-8' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      promptId: 'prompt-uuid-42',
      proposalText: 'improve this prompt',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ prompt_id: 'prompt-uuid-42' }),
      }),
      mockTx,
    );
  });

  it('sets actor_id from submittedBy', async () => {
    insertResults.push([{ id: 'cr-9' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'user-submitter',
      proposalText: 'text',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'user-submitter' }),
      mockTx,
    );
  });

  it('sets actor_id=null when submittedBy is null', async () => {
    insertResults.push([{ id: 'cr-10' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: null,
      proposalText: 'anonymous feedback',
    });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null }),
      mockTx,
    );
  });

  it('throws when insert returns no rows', async () => {
    insertResults.push([]); // insert returns nothing
    const { submitRlhfProposal } = await loadModule();
    await expect(
      submitRlhfProposal({
        orgId: 'org-1',
        submittedBy: 'u',
        proposalText: 'text',
      }),
    ).rejects.toThrow('change_request insert returned no rows');
  });

  it('produces different hashes for different proposal texts', async () => {
    insertResults.push([{ id: 'cr-a' }], [{ id: 'cr-b' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'proposal A',
    });
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'proposal B',
    });
    const hashA = writeAuditMock.mock.calls[0]?.[0]?.meta_json?.proposal_text_hash;
    const hashB = writeAuditMock.mock.calls[1]?.[0]?.meta_json?.proposal_text_hash;
    expect(hashA).not.toBe(hashB);
  });

  it('produces the same hash for the same proposal text (deterministic)', async () => {
    insertResults.push([{ id: 'cr-c' }], [{ id: 'cr-d' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'identical proposal',
    });
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'identical proposal',
    });
    const hash1 = writeAuditMock.mock.calls[0]?.[0]?.meta_json?.proposal_text_hash;
    const hash2 = writeAuditMock.mock.calls[1]?.[0]?.meta_json?.proposal_text_hash;
    expect(hash1).toBe(hash2);
  });

  it('passes the mock tx (dbs) to writeAudit for atomic commit', async () => {
    insertResults.push([{ id: 'cr-tx' }]);
    const { submitRlhfProposal } = await loadModule();
    await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: 'text',
    });
    // Second arg to writeAudit is the tx handle — must be the same mockTx
    // so the audit row commits atomically with the insert (M3 fix).
    expect(writeAuditMock.mock.calls[0]?.[1]).toBe(mockTx);
  });

  it('handles unicode and emoji in proposal text without error', async () => {
    insertResults.push([{ id: 'cr-uni' }]);
    const { submitRlhfProposal } = await loadModule();
    const result = await submitRlhfProposal({
      orgId: 'org-1',
      submittedBy: 'u',
      proposalText: '안녕하세요 🌸 Résumé — improve this',
    });
    expect(result.changeRequestId).toBe('cr-uni');
  });
});
