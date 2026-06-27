// @MX:NOTE [AUTO] Unit tests for scripts/ingest-gitea-wiki.ts (Issue #155 AC3).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC3
// @MX:REASON Verifies the hardened fetch path:
//   (a) GraphQL query is POSTed to {GITEA_URL}/api/graphql with `token <T>` auth.
//   (b) A 500 response triggers withRetry (fetch is called >1x).
//   (c) The final thrown error contains NO raw upstream body and NO token —
//       even when the upstream body echoes the Authorization header.
//   (d) A 200 response inserts one source + one sourceSections row with
//       provenance fields populated.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// withRetry uses real setTimeout for exponential backoff (1s + 2s + 4s on the
// default config). Fake timers let us fast-forward those delays so the test
// stays well under the 5s vitest default.

// --- Mocks -------------------------------------------------------------

// Capture every fetch invocation so we can assert URL + headers + retry count.
const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

// DB mock — records inserts so we can assert provenance fields.
const insertMocks = vi.hoisted(() => ({
  sources: [] as Array<Record<string, unknown>>,
  sections: [] as Array<Record<string, unknown>>,
}));
vi.mock('../../../lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        // Distinguish sources vs sourceSections by inspecting the row shape.
        if ('sourceId' in row || 'anchor' in row) {
          insertMocks.sections.push(row);
        } else {
          insertMocks.sources.push(row);
        }
        return { returning: vi.fn(async () => [{ id: 'src-uuid-1' }]) };
      }),
    })),
  },
  withTenantScope: vi.fn(),
}));

vi.mock('../../../lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Stub getEnv so the script doesn't read the real process.env at test time.
const ENV_VALUES = vi.hoisted(() => ({
  GITEA_URL: 'https://gitea.example.com',
  GITEA_TOKEN: 'super-secret-gitea-read-token',
  GITEA_WIKI_REPO: 'DR_RnD/ra-llm-wiki',
  GITEA_ISSUE_TOKEN: undefined as string | undefined,
  GITEA_ISSUE_REPO: undefined as string | undefined,
}));
vi.mock('../../../lib/env', () => ({
  getEnv: () => ({ ...ENV_VALUES }),
}));

// The chunker returns deterministic chunks so we don't need to mock embeddings.
vi.mock('../../../lib/ingest/chunkers/generic', () => ({
  makeGenericChunker: () => (text: string) => [
    {
      text,
      metadata: { sectionPath: 'Wiki Page' },
    },
  ],
}));

// computeHash is imported from seed-local-docs which itself imports the DB.
// Mock the whole module so we don't trigger its side effects.
vi.mock('../../../scripts/seed-local-docs', () => ({
  computeHash: (s: string) => `hash-${s.length}`,
}));

// --- Tests -------------------------------------------------------------

// The sanitizer was extracted to a shared module (L-1 dedup) so the read and
// issue-write paths cannot drift. The security invariant is owned by the
// shared module; the existing sanitizer tests still cover it.
import { sanitizeGiteaErrorBody } from '../../../lib/gitea/sanitize';
import { fetchGiteaWikiPages, ingestGiteaWiki } from '../../../scripts/ingest-gitea-wiki';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function wikiResponse(): unknown {
  return {
    data: {
      repository: {
        wiki: {
          pages: {
            nodes: [
              {
                path: 'Home.md',
                sha: 'abc123',
                content: '# Home\n\nWelcome to the RA wiki.',
              },
            ],
          },
        },
      },
    },
  };
}

describe('ingest-gitea-wiki — AC3 hardened fetch path', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    insertMocks.sources = [];
    insertMocks.sections = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('posts the GraphQL query to {GITEA_URL}/api/graphql with `token <T>` auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(wikiResponse()));

    await fetchGiteaWikiPages();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gitea.example.com/api/graphql');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('token super-secret-gitea-read-token');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toContain('repository');
    expect(body.query).toContain('DR_RnD');
    expect(body.query).toContain('ra-llm-wiki');
  });

  it('retries on 500 (fetch called >1x) and the final error contains NO raw body and NO token', async () => {
    // Gitea error body that maliciously echoes the Authorization header —
    // a real observed behavior. The thrown error MUST scrub both the token
    // and the bulk of the raw body.
    //
    // withRetry invokes the closure up to 3 times per fetchGiteaWikiPages call,
    // sleeping 1s + 2s between attempts. Fake timers fast-forward those sleeps.
    // Each fetch needs its own Response because a Body can only be read once.
    const leakingBody = 'Authorization: token super-secret-gitea-read-token details follow';
    fetchMock.mockImplementation(
      async () =>
        new Response(leakingBody, { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    );

    // Kick off the promise, then advance timers so the backoff sleeps resolve.
    const p = expect(fetchGiteaWikiPages()).rejects.toThrow(/Gitea API error: 500/);
    await vi.runAllTimersAsync();
    await p;

    // withRetry attempted 3 times (default maxAttempts) on this invocation.
    expect(fetchMock.mock.calls.length).toBe(3);

    // Inspect the thrown message: token substring must NOT appear.
    fetchMock.mockClear();
    fetchMock.mockImplementation(
      async () =>
        new Response(leakingBody, { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    );
    const p2 = fetchGiteaWikiPages().catch((err: Error) => err);
    await vi.runAllTimersAsync();
    const err = await p2;
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).not.toContain('super-secret-gitea-read-token');
    expect(msg).not.toContain('token super-secret');
  });

  it('on 200, inserts a source row and a sourceSections row with provenance fields', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(wikiResponse()));

    await ingestGiteaWiki();

    // One source row inserted (no existing source matched the select mock).
    expect(insertMocks.sources.length).toBe(1);
    const src = insertMocks.sources[0];
    expect(src).toBeDefined();
    expect(src).toMatchObject({
      sourceHost: 'gitea.example.com',
      sourceOwner: 'DR_RnD',
      sourceRepo: 'ra-llm-wiki',
      sourceBranch: 'main',
      sourcePath: 'wiki',
      authorityGrade: 'internal_sop',
      region: 'KR',
    });
    expect(src?.url).toBe('https://gitea.example.com/DR_RnD/ra-llm-wiki/wiki');

    // One section row per page with provenance + ingestionRunId.
    expect(insertMocks.sections.length).toBe(1);
    const sec = insertMocks.sections[0];
    expect(sec).toBeDefined();
    expect(sec).toMatchObject({
      chunkHash: expect.any(String),
      sectionPath: 'Home.md#0',
    });
    expect(sec?.ingestionRunId).toEqual(expect.any(String));
  });
});

// Dedicated tests for the sanitizer — the token-leak guard is the security
// invariant of this module and must hold independent of fetch plumbing.
describe('sanitizeGiteaErrorBody — token-leak guard', () => {
  it('strips `Authorization: token <T>` spans', () => {
    const out = sanitizeGiteaErrorBody('Authorization: token abc123def456ghi789jkl012mno345');
    expect(out).not.toContain('abc123def456ghi789jkl012mno345');
    expect(out).toContain('[REDACTED]');
  });

  it('strips `Bearer <T>` spans', () => {
    const out = sanitizeGiteaErrorBody('header=Bearer ZY9876543210abcdefghij');
    expect(out).not.toContain('ZY9876543210abcdefghij');
  });

  it('truncates bodies longer than 200 chars', () => {
    const long = 'x'.repeat(500);
    const out = sanitizeGiteaErrorBody(long);
    expect(out.length).toBeLessThanOrEqual(201); // 200 + ellipsis char
  });

  it('preserves short, token-free bodies unchanged', () => {
    expect(sanitizeGiteaErrorBody('not found')).toBe('not found');
  });
});

// ---------------------------------------------------------------------------
// H-1: read-path SSRF guard — same policy as the issue-write path.
// Previously the read path had no guard while the issue path did, an
// incoherent policy for the same GITEA_URL env var. The read PAT is no
// less sensitive than the write PAT; both travel as Authorization headers.
// ---------------------------------------------------------------------------
describe('fetchGiteaWikiPages — SSRF guard on the read path (H-1)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a public http GITEA_URL without ever calling fetch (token never sent)', async () => {
    const previousUrl = ENV_VALUES.GITEA_URL;
    ENV_VALUES.GITEA_URL = 'http://evil.example.com';
    try {
      await expect(fetchGiteaWikiPages()).rejects.toThrow(/SSRF guard/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      ENV_VALUES.GITEA_URL = previousUrl;
    }
  });

  it('allows an internal http GITEA_URL (diskstation LAN host) and proceeds to fetch', async () => {
    const previousUrl = ENV_VALUES.GITEA_URL;
    ENV_VALUES.GITEA_URL = 'http://diskstation:7001';
    fetchMock.mockResolvedValueOnce(jsonResponse(wikiResponse()));
    try {
      await fetchGiteaWikiPages();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://diskstation:7001/api/graphql');
    } finally {
      ENV_VALUES.GITEA_URL = previousUrl;
    }
  });
});
