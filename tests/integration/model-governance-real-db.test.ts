// @MX:NOTE [AUTO] Model Governance REAL-DB schema round-trip (SPEC-REGULA-REALDB-001 R4).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-001/002)
// @MX:REASON [AUTO] L-013: model-governance.test.ts (pure functions) and
//           model-governance-lifecycle.test.ts (mock-DB) both stub @/lib/db/client,
//           so NEITHER catches prompt_registry / change_request schema, FK, or RLS
//           drift. This focused real-DB round-trip INSERTs the model-gov FK chain
//           (prompt_registry → change_request) against a LIVE PostgreSQL and reads
//           it back, surfacing drift a mock hides. Skipped when DATABASE_URL unset.

import { changeRequest, promptRegistry } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HAS_DATABASE_URL, seedCoreActors, truncateTables } from '../../tests/fixtures/database';

const ORG_ID = '00000000-0000-0000-0000-0000000000a4';
const USER_ID = '11111111-1111-1111-1111-1111111111a4';
const PROJ_ID = '22222222-2222-2222-2222-2222222222a4';
const ACTORS = {
  orgId: ORG_ID,
  orgName: 'ModelGov Real-DB Org',
  userId: USER_ID,
  userEmail: 'modelgov-real@test.local',
  userName: 'ModelGov Real',
  projectId: PROJ_ID,
  projectName: 'ModelGov Real Project',
};

async function getDb() {
  const { db } = await import('@/lib/db/client');
  return db;
}

beforeAll(async () => {
  await seedCoreActors(ACTORS);
});

beforeEach(async () => {
  // change_request FK-references prompt_registry; truncate together (cascade
  // clears any approved_combination that references change_request).
  await truncateTables(['change_request', 'prompt_registry'], { cascade: true });
});

describe.skipIf(!HAS_DATABASE_URL)(
  'SPEC-REGULA-MODEL-GOVERNANCE-001 — real-DB schema round-trip (AC-02/07 anchor) [real-db]',
  () => {
    it('persists a prompt_registry row and reads it back (org-scoped, kind/contentHash/version)', async () => {
      const db = await getDb();
      const promptId = crypto.randomUUID();
      await db.insert(promptRegistry).values({
        id: promptId,
        orgId: ORG_ID,
        kind: 'prompt',
        contentHash: 'sha256:abc',
        content: 'You are a regulatory assistant.',
        version: 1,
        createdBy: USER_ID,
      });

      const rows = await db.select().from(promptRegistry).where(eq(promptRegistry.id, promptId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe('prompt');
      expect(rows[0]?.contentHash).toBe('sha256:abc');
      expect(rows[0]?.version).toBe(1);
      expect(rows[0]?.orgId).toBe(ORG_ID);
    });

    it('persists a change_request referencing the prompt (FK chain + eval_status default pending)', async () => {
      const db = await getDb();
      const promptId = crypto.randomUUID();
      await db.insert(promptRegistry).values({
        id: promptId,
        orgId: ORG_ID,
        kind: 'template',
        contentHash: 'sha256:def',
        content: 'template body',
        version: 1,
      });
      const crId = crypto.randomUUID();
      await db.insert(changeRequest).values({
        id: crId,
        orgId: ORG_ID,
        promptId,
        evalRunId: 'run-1',
        createdBy: USER_ID,
      });

      const rows = await db.select().from(changeRequest).where(eq(changeRequest.id, crId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.promptId).toBe(promptId); // FK chain intact
      expect(rows[0]?.evalStatus).toBe('pending'); // schema default
      expect(rows[0]?.orgId).toBe(ORG_ID);
    });
  },
);
