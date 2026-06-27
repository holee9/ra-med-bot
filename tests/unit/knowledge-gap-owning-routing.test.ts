// @MX:NOTE [AUTO] Unit tests for owning-project routing (#157) + #156 AC4 recorder.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC2/AC3/AC4 (Issue #157, Issue #156)
// @MX:REASON Covers: router (4-way + queue), owning-issue (idempotency + retry +
//   target-scoped client), link-back (mutual comments), token separation (read vs
//   issue token), detector wire-in (flag on/off = no regression), integration-gap
//   recorder (#156 AC4: tracked kinds enqueue; 'unconfigured' skips).
//
// NOTE: each describe block uses a uniquely-named vi.hoisted() binding. vi.hoisted
// declarations are hoisted to module scope, so a shared name would collide.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyOwningTarget } from '../../lib/knowledge-gap/router';

// Single shared audit mock — vitest applies only ONE vi.mock('@/lib/audit') per
// file, so both owning-issue and integration-gap describes must share it.
const auditMock = vi.hoisted(() => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/audit', () => ({ writeAudit: auditMock.writeAudit }));

// ---------------------------------------------------------------------------
// Router: deterministic 4-way + queue classification
// ---------------------------------------------------------------------------
describe('router.classifyOwningTarget — deterministic 4-way routing', () => {
  it('routes hybrid/API bug signals to hybrid-ra-saas', () => {
    expect(
      classifyOwningTarget({
        redactedQuestion: 'hybrid API returned 503 timeout',
        reason: 'policy_blocked',
      }),
    ).toBe('hybrid-ra-saas');
    expect(
      classifyOwningTarget({
        redactedQuestion: 'backend endpoint gateway error',
        reason: 'no_results',
      }),
    ).toBe('hybrid-ra-saas');
  });

  it('routes wiki/content signals to gitea-wiki', () => {
    expect(
      classifyOwningTarget({
        redactedQuestion: 'wiki 문서에 설명이 없어요',
        reason: 'low_citation',
      }),
    ).toBe('gitea-wiki');
    expect(
      classifyOwningTarget({
        redactedQuestion: 'ra-llm-wiki guide missing',
        reason: 'low_confidence',
      }),
    ).toBe('gitea-wiki');
  });

  it('routes internal process/SOP signals to md-process', () => {
    expect(
      classifyOwningTarget({ redactedQuestion: 'SOP 절차가 불명확합니다', reason: 'low_citation' }),
    ).toBe('md-process');
    expect(
      classifyOwningTarget({
        redactedQuestion: 'DHF work instruction policy gap',
        reason: 'no_results',
      }),
    ).toBe('md-process');
  });

  it('routes regulation signals to ra-project', () => {
    expect(
      classifyOwningTarget({
        redactedQuestion: 'FDA 510(k) 인허가 절차 질문',
        reason: 'low_confidence',
      }),
    ).toBe('ra-project');
    expect(
      classifyOwningTarget({
        redactedQuestion: 'EU MDR regulation coverage hole',
        reason: 'low_confidence',
      }),
    ).toBe('ra-project');
  });

  it('falls back to queue when no signal matches', () => {
    expect(classifyOwningTarget({ redactedQuestion: '안녕하세요', reason: 'low_confidence' })).toBe(
      'queue',
    );
  });

  it('RA-lead classification enum overrides keyword heuristics', () => {
    // 'bug' classification wins even if keywords suggest regulation.
    expect(
      classifyOwningTarget({
        redactedQuestion: 'FDA 510(k) regulation question',
        reason: 'policy_blocked',
        classification: 'bug',
      }),
    ).toBe('hybrid-ra-saas');
    expect(
      classifyOwningTarget({
        redactedQuestion: 'wiki content',
        reason: 'low_confidence',
        classification: 'md_process_gap',
      }),
    ).toBe('md-process');
  });
});

// ---------------------------------------------------------------------------
// owning-repos: token separation + degrade-to-queue
// ---------------------------------------------------------------------------
describe('owning-repos.readOwningRepoConfig — token separation + null on unconfigured', () => {
  // Node coerces `process.env.X = undefined` to the string 'undefined', which
  // would be a truthy repo value. Clear all relevant vars to '' in beforeEach.
  const OWNING_ENV_KEYS = [
    'OWNING_ISSUE_GITHUB_REPO_RA_PROJECT',
    'OWNING_ISSUE_GITHUB_REPO_MD_PROCESS',
    'OWNING_ISSUE_GITHUB_REPO_GITEA_WIKI',
    'OWNING_ISSUE_GITHUB_REPO_HYBRID',
    'OWNING_ISSUE_GITHUB_TOKEN',
    'OWNING_ISSUE_GITHUB_API_BASE_RA_PROJECT',
    'OWNING_ISSUE_GITHUB_API_BASE_MD_PROCESS',
    'OWNING_ISSUE_GITHUB_API_BASE_GITEA_WIKI',
    'OWNING_ISSUE_GITHUB_API_BASE_HYBRID_RA_SAAS',
    'READ_GITHUB_TOKEN',
    'KNOWLEDGE_GAP_GITHUB_TOKEN',
  ];

  beforeEach(() => {
    for (const k of OWNING_ENV_KEYS) process.env[k] = '';
    vi.resetModules();
  });
  afterEach(() => {
    for (const k of OWNING_ENV_KEYS) process.env[k] = '';
    vi.restoreAllMocks();
  });

  it('returns config when both repo + OWNING_ISSUE_GITHUB_TOKEN are set', async () => {
    process.env.OWNING_ISSUE_GITHUB_REPO_RA_PROJECT = 'acme/ra-project';
    process.env.OWNING_ISSUE_GITHUB_TOKEN = 'owning-pat';
    process.env.OWNING_ISSUE_GITHUB_API_BASE_RA_PROJECT = 'https://github.example.com';
    const { readOwningRepoConfig } = await import('../../lib/knowledge-gap/owning-repos');
    const cfg = readOwningRepoConfig('ra-project');
    expect(cfg).toEqual({
      repo: 'acme/ra-project',
      apiBase: 'https://github.example.com',
      token: 'owning-pat',
    });
  });

  it('returns null when repo unset (degrade to queue)', async () => {
    // beforeEach already cleared REPO to ''; only set the token.
    process.env.OWNING_ISSUE_GITHUB_TOKEN = 'owning-pat';
    const { readOwningRepoConfig } = await import('../../lib/knowledge-gap/owning-repos');
    expect(readOwningRepoConfig('ra-project')).toBeNull();
  });

  it('returns null when OWNING_ISSUE_GITHUB_TOKEN unset', async () => {
    process.env.OWNING_ISSUE_GITHUB_REPO_HYBRID = 'acme/hybrid';
    // OWNING_ISSUE_GITHUB_TOKEN already cleared to '' in beforeEach.
    const { readOwningRepoConfig } = await import('../../lib/knowledge-gap/owning-repos');
    expect(readOwningRepoConfig('hybrid-ra-saas')).toBeNull();
  });

  it('rejects non-https apiBase (SSRF guard) and falls back to canonical GitHub', async () => {
    process.env.OWNING_ISSUE_GITHUB_REPO_MD_PROCESS = 'acme/md';
    process.env.OWNING_ISSUE_GITHUB_TOKEN = 'owning-pat';
    process.env.OWNING_ISSUE_GITHUB_API_BASE_MD_PROCESS = 'http://attacker.example.com';
    const { readOwningRepoConfig } = await import('../../lib/knowledge-gap/owning-repos');
    const cfg = readOwningRepoConfig('md-process');
    expect(cfg?.apiBase).toBe('https://api.github.com');
  });

  it('does NOT consult READ_GITHUB_TOKEN or KNOWLEDGE_GAP_GITHUB_TOKEN (token separation)', async () => {
    process.env.OWNING_ISSUE_GITHUB_REPO_GITEA_WIKI = 'acme/wiki';
    process.env.READ_GITHUB_TOKEN = 'read-only-pat';
    process.env.KNOWLEDGE_GAP_GITHUB_TOKEN = 'triage-pat';
    // OWNING_ISSUE_GITHUB_TOKEN cleared to '' in beforeEach.
    const { readOwningRepoConfig } = await import('../../lib/knowledge-gap/owning-repos');
    expect(readOwningRepoConfig('gitea-wiki')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// owning-issue: idempotency + retry + audit on failure
// ---------------------------------------------------------------------------
const owningMocks = vi.hoisted(() => ({
  selectRows: [] as Array<{ owningIssueUrl: string | null }>,
  updates: [] as Array<Record<string, unknown>>,
  createIssue: vi.fn(),
  createComment: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => owningMocks.selectRows),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        owningMocks.updates.push(patch);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  },
}));

describe('owning-issue.createOwningIssue — idempotency + retry + audit', () => {
  const baseCtx = {
    queueId: 'q-1',
    redactedQuestion: '[redacted]',
    redactionHash: 'h',
    reason: 'low_confidence',
    clusterId: 'c-1',
    conversationId: 'conv-1',
    messageId: 'msg-1',
    triageIssueUrl: 'https://github.com/acme/triage/issues/5',
    actorId: null,
  } as const;

  beforeEach(() => {
    owningMocks.selectRows = [];
    owningMocks.updates = [];
    auditMock.writeAudit.mockClear();
    auditMock.writeAudit.mockResolvedValue(undefined);
    owningMocks.createIssue.mockReset();
    owningMocks.createComment.mockReset();
  });

  it('returns existing URL without creating when queue row already has owningIssueUrl (idempotent)', async () => {
    owningMocks.selectRows = [{ owningIssueUrl: 'https://github.com/acme/ra-project/issues/1' }];
    const { createOwningIssue } = await import('../../lib/knowledge-gap/owning-issue');
    const result = await createOwningIssue('ra-project', baseCtx, {
      configured: true,
      createIssue: owningMocks.createIssue,
      createComment: owningMocks.createComment,
    });
    expect(result?.htmlUrl).toBe('https://github.com/acme/ra-project/issues/1');
    expect(owningMocks.createIssue).not.toHaveBeenCalled();
    expect(auditMock.writeAudit).not.toHaveBeenCalled();
  });

  it('creates the owning issue, persists URL + target, and audits on success', async () => {
    owningMocks.selectRows = [{ owningIssueUrl: null }];
    owningMocks.createIssue.mockResolvedValueOnce({
      number: 42,
      htmlUrl: 'https://github.com/acme/ra-project/issues/42',
    });
    const { createOwningIssue } = await import('../../lib/knowledge-gap/owning-issue');
    const result = await createOwningIssue('ra-project', baseCtx, {
      configured: true,
      createIssue: owningMocks.createIssue,
      createComment: owningMocks.createComment,
    });
    expect(result).toEqual({
      number: 42,
      htmlUrl: 'https://github.com/acme/ra-project/issues/42',
      target: 'ra-project',
    });
    expect(owningMocks.updates[0]).toMatchObject({
      owningIssueUrl: 'https://github.com/acme/ra-project/issues/42',
      owningIssueTarget: 'ra-project',
    });
    expect(auditMock.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'owning_issue_created' }),
    );
  });

  it('retries 3x with backoff on failure, then audits owning_issue_creation_failed and returns null', async () => {
    owningMocks.selectRows = [{ owningIssueUrl: null }];
    owningMocks.createIssue
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockRejectedValueOnce(new Error('HTTP 500'));
    const { createOwningIssue } = await import('../../lib/knowledge-gap/owning-issue');
    const result = await createOwningIssue('hybrid-ra-saas', baseCtx, {
      configured: true,
      createIssue: owningMocks.createIssue,
      createComment: owningMocks.createComment,
    });
    expect(result).toBeNull();
    expect(owningMocks.createIssue).toHaveBeenCalledTimes(3);
    expect(auditMock.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'owning_issue_creation_failed' }),
    );
  });

  it('returns null without calling GitHub when client is unconfigured', async () => {
    owningMocks.selectRows = [{ owningIssueUrl: null }];
    const { createOwningIssue } = await import('../../lib/knowledge-gap/owning-issue');
    const result = await createOwningIssue('md-process', baseCtx, {
      configured: false,
      createIssue: owningMocks.createIssue,
      createComment: owningMocks.createComment,
    });
    expect(result).toBeNull();
    expect(owningMocks.createIssue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// link-back: mutual cross-link, bodies are URLs only
// ---------------------------------------------------------------------------
const linkBackMocks = vi.hoisted(() => ({
  triageCreateComment: vi.fn(),
  owningCreateComment: vi.fn(),
}));

describe('link-back.linkBackIssues — mutual URL-only comments', () => {
  beforeEach(() => {
    linkBackMocks.triageCreateComment.mockReset();
    linkBackMocks.owningCreateComment.mockReset();
    process.env.KNOWLEDGE_GAP_GITHUB_REPO = 'acme/triage';
  });
  afterEach(() => {
    process.env.KNOWLEDGE_GAP_GITHUB_REPO = undefined;
  });

  it('posts a comment on triage issue with owning URL AND on owning issue with triage URL', async () => {
    linkBackMocks.triageCreateComment.mockResolvedValue({ htmlUrl: 't-comment' });
    linkBackMocks.owningCreateComment.mockResolvedValue({ htmlUrl: 'o-comment' });
    const { linkBackIssues } = await import('../../lib/knowledge-gap/link-back');
    await linkBackIssues(
      5,
      {
        number: 42,
        htmlUrl: 'https://github.com/acme/ra-project/issues/42',
        target: 'ra-project',
      },
      {
        triageClient: { createIssue: vi.fn(), createComment: linkBackMocks.triageCreateComment },
        owningClient: { createIssue: vi.fn(), createComment: linkBackMocks.owningCreateComment },
      },
    );
    // Forward link (triage → owning)
    expect(linkBackMocks.triageCreateComment).toHaveBeenCalledWith({
      issueNumber: 5,
      body: expect.stringContaining('https://github.com/acme/ra-project/issues/42'),
    });
    // Backward link (owning → triage)
    expect(linkBackMocks.owningCreateComment).toHaveBeenCalledWith({
      issueNumber: 42,
      body: expect.stringContaining('https://github.com/acme/triage/issues/5'),
    });
  });

  it('never includes the redacted question in either comment body (PII guard)', async () => {
    linkBackMocks.triageCreateComment.mockResolvedValue({ htmlUrl: '' });
    linkBackMocks.owningCreateComment.mockResolvedValue({ htmlUrl: '' });
    const { linkBackIssues } = await import('../../lib/knowledge-gap/link-back');
    await linkBackIssues(
      5,
      { number: 42, htmlUrl: 'https://github.com/acme/ra-project/issues/42', target: 'ra-project' },
      {
        triageClient: { createIssue: vi.fn(), createComment: linkBackMocks.triageCreateComment },
        owningClient: { createIssue: vi.fn(), createComment: linkBackMocks.owningCreateComment },
      },
    );
    const triageBody = linkBackMocks.triageCreateComment.mock.calls[0][0].body as string;
    const owningBody = linkBackMocks.owningCreateComment.mock.calls[0][0].body as string;
    expect(triageBody).not.toContain('[redacted]');
    expect(owningBody).not.toContain('[redacted]');
  });

  it('swallows comment failures (best-effort, never throws)', async () => {
    linkBackMocks.triageCreateComment.mockRejectedValue(new Error('network'));
    linkBackMocks.owningCreateComment.mockRejectedValue(new Error('network'));
    const { linkBackIssues } = await import('../../lib/knowledge-gap/link-back');
    await expect(
      linkBackIssues(
        5,
        { number: 42, htmlUrl: 'u', target: 'ra-project' },
        {
          triageClient: { createIssue: vi.fn(), createComment: linkBackMocks.triageCreateComment },
          owningClient: { createIssue: vi.fn(), createComment: linkBackMocks.owningCreateComment },
        },
      ),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// integration-gap recorder (#156 AC4)
// ---------------------------------------------------------------------------
describe('integration-gap.recordIntegrationGap — #156 AC4', () => {
  beforeEach(() => {
    auditMock.writeAudit.mockClear();
    auditMock.writeAudit.mockResolvedValue(undefined);
  });

  it.each(['auth', 'timeout', 'schema_mismatch', 'server_error', 'network'])(
    'records knowledge_gap_created audit for tracked kind: %s',
    async (kind) => {
      const { recordIntegrationGap } = await import('../../lib/knowledge-gap/integration-gap');
      await recordIntegrationGap({
        kind: kind as never,
        endpoint: '/sync/manifest',
        statusCode: 503,
        tenantId: 't-1',
        actorId: null,
      });
      expect(auditMock.writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'knowledge_gap_created',
          resource_type: 'integration',
          meta_json: expect.objectContaining({ source: 'integration', kind }),
        }),
      );
      auditMock.writeAudit.mockClear();
    },
  );

  it('skips audit entirely for kind=unconfigured (feature off, not a bug)', async () => {
    const { recordIntegrationGap } = await import('../../lib/knowledge-gap/integration-gap');
    await recordIntegrationGap({
      kind: 'unconfigured',
      endpoint: '/sync/manifest',
      statusCode: 503,
      tenantId: null,
      actorId: null,
    });
    expect(auditMock.writeAudit).not.toHaveBeenCalled();
  });

  it('swallows internal failures (never breaks the BFF route)', async () => {
    auditMock.writeAudit.mockRejectedValue(new Error('DB down'));
    const { recordIntegrationGap } = await import('../../lib/knowledge-gap/integration-gap');
    await expect(
      recordIntegrationGap({
        kind: 'timeout',
        endpoint: '/audit/export',
        statusCode: 504,
        tenantId: 't-1',
        actorId: null,
      }),
    ).resolves.toBeUndefined();
  });
});
