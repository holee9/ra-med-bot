/**
 * Promote transaction tests for inbox.ticket → approved_answers.
 * SPEC-V3-INBOX-001 (REQ-V3-INBOX-028, REQ-V3-INBOX-005, REQ-V3-INBOX-011, AC-05, AC-11, Issue #320)
 *
 * Signature pattern tests (lib/signature/__tests__/queries.test.ts):
 * - Simple mockDb with vi.fn().mockReturnValue() chains
 * - Transaction mock with tx object containing insert/select stubs
 */

import { describe, expect, it, vi } from 'vitest';

// Mock lib/audit to avoid env var loading
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

const { promoteToApproved } = await import('@/lib/domains/inbox/promote');
type PromotionInput = import('@/lib/domains/inbox/types').PromotionInput;

describe('promoteToApproved', () => {
  it('AC-05: inserts approved_answer and updates ticket in transaction', async () => {
    const input: PromotionInput = {
      ticketId: 't1',
      approverId: 'user-1',
      esigSignature: 'approved-by-alice',
    };

    // Step 1 fetch returns 6 columns: id, question, finalAnswer, autoAnswer, triageState, orgId
    const ticket = {
      id: 't1',
      question: 'Test question',
      finalAnswer: 'Final approved answer',
      autoAnswer: '{"answer": "text", "citations": []}',
      triageState: 'needs-review' as const,
      orgId: 'org-1',
    };

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([ticket]),
          }),
        }),
      }),
      transaction: vi.fn((callback) => {
        const mockTx = {
          // H-1 (#321): in-tx SELECT ... FOR UPDATE re-verifies org_id.
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ orgId: 'org-1' }]),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        callCount++;
        return callback(mockTx);
      }),
    };

    await promoteToApproved(mockDb as never, input);
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(callCount).toBe(1);
  });

  it('AC-11: rolls back transaction on error', async () => {
    const input: PromotionInput = {
      ticketId: 't1',
      approverId: 'user-1',
      esigSignature: 'approved-by-alice',
    };

    // Step 1 fetch returns 6 columns
    const ticket = {
      id: 't1',
      question: 'Test question',
      finalAnswer: 'Final approved answer',
      autoAnswer: '{"answer": "text", "citations": []}',
      triageState: 'needs-review' as const,
      orgId: 'org-1',
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([ticket]),
          }),
        }),
      }),
      transaction: vi.fn((callback) => {
        const mockTx = {
          // H-1 (#321): in-tx SELECT ... FOR UPDATE re-verifies org_id.
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ orgId: 'org-1' }]),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockRejectedValue(new Error('DB error')),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        return callback(mockTx);
      }),
    };

    await expect(promoteToApproved(mockDb as never, input)).rejects.toThrow('DB error');
  });

  it('AC-05: validates ticket exists before promotion', async () => {
    const input: PromotionInput = {
      ticketId: 't-999',
      approverId: 'user-1',
      esigSignature: 'approved-by-alice',
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      transaction: vi.fn(),
    };

    await expect(promoteToApproved(mockDb as never, input)).rejects.toThrow('Ticket not found');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
