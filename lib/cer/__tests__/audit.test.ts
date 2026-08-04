// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/cer/audit (SPEC-REGULA-CER-001).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-036~040)

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
  auditCerCreated,
  auditCerExpertApproved,
  auditCerExported,
  auditCerLiteratureSearch,
  auditCerStageCompleted,
} = await import('../audit');

function lastAudit(): AuditInput {
  const calls = writeAudit.mock.calls as unknown[][];
  return calls[calls.length - 1]?.[0] as AuditInput;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lib/cer/audit (21 CFR Part 11, REQ-CER-036..040)', () => {
  it('auditCerCreated writes cer_created', async () => {
    await auditCerCreated('u-1', 'cer-1');
    expect(lastAudit()).toMatchObject({
      action: 'cer_created',
      resource_type: 'cer_run',
      resource_id: 'cer-1',
    });
  });

  it('auditCerStageCompleted writes cer_stage_completed with stageId', async () => {
    await auditCerStageCompleted('u-1', 'cer-1', 3);
    expect(lastAudit().meta_json).toMatchObject({ stageId: 3 });
  });

  it('auditCerExpertApproved writes cer_expert_approved', async () => {
    await auditCerExpertApproved('u-1', 'cer-1');
    expect(lastAudit().action).toBe('cer_expert_approved');
  });

  it('auditCerExported writes cer_exported with format', async () => {
    await auditCerExported('u-1', 'cer-1', 'pdf');
    expect(lastAudit().meta_json).toMatchObject({ format: 'pdf' });
  });

  it('auditCerLiteratureSearch stores query length (not raw query) + result count', async () => {
    await auditCerLiteratureSearch('u-1', 'cer-1', 'pacemaker safety', 7);
    const meta = lastAudit().meta_json;
    expect(meta).toMatchObject({ queryLength: 16, resultCount: 7 });
    // PII rule: raw query text must NOT appear in meta.
    expect(JSON.stringify(meta)).not.toMatch(/pacemaker/);
  });
});
