// @MX:NOTE [AUTO] LlmWikiRetriever tests — llm-wiki 지식 계층 ② 연결 (2026-10-28).
// Verifies: org/env/seed gates, catalog cache build (shard tolerance), keyword
// scoring, best-section extraction, 출처 포인터 mapping, and graceful [] on failure.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbSelect = vi.fn();

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@/lib/kernel/db/schema', () => ({
  sources: { id: 'id', org_label: 'org_label' },
}));

import type { LlmWikiRetriever as LlmWikiRetrieverT } from '@/lib/ai/retrievers/llm-wiki';

/**
 * Fresh module per test — vi.resetModules() only affects dynamic imports, and
 * the module memoizes the seeded-source lookup: a static import would carry a
 * poisoned `null` cache from the not-seeded test into every later test.
 */
async function freshRetriever(): Promise<LlmWikiRetrieverT> {
  const { LlmWikiRetriever } = await import('@/lib/ai/retrievers/llm-wiki');
  return new LlmWikiRetriever();
}

const ORG = '10000000-0000-4000-8000-000000000001';
const WIKI_SOURCE = '533b32b5-b8f6-4851-837e-c02ee8a0f1c9';
const SHA = 'f1d939a0ceb9951019464f3974c9b219e87a4e93';

function fakeDbChain() {
  return {
    from: () => ({
      where: () => ({
        limit: async () => [{ id: WIKI_SOURCE }],
      }),
    }),
  };
}

const ENTRY_510K = {
  path: 'wiki/concepts/fda-510k-submission.md',
  type: 'concept',
  title: 'FDA 510(k) Submission Requirements',
  summary: '510(k) submission documentation requirements overview',
  tags: ['fda', '510k'],
  aliases: ['premarket notification'],
  updated: '2026-10-01',
};
const ENTRY_DHF = {
  path: 'wiki/concepts/dhf.md',
  type: 'concept',
  title: 'Design History File',
  summary: 'DHF composition and device master record',
  tags: ['dhf', 'quality'],
  updated: '2026-09-01',
};

function b64(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64');
}

type Fixture = string | unknown[] | Record<string, unknown> | Error;

function giteaRouter(urls: Record<string, Fixture>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [prefix, payload] of Object.entries(urls)) {
      if (url.includes(prefix)) {
        if (payload instanceof Error) return Promise.reject(payload);
        // Raw endpoints (/raw/) serve plain text — wrapping them in JSON.stringify
        // would double-encode the JSONL body. Object fixtures stay JSON.
        if (typeof payload === 'string') return new Response(payload, { status: 200 });
        return new Response(JSON.stringify(payload), { status: 200 });
      }
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}

function catalogFixtures(): Record<string, Fixture> {
  return {
    '/git/refs/heads/main': [{ object: { sha: SHA } }],
    '/contents/wiki/indexes/agent?': [
      { type: 'file', path: 'wiki/indexes/agent/concept-001.jsonl' },
      { type: 'dir', path: 'wiki/indexes/agent/other' },
    ],
    '/raw/wiki/indexes/agent/concept-001.jsonl': `${JSON.stringify(ENTRY_510K)}\n${JSON.stringify(ENTRY_DHF)}\n`,
    [`/contents/${ENTRY_510K.path}?`]: {
      content: b64(
        `---\ntype: concept\ntitle: "FDA 510(k)"\nsources: [RA/20_FDA Guidance/Guidance-510k-eSubmission.pdf]\n---\n\n# Overview\n\nsubmission overview section\n\n# Requirements\n\n510k submission documentation requirements detail section\n`,
      ),
      encoding: 'base64',
    },
    [`/contents/${ENTRY_DHF.path}?`]: {
      content: b64('---\ntype: concept\n---\n\n# DHF\n\nno source frontmatter body'),
      encoding: 'base64',
    },
  };
}

describe('LlmWikiRetriever (llm-wiki 지식 계층)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockDbSelect.mockReset();
    mockDbSelect.mockImplementation(fakeDbChain);
    process.env.GITEA_URL = 'http://gitea.test';
    process.env.GITEA_TOKEN = 'test-token';
    // Isolated cache — the repo's real var/llm-wiki cache would shadow the mocks.
    process.env.LLM_WIKI_CACHE_PATH = `/tmp/llm-wiki-test-${Math.random().toString(36).slice(2)}/cache.json`;
  });

  it('returns [] without orgId (unscoped retrieval banned)', async () => {
    globalThis.fetch = vi.fn();
    expect(await (await freshRetriever()).retrieve('510k', {})).toEqual([]);
  });

  it('returns [] when Gitea env is not configured', async () => {
    process.env.GITEA_URL = '';
    globalThis.fetch = vi.fn();
    expect(await (await freshRetriever()).retrieve('510k', { orgId: ORG })).toEqual([]);
  });

  it('returns [] when the proxy source row is not seeded', async () => {
    mockDbSelect.mockImplementation(() => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }));
    globalThis.fetch = vi.fn();
    expect(await (await freshRetriever()).retrieve('510k', { orgId: ORG })).toEqual([]);
  });

  it('maps hits with wiki metadata + 출처 포인터 from frontmatter sources', async () => {
    globalThis.fetch = giteaRouter(catalogFixtures());
    const res = await (await freshRetriever()).retrieve('510k submission requirements', {
      orgId: ORG,
    });
    expect(res.length).toBeGreaterThan(0);
    const top = res[0];
    if (!top) throw new Error('no result');
    expect(top.sourceId).toBe(WIKI_SOURCE);
    expect(top.id).toMatch(/^wiki-f1d939a0-/);
    expect(top.metadata.orgLabel).toBe('llm-wiki');
    expect(top.metadata.wikiPath).toBe(ENTRY_510K.path);
    expect(top.metadata.sourcePath).toBe('RA/20_FDA Guidance/Guidance-510k-eSubmission.pdf');
    expect(top.score).toBeLessThanOrEqual(0.9); // 종합 계층 상한
    // best-section: Requirements section wins over Overview
    expect(top.content).toContain('documentation requirements detail section');
  });

  it('falls back to entry path as 출처 포인터 for source-type entries without frontmatter', async () => {
    const entry = { ...ENTRY_DHF, type: 'source' };
    const urls = catalogFixtures();
    urls['/raw/wiki/indexes/agent/concept-001.jsonl'] = `${JSON.stringify(entry)}\n`;
    globalThis.fetch = giteaRouter(urls);
    const res = await (await freshRetriever()).retrieve('design history file', { orgId: ORG });
    expect(res[0]?.metadata.sourcePath).toBe(entry.path);
  });

  it('keeps scoring below threshold out (irrelevant query)', async () => {
    globalThis.fetch = giteaRouter(catalogFixtures());
    const res = await (await freshRetriever()).retrieve('점심 메뉴 추천', { orgId: ORG });
    expect(res).toEqual([]);
  });

  it('returns [] when the catalog is unreachable (NAS still answers)', async () => {
    globalThis.fetch = giteaRouter({ '/git/refs/heads/main': new Error('timeout') });
    const res = await (await freshRetriever()).retrieve('510k submission', { orgId: ORG });
    expect(res).toEqual([]);
  });

  it('tolerates a minority of unreachable shards (partial catalog beats none)', async () => {
    const urls = catalogFixtures();
    // Two shards: one reachable, one dead → 1/2 is NOT a majority → catalog survives.
    urls['/contents/wiki/indexes/agent?'] = [
      { type: 'file', path: 'wiki/indexes/agent/concept-001.jsonl' },
      { type: 'file', path: 'wiki/indexes/agent/concept-002.jsonl' },
    ];
    urls['/raw/wiki/indexes/agent/concept-002.jsonl'] = new Error('timeout');
    globalThis.fetch = giteaRouter(urls);
    const res = await (await freshRetriever()).retrieve('510k submission requirements', {
      orgId: ORG,
    });
    expect(res.length).toBeGreaterThan(0);
  });

  it('treats majority-unreachable shards as a broken index', async () => {
    const urls = catalogFixtures();
    urls['/contents/wiki/indexes/agent?'] = [
      { type: 'file', path: 'wiki/indexes/agent/concept-001.jsonl' },
      { type: 'file', path: 'wiki/indexes/agent/concept-002.jsonl' },
      { type: 'file', path: 'wiki/indexes/agent/concept-003.jsonl' },
    ];
    urls['/raw/wiki/indexes/agent/concept-002.jsonl'] = new Error('timeout');
    urls['/raw/wiki/indexes/agent/concept-003.jsonl'] = new Error('timeout');
    globalThis.fetch = giteaRouter(urls);
    const res = await (await freshRetriever()).retrieve('510k submission requirements', {
      orgId: ORG,
    });
    expect(res).toEqual([]);
  });
});
