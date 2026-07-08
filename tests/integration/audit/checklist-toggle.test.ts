// @MX:NOTE [AUTO] T-004 RED phase — integration test for checklist toggle audit.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-028)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth module before any import that uses it.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock audit module to intercept writeAudit calls.
const mockWriteAudit = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit', () => ({
  writeAudit: mockWriteAudit,
}));

// Mock drizzle db — return a controllable response for select and update queries.
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDb: {
  select: typeof mockSelect;
  update: typeof mockUpdate;
  transaction: (callback: (tx: typeof mockDb) => unknown) => unknown;
} = {
  select: mockSelect,
  update: mockUpdate,
  transaction: vi.fn((callback) => callback(mockDb)),
};
vi.mock('@/lib/db/client', () => ({
  db: mockDb,
}));

// Mock acl helpers used by withPermission.
vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));

// Mock signature lock — answers are NOT locked in these tests.
vi.mock('@/lib/signature/lock', () => ({
  isAnswerLocked: vi.fn().mockResolvedValue(false),
}));

describe('PATCH /api/ra/messages/:messageId/blocks/:blockId — checklist toggle audit', () => {
  const SESSION = {
    user: {
      id: 'user-uuid-001',
      role: 'ra-member',
      organizationId: 'org-uuid-001',
      email: 'member@test.com',
    },
  };

  const BLOCK_ROW = {
    blockId: 'block-uuid-001',
    messageId: 'msg-uuid-001',
    conversationId: 'conv-uuid-001',
    userId: 'user-uuid-001',
  };

  const VALID_CHECKLIST_BODY = {
    type: 'checklist',
    items: [{ id: 'item-1', title: 'Check item', completed: true }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls writeAudit with action: checklist.toggle after successful block update', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce(SESSION as never);

    // db.select chain: .from().innerJoin().innerJoin().where().limit() -> Promise([BLOCK_ROW])
    const mockWhereLimit = { limit: vi.fn().mockResolvedValue([BLOCK_ROW]) };
    const mockWhere = vi.fn().mockReturnValue(mockWhereLimit);
    const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockSelect.mockReturnValue({ from: mockFrom });

    // db.update chain: .set().where() -> Promise([])
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mockUpdate.mockReturnValue({ set: mockSet });

    const { PATCH } = await import('@/app/api/ra/messages/[messageId]/blocks/[blockId]/route');

    const req = new Request('http://localhost/api/ra/messages/msg-uuid-001/blocks/block-uuid-001', {
      method: 'PATCH',
      body: JSON.stringify(VALID_CHECKLIST_BODY),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ messageId: 'msg-uuid-001', blockId: 'block-uuid-001' }) as never,
    });

    expect(res.status).toBe(204);
    expect(mockWriteAudit).toHaveBeenCalledOnce();
    expect(mockWriteAudit.mock.calls[0][0]).toMatchObject({
      action: 'checklist.toggle',
      actor_id: 'user-uuid-001',
      resource_type: 'message_block',
      resource_id: 'block-uuid-001',
    });
  });

  it('does NOT call writeAudit when block is not found (404)', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce(SESSION as never);

    // db.select chain: returns no rows
    const mockWhereLimit = { limit: vi.fn().mockResolvedValue([]) };
    const mockWhere = vi.fn().mockReturnValue(mockWhereLimit);
    const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockSelect.mockReturnValue({ from: mockFrom });

    const { PATCH } = await import('@/app/api/ra/messages/[messageId]/blocks/[blockId]/route');

    const req = new Request('http://localhost/api/ra/messages/msg-uuid-001/blocks/block-uuid-001', {
      method: 'PATCH',
      body: JSON.stringify(VALID_CHECKLIST_BODY),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ messageId: 'msg-uuid-001', blockId: 'block-uuid-001' }) as never,
    });

    expect(res.status).toBe(404);
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });
});
