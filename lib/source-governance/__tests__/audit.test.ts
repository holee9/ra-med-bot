// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/audit (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-015)

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
  auditSourceApproval,
  auditSourceDeltaSyncUpdated,
  auditSourceGovernanceUpdated,
  auditSourceLowAuthorityFlagged,
  auditSourceReviewDue,
  auditSourceSuperseded,
} = await import('../audit');

function lastAudit(): AuditInput {
  const calls = writeAudit.mock.calls as unknown[][];
  return calls[calls.length - 1]?.[0] as AuditInput;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lib/source-governance/audit (REQ-SOURCE-GOV)', () => {
  it('auditSourceApproval writes source.approved for approved decision', async () => {
    await auditSourceApproval({ userId: 'u-1', sourceId: 's1', decision: 'approved' });
    expect(lastAudit().action).toBe('source.approved');
  });

  it('auditSourceApproval writes source.rejected for non-approved decision', async () => {
    await auditSourceApproval({ userId: 'u-1', sourceId: 's1', decision: 'pending_review' });
    expect(lastAudit().action).toBe('source.rejected');
  });

  it('auditSourceSuperseded writes source.superseded with target', async () => {
    await auditSourceSuperseded({ userId: 'u-1', sourceId: 's1', supersededBy: 's2' });
    expect(lastAudit().action).toBe('source.superseded');
    expect(lastAudit().meta_json).toMatchObject({ supersededBy: 's2' });
  });

  it('auditSourceReviewDue writes source.review_due with cycle + lastReviewed', async () => {
    await auditSourceReviewDue({
      userId: 'u-1',
      sourceId: 's1',
      reviewCycleDays: 365,
      lastReviewedAt: null,
    });
    expect(lastAudit().action).toBe('source.review_due');
  });

  it('auditSourceDeltaSyncUpdated writes source.delta_sync_updated with fields', async () => {
    await auditSourceDeltaSyncUpdated({
      userId: 'u-1',
      sourceId: 's1',
      updatedFields: ['authority'],
    });
    expect(lastAudit().action).toBe('source.delta_sync_updated');
  });

  it('auditSourceGovernanceUpdated writes source.governance_updated', async () => {
    await auditSourceGovernanceUpdated({
      userId: 'u-1',
      sourceId: 's1',
      fields: { authority: 'B' },
    });
    expect(lastAudit().action).toBe('source.governance_updated');
  });

  it('auditSourceLowAuthorityFlagged writes source.low_authority_flagged', async () => {
    await auditSourceLowAuthorityFlagged({
      userId: 'u-1',
      sourceId: 's1',
      reason: 'no_primary',
      highestGrade: 'secondary_reference',
    });
    expect(lastAudit().action).toBe('source.low_authority_flagged');
  });
});
