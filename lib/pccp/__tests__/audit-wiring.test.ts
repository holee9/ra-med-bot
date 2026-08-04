// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/pccp/audit-wiring (SPEC-REGULA-PCCP-001).
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-021..024)

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
  auditPccpAlgorithmChangeTriggered,
  auditPccpComponentCompleted,
  auditPccpCreated,
  auditPccpExpertApproved,
  auditPccpStatusChanged,
} = await import('../audit-wiring');

function lastAudit(): AuditInput {
  const calls = writeAudit.mock.calls as unknown[][];
  return calls[calls.length - 1]?.[0] as AuditInput;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lib/pccp/audit-wiring (21 CFR Part 11)', () => {
  it('auditPccpCreated writes pccp_created with device meta', async () => {
    await auditPccpCreated({
      actorId: 'u-1',
      pccpVersionId: 'pv-1',
      deviceId: 'd-1',
      deviceName: 'Dev',
    });
    expect(lastAudit()).toMatchObject({
      action: 'pccp_created',
      resource_type: 'pccp_version',
      resource_id: 'pv-1',
    });
    expect(lastAudit().meta_json).toMatchObject({ deviceId: 'd-1', deviceName: 'Dev' });
  });

  it('auditPccpComponentCompleted writes pccp_component_completed', async () => {
    await auditPccpComponentCompleted({
      actorId: 'u-1',
      pccpVersionId: 'pv-1',
      componentType: 'sps',
    });
    expect(lastAudit()).toMatchObject({
      action: 'pccp_component_completed',
      resource_type: 'pccp_component',
    });
  });

  it('auditPccpExpertApproved writes pccp_expert_approved', async () => {
    await auditPccpExpertApproved({ actorId: 'u-1', pccpVersionId: 'pv-1' });
    expect(lastAudit().action).toBe('pccp_expert_approved');
  });

  it('auditPccpAlgorithmChangeTriggered writes the trigger reason', async () => {
    await auditPccpAlgorithmChangeTriggered({
      actorId: 'u-1',
      pccpVersionId: 'pv-1',
      triggerReason: 'significant_modification',
    });
    expect(lastAudit().meta_json).toMatchObject({ triggerReason: 'significant_modification' });
  });

  it('auditPccpStatusChanged writes from/to status', async () => {
    await auditPccpStatusChanged({
      actorId: 'u-1',
      pccpVersionId: 'pv-1',
      fromStatus: 'draft',
      toStatus: 'submitted',
    });
    expect(lastAudit().meta_json).toMatchObject({ fromStatus: 'draft', toStatus: 'submitted' });
  });
});
