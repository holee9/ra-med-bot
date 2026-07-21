// @MX:NOTE [AUTO] Integration tests for GET /api/standards/check — SPEC-REGULA-STANDARDS-001 (AC-06).
// AC-06: FDA withdrawn → warn + alternative. env unset → degraded=true.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@/lib/kernel/auth', () => ({
  auth: () => authMock(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/kernel/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/kernel/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/lib/kernel/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) => cb({})),
  db: {},
}));

// Hoisted mock so the route picks it up at import time.
const checkRecognitionMock = vi.fn();
vi.mock('@/lib/standards/recognition-check', () => ({
  checkRecognition: (...a: unknown[]) => checkRecognitionMock(...a),
}));

const ORIGINAL_ENV = { ...process.env };
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('GET /api/standards/check — AC-06 degraded + withdrawn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'viewer', organizationId: 'org-1' },
    });
    const { FDA_RECOGNIZED_STANDARDS_API_URL, ...rest } = process.env;
    void FDA_RECOGNIZED_STANDARDS_API_URL;
    process.env = rest;
  });

  it('returns degraded=true when FDA env is unset (Charter [지양-3])', async () => {
    checkRecognitionMock.mockResolvedValueOnce({
      standardId: VALID_UUID,
      status: 'unknown',
      degraded: true,
      note: 'FDA_STANDARDS_API_URL not configured; recognition from local catalog (degraded).',
    });

    const { GET } = await import('@/app/api/standards/check/route');
    const res = await GET(
      new Request(`http://localhost/api/standards/check?standard=${VALID_UUID}`),
      {},
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.degraded).toBe(true);
  });

  it('AC-06: withdrawn status returns alternativeStandardId suggestion', async () => {
    checkRecognitionMock.mockResolvedValueOnce({
      standardId: VALID_UUID,
      status: 'withdrawn',
      degraded: false,
      alternativeStandardId: 'std-99',
      alternativeStandardNumber: 'IEC 60601-1:2020',
      note: 'Live FDA API response (withdrawn). Alternative suggested: IEC 60601-1:2020.',
    });

    const { GET } = await import('@/app/api/standards/check/route');
    const res = await GET(
      new Request(`http://localhost/api/standards/check?standard=${VALID_UUID}`),
      {},
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('withdrawn');
    expect(json.alternativeStandardId).toBe('std-99');
    expect(json.alternativeStandardNumber).toBe('IEC 60601-1:2020');
  });
});
