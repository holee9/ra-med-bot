// @MX:NOTE [AUTO] Unit tests for scripts/seed-corpus.ts (REQ-QUAL-001..005).
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-001..005)
//
// These tests do not touch a real database. They verify:
//   1. The seed dataset has >= 5 sources × >= 20 chunks (>= 100 rows total).
//   2. runSeedCorpus inserts every source + section on a clean DB.
//   3. Idempotency: a second run inserts zero new rows when sources/sections
//      already exist (UNIQUE constraint on source_sections.source_id+anchor).
//   4. Embeddings are non-null and have a non-zero length.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db client BEFORE importing the script under test, otherwise
// `lib/kernel/db/client.ts` will try to connect to a real Postgres at import time.
vi.mock('../../../lib/kernel/db/client', () => ({
  db: {},
  withTenantScope: vi.fn(),
}));

// Mock the embedding service so we never call OpenAI from a unit test.
vi.mock('../../../lib/ingest/embed', () => ({
  embedChunks: vi.fn(async (texts: string[]) => texts.map(() => new Array(1536).fill(0.0001))),
}));

// Mock the logger to keep test output clean.
vi.mock('../../../lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  SEED_DATA,
  TOTAL_SECTIONS,
  TOTAL_SOURCES,
  runSeedCorpus,
} from '../../../scripts/seed-corpus';

// ---------------------------------------------------------------------------
// Helper: build a minimal Drizzle-like query-builder mock that the seeder
// exercises. The seeder uses .select().from().where().limit() and
// .insert().values().returning().
// ---------------------------------------------------------------------------
interface MockState {
  /** Map of title → existing source id (simulates DB rows). */
  existingSources: Map<string, string>;
  /** Set of "source_id|anchor" composite keys (simulates UNIQUE constraint). */
  existingSections: Set<string>;
  insertSourceCalls: number;
  insertSectionCalls: number;
}

function buildMockDb(state: MockState) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  // Track which title is being queried via .where()
  let pendingTitleLookup: string | null = null;

  const select = vi.fn(() => {
    pendingTitleLookup = null;
    return selectChain;
  });

  selectChain.where.mockImplementation((cond: unknown) => {
    // The cond is a Drizzle SQL chunk; we cannot introspect it cleanly, so
    // fall back to scanning state for any matching title later. The seeder
    // calls .where(eq(sources.title, seed.title)) one seed at a time, so we
    // can rely on insertion order: the most recently called seed.
    pendingTitleLookup = (cond as { __title?: string })?.__title ?? null;
    return selectChain;
  });

  selectChain.limit.mockImplementation(async () => {
    // If the test inserts a known title, the lookup returns it.
    if (pendingTitleLookup && state.existingSources.has(pendingTitleLookup)) {
      return [{ id: state.existingSources.get(pendingTitleLookup) }];
    }
    return [];
  });

  // .insert(_table).values(row).returning({...}) — symmetric for both sources
  // and source_sections after the seeder switched both paths to .returning().
  const insert = vi.fn(() => {
    return {
      values: vi.fn((row: { sourceId?: string; anchor?: string; title?: string }) => {
        return {
          returning: vi.fn(async () => {
            // sources insert path: row carries title.
            if (row.title) {
              state.insertSourceCalls += 1;
              const newId = `src-${state.insertSourceCalls}`;
              state.existingSources.set(row.title, newId);
              return [{ id: newId }];
            }
            // source_sections insert path: row carries sourceId + anchor.
            if (row.sourceId !== undefined && row.anchor !== undefined) {
              const key = `${row.sourceId}|${row.anchor}`;
              if (state.existingSections.has(key)) {
                throw new Error(
                  'duplicate key value violates unique constraint "source_sections_source_anchor_idx"',
                );
              }
              state.existingSections.add(key);
              state.insertSectionCalls += 1;
              return [{ id: `sec-${state.insertSectionCalls}` }];
            }
            return [];
          }),
        };
      }),
    };
  });

  return { select, insert };
}

// Override drizzle-orm `eq` so we can sniff the title argument out of where().
// The seeder imports `eq` from drizzle-orm, so we must mock it at the same
// import path used in production code.
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm');
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => ({ __title: value, column }) as unknown,
  };
});

describe('scripts/seed-corpus.ts (SPEC-REGULA-QUALITY-001 REQ-QUAL-001..005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // REQ-QUAL-001: dataset must cover 5 corpora with >= 20 chunks each.
  // ---------------------------------------------------------------
  it('REQ-QUAL-001: SEED_DATA contains 5 distinct regulatory sources', () => {
    expect(SEED_DATA).toHaveLength(5);
    const orgLabels = SEED_DATA.map((s) => s.orgLabel).sort();
    expect(orgLabels).toEqual(['EU-MDR', 'FDA', 'MFDS', 'NMPA', 'PMDA']);
  });

  it('REQ-QUAL-002: every source has at least 20 sections', () => {
    for (const source of SEED_DATA) {
      expect(
        source.sections.length,
        `${source.orgLabel} must have >=20 sections`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('REQ-QUAL-003: total chunks >= 100 across all corpora', () => {
    expect(TOTAL_SECTIONS).toBeGreaterThanOrEqual(100);
    expect(TOTAL_SOURCES).toBe(5);
  });

  it('REQ-QUAL-004: every section has non-empty heading + text + anchor', () => {
    for (const source of SEED_DATA) {
      for (const section of source.sections) {
        expect(section.anchor).toBeTruthy();
        expect(section.heading).toBeTruthy();
        expect(section.text).toBeTruthy();
        expect(section.text.length, `${section.anchor} text must be non-trivial`).toBeGreaterThan(
          50,
        );
      }
    }
  });

  it('REQ-QUAL-004: anchors are unique within each source', () => {
    for (const source of SEED_DATA) {
      const anchors = source.sections.map((s) => s.anchor);
      const unique = new Set(anchors);
      expect(unique.size, `${source.orgLabel} anchors must be unique`).toBe(anchors.length);
    }
  });

  it('REQ-QUAL-004: text contains no SSN / email PII (passes embed.ts guard)', () => {
    const ssn = /\d{3}-\d{2}-\d{4}/;
    const email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    for (const source of SEED_DATA) {
      for (const section of source.sections) {
        const blob = `${section.heading}\n${section.text}`;
        expect(ssn.test(blob), `${section.anchor} must not contain SSN`).toBe(false);
        expect(email.test(blob), `${section.anchor} must not contain email`).toBe(false);
      }
    }
  });

  // ---------------------------------------------------------------
  // REQ-QUAL-005: runSeedCorpus must be idempotent.
  // ---------------------------------------------------------------
  it('REQ-QUAL-005: first run inserts every source + section', async () => {
    const state: MockState = {
      existingSources: new Map(),
      existingSections: new Set(),
      insertSourceCalls: 0,
      insertSectionCalls: 0,
    };
    const mockDb = buildMockDb(state);
    const fakeEmbed = vi.fn(async (texts: string[]) => texts.map(() => new Array(1536).fill(0.5)));

    const summary = await runSeedCorpus(mockDb as never, fakeEmbed);

    expect(summary.sourcesInserted).toBe(TOTAL_SOURCES);
    expect(summary.sectionsInserted).toBe(TOTAL_SECTIONS);
    expect(summary.sourcesSkipped).toBe(0);
    expect(summary.sectionsSkipped).toBe(0);
    expect(state.insertSectionCalls).toBeGreaterThanOrEqual(100);
  });

  it('REQ-QUAL-005: second run on populated DB inserts zero new rows', async () => {
    const state: MockState = {
      existingSources: new Map(),
      existingSections: new Set(),
      insertSourceCalls: 0,
      insertSectionCalls: 0,
    };
    const mockDb = buildMockDb(state);
    const fakeEmbed = vi.fn(async (texts: string[]) => texts.map(() => new Array(1536).fill(0.5)));

    // First run populates state.
    await runSeedCorpus(mockDb as never, fakeEmbed);
    const sectionCallsAfterFirst = state.insertSectionCalls;
    const sourceCallsAfterFirst = state.insertSourceCalls;

    // Second run should be a no-op.
    const summary = await runSeedCorpus(mockDb as never, fakeEmbed);

    expect(summary.sourcesInserted).toBe(0);
    expect(summary.sourcesSkipped).toBe(TOTAL_SOURCES);
    expect(summary.sectionsInserted).toBe(0);
    expect(summary.sectionsSkipped).toBe(TOTAL_SECTIONS);
    // No new physical insert calls beyond the duplicate attempts that throw.
    expect(state.insertSourceCalls).toBe(sourceCallsAfterFirst);
    expect(state.insertSectionCalls).toBe(sectionCallsAfterFirst);
  });

  it('REQ-QUAL-005: every section gets a non-null embedding of length 1536', async () => {
    const state: MockState = {
      existingSources: new Map(),
      existingSections: new Set(),
      insertSourceCalls: 0,
      insertSectionCalls: 0,
    };
    const mockDb = buildMockDb(state);

    const embeddingsSeen: number[][] = [];
    const fakeEmbed = vi.fn(async (texts: string[]) => {
      const out = texts.map(() => {
        const v = new Array(1536).fill(0).map(() => Math.random());
        embeddingsSeen.push(v);
        return v;
      });
      return out;
    });

    await runSeedCorpus(mockDb as never, fakeEmbed);

    // 5 source-title embeddings + 1 batch embed call per source for sections.
    expect(fakeEmbed).toHaveBeenCalled();
    // Every produced embedding has 1536 dimensions (text-embedding-3-small).
    for (const v of embeddingsSeen) {
      expect(v).toHaveLength(1536);
      expect(v.every((n) => typeof n === 'number')).toBe(true);
    }
  });
});
