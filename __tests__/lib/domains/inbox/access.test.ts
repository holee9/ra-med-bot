/**
 * IDOR defense tests for inbox_tickets access control.
 * SPEC-V3-INBOX-001 (REQ-V3-INBOX-008, AC-08, Issue #320)
 *
 * Pattern: lib/signature/__tests__/queries.test.ts (mockDb injection).
 * mockDb stubs the chain result directly; the real drizzle eq() result is
 * passed to .where() but ignored by the stub, so no eq/schema mock is needed.
 */

import { assertTicketInOrg, isTicketInOrg } from '@/lib/domains/inbox/access';
import { describe, expect, it, vi } from 'vitest';

// Build a mockDb whose select(...).from(...).where(...).limit(1) resolves to `rows`.
// access.ts calls: db.select({orgId}).from(inboxTickets).where(eq(...)).limit(1)
function makeAccessMockDb(rows: Array<{ orgId: string }>) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

describe('isTicketInOrg', () => {
  it('returns true when ticket belongs to org', async () => {
    const mockDb = makeAccessMockDb([{ orgId: 'org-1' }]);
    // Signature: isTicketInOrg(db, ticketId, orgId)
    const result = await isTicketInOrg(mockDb as never, 't1', 'org-1');
    expect(result).toBe(true);
  });

  it('returns false when ticket belongs to different org', async () => {
    const mockDb = makeAccessMockDb([{ orgId: 'org-2' }]);
    const result = await isTicketInOrg(mockDb as never, 't1', 'org-1');
    expect(result).toBe(false);
  });

  it('returns false when ticket does not exist', async () => {
    const mockDb = makeAccessMockDb([]);
    const result = await isTicketInOrg(mockDb as never, 't-999', 'org-1');
    expect(result).toBe(false);
  });
});

describe('assertTicketInOrg', () => {
  it('AC-08: throws 404 when ticket does not exist', async () => {
    const mockDb = makeAccessMockDb([]);
    await expect(assertTicketInOrg(mockDb as never, 't-999', 'org-1')).rejects.toThrow('not found');
  });

  it('AC-08: throws 404 when ticket belongs to different org (information leak prevention)', async () => {
    const mockDb = makeAccessMockDb([{ orgId: 'org-2' }]);
    await expect(assertTicketInOrg(mockDb as never, 't1', 'org-1')).rejects.toThrow('not found');
  });

  it('AC-08: does not throw when access is valid', async () => {
    const mockDb = makeAccessMockDb([{ orgId: 'org-1' }]);
    await expect(assertTicketInOrg(mockDb as never, 't1', 'org-1')).resolves.toBeUndefined();
  });
});
