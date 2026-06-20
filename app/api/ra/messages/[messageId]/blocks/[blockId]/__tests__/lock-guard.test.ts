/**
 * TDD RED: Tests that block PATCH returns 403 when answer is locked (signed).
 * REQ-ESIG-003: Post-signature modification MUST return 403 Forbidden.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  db: {},
}));
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/signature/lock', () => ({
  isAnswerLocked: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { isAnswerLocked } from '@/lib/signature/lock';
import { PATCH } from '../route';

const mockSession = {
  user: {
    id: 'user-001',
    role: 'ra-member',
    organizationId: 'org-001',
    email: 'user@example.com',
  },
};

const makeRequest = () =>
  new Request('http://localhost/api/ra/messages/msg-001/blocks/blk-001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'checklist', items: [] }),
  });

const makeCtx = () => ({
  params: Promise.resolve({ messageId: 'msg-001', blockId: 'blk-001' }),
});

describe('PATCH /api/ra/messages/[messageId]/blocks/[blockId] — signature lock guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when answer has an active signature (locked)', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never);
    vi.mocked(isAnswerLocked).mockResolvedValue(true);

    const res = await PATCH(makeRequest(), makeCtx());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('answer_locked');
  });
});
