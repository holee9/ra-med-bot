// @MX:NOTE Regression coverage for PR #234 review fixes.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35)
// @MX:REASON captureKnowledgeGap must not stop at queue insertion. It must assign
// a cluster and, when GitHub automation is configured, create/append the issue
// and persist the issue number on the queue row.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertedRows: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  selectRows: [] as Array<{ githubIssueNumber: number | null }>,
  insertReturningId: 'gap-new',
  assignCluster: vi.fn(),
  createGitHubIssue: vi.fn(),
  appendGitHubIssue: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        mocks.insertedRows.push(row);
        return {
          returning: vi.fn(async () => [{ id: mocks.insertReturningId }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        mocks.updates.push(patch);
        return {
          where: vi.fn(async () => undefined),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => mocks.selectRows),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/audit', () => ({
  writeAudit: mocks.writeAudit,
}));

vi.mock('@/lib/knowledge-gap/clustering', () => ({
  assignCluster: mocks.assignCluster,
}));

vi.mock('@/lib/knowledge-gap/github-issue', () => ({
  createGitHubIssue: mocks.createGitHubIssue,
  appendGitHubIssue: mocks.appendGitHubIssue,
}));

describe('captureKnowledgeGap automation wiring', () => {
  beforeEach(() => {
    mocks.insertedRows.length = 0;
    mocks.updates.length = 0;
    mocks.selectRows.length = 0;
    mocks.insertReturningId = 'gap-new';
    vi.clearAllMocks();
  });

  it('assigns a cluster, creates a GitHub issue for a new cluster, and stores the issue number', async () => {
    mocks.assignCluster.mockResolvedValue({
      existingClusterId: null,
      newClusterId: 'cluster-new',
      matched: false,
    });
    mocks.createGitHubIssue.mockResolvedValue({
      number: 123,
      htmlUrl: 'https://github.com/acme/regula/issues/123',
    });

    const { captureKnowledgeGap } = await import('@/lib/knowledge-gap/detector');

    await captureKnowledgeGap({
      orgId: '00000000-0000-0000-0000-000000000001',
      conversationId: '00000000-0000-0000-0000-000000000002',
      messageId: '00000000-0000-0000-0000-000000000003',
      originalQuestion: 'What is the FDA 510(k) rule for class II devices?',
      reason: 'no_results',
      actorId: '00000000-0000-0000-0000-000000000004',
    });

    expect(mocks.assignCluster).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'gap-new',
      expect.any(String),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(mocks.createGitHubIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        clusterId: 'cluster-new',
        conversationId: '00000000-0000-0000-0000-000000000002',
        messageId: '00000000-0000-0000-0000-000000000003',
        reason: 'no_results',
      }),
    );
    expect(mocks.appendGitHubIssue).not.toHaveBeenCalled();
    expect(mocks.updates).toContainEqual({ githubIssueNumber: 123 });
  });

  it('appends to the existing cluster issue and stores that issue number on the new row', async () => {
    mocks.insertReturningId = 'gap-existing';
    mocks.assignCluster.mockResolvedValue({
      existingClusterId: 'cluster-existing',
      newClusterId: 'cluster-new',
      matched: true,
    });
    mocks.selectRows.push({ githubIssueNumber: 88 });
    mocks.appendGitHubIssue.mockResolvedValue({
      htmlUrl: 'https://github.com/acme/regula/issues/88#issuecomment-1',
    });

    const { captureKnowledgeGap } = await import('@/lib/knowledge-gap/detector');

    await captureKnowledgeGap({
      orgId: '00000000-0000-0000-0000-000000000001',
      conversationId: '00000000-0000-0000-0000-000000000002',
      messageId: '00000000-0000-0000-0000-000000000005',
      originalQuestion: 'What are similar FDA 510(k) requirements?',
      reason: 'low_confidence',
      actorId: null,
    });

    expect(mocks.createGitHubIssue).not.toHaveBeenCalled();
    expect(mocks.appendGitHubIssue).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        clusterId: 'cluster-existing',
        messageId: '00000000-0000-0000-0000-000000000005',
        reason: 'low_confidence',
      }),
    );
    expect(mocks.updates).toContainEqual({ githubIssueNumber: 88 });
  });
});
