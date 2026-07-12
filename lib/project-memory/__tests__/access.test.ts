// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/project-memory/access (SPEC-REGULA-PROJECT-MEMORY-001, AC-08).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001

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
  assertMemoryInOrg,
  assertProjectInOrg,
  memoryBelongsToOrg,
  projectBelongsToOrg,
  resolveMemoryOrg,
  resolveProjectOrg,
} = await import('../access');

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
});

describe('resolve / belongs helpers', () => {
  it('resolveProjectOrg returns the org or null', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await resolveProjectOrg('p-1')).toBe('org-1');
    selectQueue = [[]];
    expect(await resolveProjectOrg('px')).toBeNull();
  });

  it('projectBelongsToOrg is true on match, false on mismatch / missing', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await projectBelongsToOrg('p-1', 'org-1')).toBe(true);
    selectQueue = [[{ orgId: 'org-B' }]];
    expect(await projectBelongsToOrg('p-1', 'org-A')).toBe(false);
    selectQueue = [[]];
    expect(await projectBelongsToOrg('px', 'org-1')).toBe(false);
  });

  it('resolveMemoryOrg resolves via the join', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await resolveMemoryOrg('m-1')).toBe('org-1');
  });

  it('memoryBelongsToOrg is true on match, false on mismatch / missing', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    expect(await memoryBelongsToOrg('m-1', 'org-1')).toBe(true);
    selectQueue = [[{ orgId: 'org-B' }]];
    expect(await memoryBelongsToOrg('m-1', 'org-A')).toBe(false);
    selectQueue = [[]];
    expect(await memoryBelongsToOrg('mx', 'org-1')).toBe(false);
  });
});

describe('assertProjectInOrg (AC-08 IDOR + audit)', () => {
  it('returns null on success (no audit)', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    const denied = await assertProjectInOrg('p-1', {
      actorId: 'u-1',
      organizationId: 'org-1',
      action: 'projectmemory.view',
    });
    expect(denied).toBeNull();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('returns 403 + writes rbac.permission_deny audit on cross-org mismatch', async () => {
    selectQueue = [[{ orgId: 'org-B' }]];
    const denied = await assertProjectInOrg('p-1', {
      actorId: 'u-1',
      organizationId: 'org-A',
      action: 'projectmemory.manage',
    });
    expect(denied).toBeInstanceOf(Response);
    expect((denied as Response).status).toBe(403);
    const audit = writeAudit.mock.calls[0]?.[0] as AuditInput;
    expect(audit.action).toBe('rbac.permission_deny');
    expect(audit.meta_json?.reason).toBe('idor_project_org_mismatch');
  });

  it('returns 403 on a missing project (null org)', async () => {
    selectQueue = [[]];
    const denied = await assertProjectInOrg('px', {
      actorId: 'u-1',
      organizationId: 'org-1',
      action: 'projectmemory.view',
    });
    expect((denied as Response).status).toBe(403);
  });
});

describe('assertMemoryInOrg (AC-08 IDOR + audit)', () => {
  it('returns null on success', async () => {
    selectQueue = [[{ orgId: 'org-1' }]];
    const denied = await assertMemoryInOrg('m-1', {
      actorId: 'u-1',
      organizationId: 'org-1',
      action: 'projectmemory.manage',
    });
    expect(denied).toBeNull();
  });

  it('returns 403 + audit on mismatch', async () => {
    selectQueue = [[{ orgId: 'org-B' }]];
    const denied = await assertMemoryInOrg('m-1', {
      actorId: 'u-1',
      organizationId: 'org-A',
      action: 'projectmemory.manage',
    });
    expect((denied as Response).status).toBe(403);
    const audit = writeAudit.mock.calls[0]?.[0] as AuditInput;
    expect(audit.meta_json?.reason).toBe('idor_memory_org_mismatch');
  });
});
