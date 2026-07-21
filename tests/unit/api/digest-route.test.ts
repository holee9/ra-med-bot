// @MX:NOTE [AUTO] Digest share route tests — public route must be token-gated.
// @MX:SPEC SPEC-REGULA-DIGEST-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

const digestRows: Array<{
  digestJson: Record<string, unknown>;
  weekId: string;
  generatedAt: Date;
}> = [];

const chain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(() => Promise.resolve(digestRows)),
};

const selectMock = vi.fn(() => chain);

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: selectMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  digestRows.length = 0;
  chain.from.mockReturnThis();
  chain.where.mockReturnThis();
  chain.limit.mockImplementation(() => Promise.resolve(digestRows));
});

const { GET } = await import('@/app/api/ra/digest/[weekId]/route');

describe('GET /api/ra/digest/[weekId]', () => {
  it('rejects requests without a share token', async () => {
    const res = await GET(new Request('http://localhost/api/ra/digest/2026-W23'), {
      params: Promise.resolve({ weekId: '2026-W23' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'share_token_required' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('returns the digest only when a token is supplied', async () => {
    digestRows.push({
      digestJson: { week_id: '2026-W23', updates: [] },
      weekId: '2026-W23',
      generatedAt: new Date('2026-06-13T00:00:00Z'),
    });

    const res = await GET(new Request('http://localhost/api/ra/digest/2026-W23?token=abc'), {
      params: Promise.resolve({ weekId: '2026-W23' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.weekId).toBe('2026-W23');
    expect(chain.where).toHaveBeenCalledTimes(1);
  });
});
