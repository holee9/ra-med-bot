// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/knowledge-promo/access (SPEC-REGULA-KNOWLEDGE-PROMO-001, AC-01/03).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});

vi.mock('@/lib/audit', () => ({ writeAudit }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return { db: { select: () => chain } };
});

const {
  assertMessageInOrg,
  assertPromotedAnswerInOrg,
  findExistingPromotion,
  messageBelongsToOrg,
  resolveMessageOrg,
  resolvePromotedAnswerOrg,
} = await import('../access');

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
});

describe('resolve / belongs helpers', () => {
  it('resolveMessageOrg returns the org or null', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await resolveMessageOrg('m-1')).toBe('org-1');
    selectQueue = [[]];
    expect(await resolveMessageOrg('mx')).toBeNull();
  });

  it('messageBelongsToOrg is true on match, false otherwise', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await messageBelongsToOrg('m-1', 'org-1')).toBe(true);
    selectQueue = [[{ orgId: 'org-B' }]];
    expect(await messageBelongsToOrg('m-1', 'org-A')).toBe(false);
  });

  it('resolvePromotedAnswerOrg resolves the promoted-answer org', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await resolvePromotedAnswerOrg('pa-1')).toBe('org-1');
  });
});

describe('assertMessageInOrg (AC-03 IDOR + audit)', () => {
  it('returns null on success (no audit)', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(
      await assertMessageInOrg('m-1', {
        actorId: 'u-1',
        organizationId: 'org-1',
        action: 'kp.promote',
      }),
    ).toBeNull();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('returns 403 + rbac.permission_deny audit on denial', async () => {
    selectQueue = [[{ orgId: 'org-B' }]];
    const denied = await assertMessageInOrg('m-1', {
      actorId: 'u-1',
      organizationId: 'org-A',
      action: 'kp.promote',
    });
    expect(denied).toBeInstanceOf(Response);
    expect((denied as Response).status).toBe(403);
    const audit = writeAudit.mock.calls[0]?.[0] as AuditInput;
    expect(audit.action).toBe('rbac.permission_deny');
    expect(audit.meta_json?.reason).toBe('message_not_in_org');
  });
});

describe('assertPromotedAnswerInOrg (AC-03)', () => {
  it('returns null on success', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(
      await assertPromotedAnswerInOrg('pa-1', {
        actorId: 'u-1',
        organizationId: 'org-1',
        action: 'kp.unpromote',
      }),
    ).toBeNull();
  });

  it('returns 403 + audit on denial', async () => {
    selectQueue = [[{ orgId: 'org-B' }]];
    const denied = await assertPromotedAnswerInOrg('pa-1', {
      actorId: 'u-1',
      organizationId: 'org-A',
      action: 'kp.unpromote',
    });
    expect((denied as Response).status).toBe(403);
    expect((writeAudit.mock.calls[0]?.[0] as AuditInput)?.meta_json?.reason).toBe(
      'promoted_answer_not_in_org',
    );
  });
});

describe('findExistingPromotion', () => {
  it('returns the existing row or null', async () => {
    selectQueue = [[{ id: 'pa-1', status: 'active' }]];
    expect(await findExistingPromotion('m-1', 'org-1')).toEqual({ id: 'pa-1', status: 'active' });
    selectQueue = [[]];
    expect(await findExistingPromotion('mx', 'org-1')).toBeNull();
  });
});
