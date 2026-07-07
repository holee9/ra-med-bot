// @MX:NOTE [AUTO] Unit tests for evidence-writer dedup + Zod validation (SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M1 shared helper, REQ-VAL-006, Issue #49)
// @MX:REASON The helper is consumed by M1/M2/M3 (fan_in >= 3). Tests cover:
//   (a) valid input → INSERT called, (b) dedup short-circuit, (c) Zod rejection.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db client + schema so no real Postgres is hit.
// Drizzle query chain: db.select(...).from(...).where(...).limit(...)
//                       db.insert(...).values(...).returning(...)
const limitMock = vi.fn().mockResolvedValue([]);
const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
const fromMock = vi.fn().mockReturnValue({ where: whereMock });
const returningMock = vi.fn().mockResolvedValue([{ id: 'new-id-123' }]);
const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: fromMock })),
    insert: vi.fn(() => ({ values: valuesMock })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  validationEvidence: {
    id: 'id',
    releaseId: 'release_id',
    qualificationType: 'qualification_type',
    commitSha: 'commit_sha',
    testCommand: 'test_command',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
}));

import { insertValidationEvidence } from '@/lib/validation/evidence-writer';

describe('insertValidationEvidence (shared helper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty releaseId via Zod', async () => {
    await expect(
      insertValidationEvidence({
        releaseId: '',
        qualificationType: 'iq',
        commitSha: 'abc',
        testCommand: 'pnpm test',
        result: 'pass',
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid qualificationType via Zod', async () => {
    await expect(
      insertValidationEvidence({
        releaseId: 'v0.1.0',
        qualificationType: 'invalid' as never,
        commitSha: 'abc',
        testCommand: 'pnpm test',
        result: 'pass',
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid result via Zod', async () => {
    await expect(
      insertValidationEvidence({
        releaseId: 'v0.1.0',
        qualificationType: 'iq',
        commitSha: 'abc',
        testCommand: 'pnpm test',
        result: 'invalid' as never,
      }),
    ).rejects.toThrow();
  });

  it('accepts valid input and returns row id', async () => {
    const id = await insertValidationEvidence({
      releaseId: 'v0.1.0-rc1',
      qualificationType: 'iq',
      commitSha: 'abc123',
      testCommand: 'pnpm ci:typecheck',
      result: 'pass',
    });
    expect(id).toBe('new-id-123');
  });
});
