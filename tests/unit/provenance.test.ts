// @MX:NOTE [AUTO] Issue #154 — provenance write-path tests for seed-local-docs.
// @MX:SPEC SPEC-REGULA-INTEGRATION-001 (REQ-INTEGRATION-001)
//
// Verifies that seed-local-docs writes the provenance columns mandated by
// migration 0059. Uses source-text assertions (no DB / no module import) so the
// test is deterministic without a live Postgres connection or env bootstrap.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

const SEED = 'scripts/seed-local-docs.ts';

describe('seed-local-docs provenance (Issue #154, REQ-INTEGRATION-001)', () => {
  it('seed-local-docs imports the provenance columns from schema', () => {
    const src = readText(SEED);
    // The seed references the schema exports carrying provenance columns.
    expect(src).toMatch(/from ['"].*lib\/db\/schema['"]/);
  });

  it('seed-local-docs writes source-level provenance fields on the sources insert', () => {
    const src = readText(SEED);
    // Provenance fields appear in the sources insert payload.
    expect(src).toMatch(/sourceHost:\s*'local'/);
    expect(src).toMatch(/sourceOwner:\s*'internal'/);
    expect(src).toMatch(/sourceRepo:\s*basename/);
    expect(src).toMatch(/sourcePath:\s*src\.repoPath/);
    // contentHash + ingestionRunId + ingestedAt are computed variables assigned
    // before the insert (shorthand in the payload).
    expect(src).toMatch(/const contentHash = computeHash/);
    expect(src).toMatch(/ingestionRunId = randomUUID/);
    expect(src).toMatch(/ingestedAt = new Date/);
  });

  it('seed-local-docs writes section-level provenance on source_sections insert', () => {
    const src = readText(SEED);
    expect(src).toMatch(/const chunkHash = computeHash/);
    expect(src).toMatch(/const sectionPath = /);
    // All four section-level provenance fields appear in the insert payload.
    expect(src).toMatch(/chunkHash,/);
    expect(src).toMatch(/sectionPath,/);
    expect(src).toMatch(/ingestionRunId,/);
    expect(src).toMatch(/ingestedAt,/);
  });

  it('seed-local-docs gates hardcoded paths behind a dev-mode guard (no silent prod hardcode)', () => {
    const src = readText(SEED);
    // Production must refuse to run without explicit env vars.
    expect(src).toMatch(/NODE_ENV === 'development'/);
    expect(src).toMatch(/is required to seed/);
    // Env var names match the documented contract.
    expect(src).toMatch(/RA_PROJECT_PATH/);
    expect(src).toMatch(/MD_PROCESS_PATH/);
  });

  it('schema.ts defines matching provenance columns on sources + source_sections', () => {
    const schema = readText('lib/db/schema.ts');
    for (const col of [
      'sourceHost',
      'sourceOwner',
      'sourceRepo',
      'sourceBranch',
      'sourceRef',
      'sourcePath',
      'contentHash',
      'ingestionRunId',
      'ingestedAt',
    ]) {
      expect(schema).toContain(`${col}:`);
    }
    for (const col of ['chunkHash', 'sectionPath', 'ingestionRunId', 'ingestedAt']) {
      expect(schema).toContain(`${col}:`);
    }
  });
});
