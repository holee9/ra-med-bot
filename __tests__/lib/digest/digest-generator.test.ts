/**
 * Tests for SPEC-REGULA-DIGEST-001 — digest-generator pure functions.
 * DB-dependent functions (generateWeeklyDigest) are tested via full module mocks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub environment before any module import that triggers lib/env.ts validation
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('AUTH_SECRET', 'test-secret-32-chars-long-enough!!');
vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
vi.stubEnv('AUTH_MICROSOFT_ID', 'test-ms-id');
vi.stubEnv('AUTH_MICROSOFT_SECRET', 'test-ms-secret');
vi.stubEnv('AUTH_GOOGLE_ID', 'test-google-id');
vi.stubEnv('AUTH_GOOGLE_SECRET', 'test-google-secret');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

// Mock DB client before it attempts real connection.
// vi.hoisted ensures the mock object exists before vi.mock factory runs.
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    query: {
      weeklyDigests: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));
vi.mock('../../../lib/kernel/db/client', () => ({
  db: dbMock,
  withTenantScope: vi.fn(
    async <T>(_orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> =>
      fn(dbMock) as Promise<T>,
  ),
}));

// Issue #378 PR-E-③: generateWeeklyDigest now writes digest_generated inside its
// withTenantScope tx. Mock writeAudit so this structure/counts unit test doesn't
// hit the real advisory-lock execute path — writeAudit internals (lock, hash chain)
// are covered by lib/audit + audit-chain tests; the digest route contract is
// covered by tests/unit/api/digest-route.test.ts.
vi.mock('../../../lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock AI summary.' }],
      }),
    },
  })),
}));

vi.mock('../../../lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  classifySeverity,
  generateWeeklyDigest,
  getWeekBounds,
  getWeekId,
} from '../../../lib/digest/digest-generator';

describe('getWeekId', () => {
  it('returns correct ISO week format for a known Monday', () => {
    // 2026-06-01 is a Monday — week 23 of 2026
    const result = getWeekId(new Date('2026-06-01'));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
    expect(result).toBe('2026-W23');
  });

  it('returns correct ISO week format for year boundary', () => {
    // 2026-01-01 is a Thursday — belongs to week 1 of 2026
    const result = getWeekId(new Date('2026-01-01'));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('getWeekBounds', () => {
  it('returns Monday start and Sunday end for week 2026-W23', () => {
    const { start, end } = getWeekBounds('2026-W23');
    // 2026-W23 starts Monday 2026-06-01
    expect(start.getUTCDay()).toBe(1); // Monday
    expect(end.getUTCDay()).toBe(0); // Sunday
  });

  it('start is before end', () => {
    const { start, end } = getWeekBounds('2026-W23');
    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it('span is exactly 7 days minus 1ms', () => {
    const { start, end } = getWeekBounds('2026-W23');
    const diff = end.getTime() - start.getTime();
    // 7 days * 86400000ms - 1ms = 604799999
    expect(diff).toBe(7 * 86400000 - 1);
  });
});

describe('classifySeverity', () => {
  it('returns critical when severity is "critical"', () => {
    expect(classifySeverity('critical', null)).toBe('critical');
  });

  it('returns critical when impactScore >= 0.9', () => {
    expect(classifySeverity('info', 0.95)).toBe('critical');
    expect(classifySeverity('info', 0.9)).toBe('critical');
  });

  it('returns high when severity is "warning"', () => {
    expect(classifySeverity('warning', null)).toBe('high');
  });

  it('returns high when impactScore >= 0.7', () => {
    expect(classifySeverity('info', 0.75)).toBe('high');
    expect(classifySeverity('info', 0.7)).toBe('high');
  });

  it('returns medium when severity is "info"', () => {
    expect(classifySeverity('info', null)).toBe('medium');
  });

  it('returns medium when impactScore >= 0.4', () => {
    expect(classifySeverity('unknown', 0.5)).toBe('medium');
    expect(classifySeverity('unknown', 0.4)).toBe('medium');
  });

  it('returns low when impactScore < 0.4', () => {
    expect(classifySeverity('unknown', 0.3)).toBe('low');
    expect(classifySeverity('unknown', 0.0)).toBe('low');
  });

  it('returns low when impactScore is null and severity is unknown', () => {
    expect(classifySeverity('unknown', null)).toBe('low');
  });
});

describe('generateWeeklyDigest', () => {
  beforeEach(() => {
    vi.stubEnv('E2E_TEST_MODE', 'true');
  });

  it('returns DigestPayload with correct structure when DB returns empty', async () => {
    const payload = await generateWeeklyDigest('org-123', '2026-W23');
    expect(payload).toMatchObject({
      week_id: '2026-W23',
      org_id: 'org-123',
      updates: expect.any(Array),
      update_count: expect.any(Number),
      critical_count: expect.any(Number),
      high_count: expect.any(Number),
      medium_count: expect.any(Number),
      low_count: expect.any(Number),
    });
  });

  it('count properties sum to update_count', async () => {
    const payload = await generateWeeklyDigest('org-456', '2026-W23');
    const sumCounts =
      payload.critical_count + payload.high_count + payload.medium_count + payload.low_count;
    expect(sumCounts).toBe(payload.update_count);
  });
});
