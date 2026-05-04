import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

describe('DocIngest migration/schema alignment', () => {
  it('0017 renames legacy file columns instead of leaving NOT NULL drift', () => {
    const sql = readText('migrations/0017_docingest_schema_fix.sql');

    expect(sql).toMatch(/RENAME COLUMN mime_type TO file_mime_type/i);
    expect(sql).toMatch(/RENAME COLUMN r2_redacted_key TO redacted_file_r2_key/i);
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS file_mime_type/i);
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS redacted_file_r2_key/i);
  });

  it('0017 drops the old unique index before adding the corrected constraint', () => {
    const sql = readText('migrations/0017_docingest_schema_fix.sql');

    expect(sql).toMatch(/DROP INDEX IF EXISTS uq_org_docs_sha256/i);
    expect(sql).toMatch(
      /ADD CONSTRAINT uq_org_docs_sha256 UNIQUE \(org_id, file_hash_sha256\)/i,
    );
  });

  it('schema.ts auditActionEnum includes the six DocIngest audit actions', () => {
    const src = readText('lib/db/schema.ts');
    const enumSection = src.match(/export const auditActionEnum\s*=[\s\S]*?\]\);/);
    expect(enumSection, 'auditActionEnum not found').toBeTruthy();
    const body = (enumSection as RegExpMatchArray)[0];

    for (const action of [
      'document.upload',
      'document.access',
      'document.redact',
      'document.chunk',
      'document.search',
      'redaction_map.access',
    ]) {
      expect(body).toContain(`'${action}'`);
    }
  });
});
