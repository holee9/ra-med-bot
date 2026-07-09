// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-010, REQ-RLHF-013, REQ-RLHF-014, AC-05, AC-07)
// @MX:SPEC SPEC-REGULA-REALDB-001 (REQ-REALDB-001 — mock → real-db conversion, cer-persist pattern)
// Tier-1 dead-code defense integration test.
//
// This test proves:
//   1. REQ-RLHF-010: retrieval output CHANGES when feedback_score changes
//      (the "applyReranking defined but never called" defect class).
//   2. REQ-RLHF-014: verifyPostRerankInvariants fires on the retrieval path.
//   3. REQ-RLHF-013: recordReranking records version metadata (change_request
//      with source='rlhf').
//
// REAL-DB conversion (SPEC-REGULA-REALDB-001): fetchFeedbackScores reads
// source_sections.feedback_score from a LIVE PostgreSQL (DATABASE_URL). Instead
// of mocking db.select to return canned scores, each case INSERTs real
// source_sections rows with controlled feedback_score values, so the reranking
// LOGIC is verified against the real schema (L-013 — catches feedback_score
// column/type drift a mock hides). Skipped when DATABASE_URL is unset.

import { sourceSections, sources } from '@/lib/db/schema';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HAS_DATABASE_URL, seedCoreActors, truncateTables } from '../../tests/fixtures/database';

// Mock recordReranking so we can assert it was called (REQ-RLHF-013). Kept —
// orthogonal to schema (version-tracking metadata, not a DB SELECT under test).
vi.mock('@/lib/rlhf/version-tracker', () => ({
  recordReranking: vi.fn().mockResolvedValue({ changeRequestId: 'cr-rlhf-1' }),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Lazy import so the module is not evaluated when DATABASE_URL is unset
// (describe.skipIf still imports the file, but the route module pulls env).
async function loadRetrievalHook() {
  return await import('@/lib/rlhf/retrieval-hook');
}
const recordReranking = (await import('@/lib/rlhf/version-tracker')).recordReranking;

// Fixed uuids so makeResults is stable across cases.
const ORG_ID = '00000000-0000-0000-0000-000000000010';
const USER_ID = '11111111-1111-1111-1111-111111111110';
const PROJECT_ID = '22222222-2222-2222-2222-222222222220';
const SOURCE_ID = '33333333-3333-3333-3333-333333333330';
const SEC_HIGH = 'aaaa0001-0000-0000-0000-000000000001';
const SEC_MID = 'aaaa0002-0000-0000-0000-000000000002';
const SEC_LOW = 'aaaa0003-0000-0000-0000-000000000003';

const ACTORS = {
  orgId: ORG_ID,
  orgName: 'RLHF Test Org',
  userId: USER_ID,
  userEmail: 'rlhf@test.local',
  userName: 'RLHF Tester',
  projectId: PROJECT_ID,
  projectName: 'RLHF Test Project',
};

async function getDb() {
  const { db } = await import('@/lib/db/client');
  return db;
}

/** Insert a source_sections row with a given feedback_score (numeric string). */
async function seedSection(id: string, feedbackScore: string): Promise<void> {
  const db = await getDb();
  await db.insert(sourceSections).values({
    id,
    sourceId: SOURCE_ID,
    anchor: `anchor-${id}`,
    text: `text-${id}`,
    feedbackScore,
  });
}

/** Typed helper to manipulate the recordReranking mock without `as any`. */
const recordRerankingMock = recordReranking as unknown as {
  mockRejectedValueOnce: (e: Error) => void;
};

function makeResults() {
  return [
    { id: SEC_HIGH, sourceSectionId: SEC_HIGH, score: 0.9 },
    { id: SEC_LOW, sourceSectionId: SEC_LOW, score: 0.45 },
    { id: SEC_MID, sourceSectionId: SEC_MID, score: 0.6 },
  ];
}

describe.skipIf(!HAS_DATABASE_URL)(
  'REQ-RLHF-010 / AC-05: retrieval re-ranking wiring (Tier-1 dead-code defense) [real-db]',
  () => {
    beforeAll(async () => {
      await seedCoreActors(ACTORS);
      // One source scoped to the org; sections reference it.
      const db = await getDb();
      await db
        .insert(sources)
        .values({
          id: SOURCE_ID,
          organizationId: ORG_ID,
          orgLabel: 'RLHF Source',
          title: 'Test Source',
          type: 'Internal',
        })
        .onConflictDoNothing();
    });

    beforeEach(async () => {
      vi.clearAllMocks();
      // Isolation: clear sections only (source/org/user/project persist).
      await truncateTables(['source_sections']);
    });

    it('retrieval order is STABLE when all feedback scores are neutral (0)', async () => {
      const { applyRlhfReranking } = await loadRetrievalHook();
      await seedSection(SEC_HIGH, '0');
      await seedSection(SEC_MID, '0');
      await seedSection(SEC_LOW, '0');

      const { results } = await applyRlhfReranking(makeResults(), {
        orgId: ORG_ID,
        actorId: USER_ID,
        postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
      });

      expect(results.map((r) => r.id)).toEqual([SEC_HIGH, SEC_MID, SEC_LOW]);
    });

    it('retrieval order CHANGES when a section gets strong positive feedback', async () => {
      const { applyRlhfReranking } = await loadRetrievalHook();
      await seedSection(SEC_HIGH, '0');
      await seedSection(SEC_MID, '0');
      // sec-low gets a huge positive feedback_score; blended (0.8*0.45 +
      // 0.2*tanh(10) ≈ 0.56) beats sec-mid (0.48) and near-ties sec-high (0.72).
      await seedSection(SEC_LOW, '10');

      const { results } = await applyRlhfReranking(makeResults(), {
        orgId: ORG_ID,
        actorId: USER_ID,
        postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
      });

      const order = results.map((r) => r.id);
      expect(order.indexOf(SEC_LOW)).toBeLessThan(order.indexOf(SEC_MID));
    });

    it('REQ-RLHF-013: recordReranking is called with source=rlhf (version metadata recorded)', async () => {
      const { applyRlhfReranking } = await loadRetrievalHook();
      await seedSection(SEC_HIGH, '0');
      await seedSection(SEC_MID, '0');
      await seedSection(SEC_LOW, '0');

      await applyRlhfReranking(makeResults(), {
        orgId: ORG_ID,
        actorId: USER_ID,
        postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
      });

      expect(recordReranking).toHaveBeenCalledTimes(1);
      expect(recordReranking).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: ORG_ID,
          submittedBy: USER_ID,
          sectionCount: 3,
        }),
      );
    });

    it('REQ-RLHF-014 / AC-07: verifyPostRerankInvariants runs and flags violations', async () => {
      const { applyRlhfReranking } = await loadRetrievalHook();
      await seedSection(SEC_HIGH, '0');
      await seedSection(SEC_MID, '0');
      await seedSection(SEC_LOW, '0');

      // Low confidence + no citations + no expert review -> invariant FAILS.
      const { invariantCheck } = await applyRlhfReranking(makeResults(), {
        orgId: ORG_ID,
        actorId: USER_ID,
        postRerank: { confidenceScore: 0.3, citationCount: 0, expertReviewRequired: false },
      });

      expect(invariantCheck.passed).toBe(false);
      expect(invariantCheck.violations.length).toBeGreaterThan(0);
    });

    it('REQ-RLHF-014: invariant passes when expert review is required (safety net)', async () => {
      const { applyRlhfReranking } = await loadRetrievalHook();
      await seedSection(SEC_HIGH, '0');
      await seedSection(SEC_MID, '0');
      await seedSection(SEC_LOW, '0');

      const { invariantCheck } = await applyRlhfReranking(makeResults(), {
        orgId: ORG_ID,
        actorId: USER_ID,
        postRerank: { confidenceScore: 0.2, citationCount: 0, expertReviewRequired: true },
      });

      expect(invariantCheck.passed).toBe(true);
    });

    it('H-2: applyRlhfReranking PROPAGATES recordReranking errors (no silent swallow)', async () => {
      const { applyRlhfReranking } = await loadRetrievalHook();
      await seedSection(SEC_HIGH, '0');
      await seedSection(SEC_MID, '0');
      await seedSection(SEC_LOW, '0');
      recordRerankingMock.mockRejectedValueOnce(new Error('audit db down'));

      await expect(
        applyRlhfReranking(makeResults(), {
          orgId: ORG_ID,
          actorId: USER_ID,
          postRerank: { confidenceScore: 0.9, citationCount: 3, expertReviewRequired: false },
        }),
      ).rejects.toThrow('audit db down');
    });
  },
);

describe.skipIf(!HAS_DATABASE_URL)('fetchFeedbackScores (real-db)', () => {
  beforeAll(async () => {
    await seedCoreActors(ACTORS);
    const db = await getDb();
    await db
      .insert(sources)
      .values({
        id: SOURCE_ID,
        organizationId: ORG_ID,
        orgLabel: 'RLHF Source',
        title: 'Test Source',
        type: 'Internal',
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await truncateTables(['source_sections']);
  });

  it('returns an empty map when no section ids are supplied', async () => {
    const { fetchFeedbackScores } = await loadRetrievalHook();
    const map = await fetchFeedbackScores([]);
    expect(map).toEqual({});
  });

  it('maps section ids to their numeric feedback scores, skipping zeros', async () => {
    const { fetchFeedbackScores } = await loadRetrievalHook();
    const S1 = 'bbbb0001-0000-0000-0000-000000000001';
    const S2 = 'bbbb0002-0000-0000-0000-000000000002';
    const S3 = 'bbbb0003-0000-0000-0000-000000000003';
    await seedSection(S1, '5.5');
    await seedSection(S2, '0');
    await seedSection(S3, '-2');

    const map = await fetchFeedbackScores([S1, S2, S3]);
    // S2 (score 0) is omitted as neutral.
    expect(map).toEqual({ [S1]: 5.5, [S3]: -2 });
  });
});
