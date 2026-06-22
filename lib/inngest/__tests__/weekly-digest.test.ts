// @vitest-environment node
// Regression coverage for manual digest replay targeting.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DigestPayload } from '../../digest/digest-generator';

const ormMocks = vi.hoisted(() => ({
  and: vi.fn((...clauses: unknown[]) => ({ clauses, op: 'and' })),
  eq: vi.fn((left: unknown, right: unknown) => ({ left, op: 'eq', right })),
  ne: vi.fn((left: unknown, right: unknown) => ({ left, op: 'ne', right })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: ormMocks.and,
    eq: ormMocks.eq,
    ne: ormMocks.ne,
  };
});

import { orgDigestPreferences } from '../../db/schema';
import { buildDigestPreferencesPredicate, processDigestPreference } from '../digest/weekly-digest';

describe('buildDigestPreferencesPredicate', () => {
  beforeEach(() => {
    ormMocks.and.mockClear();
    ormMocks.eq.mockClear();
    ormMocks.ne.mockClear();
  });

  it('filters manual digest triggers to the requested org and enabled preferences', () => {
    const predicate = buildDigestPreferencesPredicate({ orgId: 'org-target', weekId: '2026-W25' });

    expect(ormMocks.eq).toHaveBeenCalledWith(orgDigestPreferences.orgId, 'org-target');
    expect(ormMocks.ne).toHaveBeenCalledWith(orgDigestPreferences.frequency, 'disabled');
    expect(ormMocks.and).toHaveBeenCalledWith(
      { left: orgDigestPreferences.orgId, op: 'eq', right: 'org-target' },
      { left: orgDigestPreferences.frequency, op: 'ne', right: 'disabled' },
    );
    expect(predicate).toEqual({
      clauses: [
        { left: orgDigestPreferences.orgId, op: 'eq', right: 'org-target' },
        { left: orgDigestPreferences.frequency, op: 'ne', right: 'disabled' },
      ],
      op: 'and',
    });
  });

  it('keeps scheduled cron runs scoped to weekly preferences only', () => {
    const predicate = buildDigestPreferencesPredicate({});

    expect(ormMocks.eq).toHaveBeenCalledWith(orgDigestPreferences.frequency, 'weekly');
    expect(ormMocks.and).not.toHaveBeenCalled();
    expect(ormMocks.ne).not.toHaveBeenCalled();
    expect(predicate).toEqual({
      left: orgDigestPreferences.frequency,
      op: 'eq',
      right: 'weekly',
    });
  });
});

describe('processDigestPreference', () => {
  const payload = { week_id: '2026-W25' } as DigestPayload;

  it('throws when digest email delivery returns false so Inngest can retry the step', async () => {
    const errorLogger = vi.fn();
    const generateWeeklyDigest = vi.fn().mockResolvedValue(payload);
    const sendDigestEmail = vi.fn().mockResolvedValue(false);

    await expect(
      processDigestPreference({
        generateWeeklyDigest,
        logger: { error: errorLogger },
        pref: {
          orgId: '00000000-0000-0000-0000-000000000001',
          recipientEmails: ['ra@example.com'],
        },
        sendDigestEmail,
        weekId: '2026-W25',
      }),
    ).rejects.toThrow('Digest email send failed for org 00000000-0000-0000-0000-000000000001');

    expect(generateWeeklyDigest).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '2026-W25',
    );
    expect(sendDigestEmail).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001', payload, [
      'ra@example.com',
    ]);
    expect(errorLogger).toHaveBeenCalled();
  });
});
