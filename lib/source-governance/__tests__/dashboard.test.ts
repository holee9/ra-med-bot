// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/source-governance/dashboard (SPEC-REGULA-SOURCE-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-012/014)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: unknown[] = [];

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { getStaleCitationArtifacts } = await import('../dashboard');

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe('getStaleCitationArtifacts (REQ-SOURCE-GOV-014)', () => {
  it('returns [] when no stale citations exist', async () => {
    expect(await getStaleCitationArtifacts('org-1')).toEqual([]);
  });

  it('maps superseded rows with the correct reason', async () => {
    rows = [
      {
        messageId: 'm1',
        sourceId: 's1',
        sourceTitle: 'ISO 13485',
        supersededBy: 's2',
        sunsetDate: null,
      },
    ];
    const result = await getStaleCitationArtifacts('org-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe('superseded by s2');
    expect(result[0]?.sourceTitle).toBe('ISO 13485');
  });

  it('maps sunset-past rows with the correct reason', async () => {
    rows = [
      {
        messageId: 'm2',
        sourceId: 's3',
        sourceTitle: null,
        supersededBy: null,
        sunsetDate: '2025-01-01',
      },
    ];
    const result = await getStaleCitationArtifacts('org-1');
    expect(result[0]?.reason).toContain('sunset date passed');
  });
});
