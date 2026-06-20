/**
 * TDD RED: Tests that POST /api/ra/refine returns 403 when answer is locked.
 * REQ-ESIG-003: Post-signature modification MUST return 403 Forbidden.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

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
vi.mock('ai', () => ({
  streamText: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { isAnswerLocked } from '@/lib/signature/lock';
import { POST } from '../route';

const mockSession = {
  user: {
    id: 'user-001',
    role: 'ra-member',
    organizationId: 'org-001',
    email: 'user@example.com',
  },
};

const makeRequest = () =>
  new Request('http://localhost/api/ra/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: 'msg-001',
      conversationId: 'conv-001',
      blockContent: 'Some content',
      tone: 'conservative',
    }),
  });

describe('POST /api/ra/refine — signature lock guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when answer has an active signature (locked)', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never);
    vi.mocked(isAnswerLocked).mockResolvedValue(true);

    const res = await POST(makeRequest(), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('answer_locked');
  });
});
