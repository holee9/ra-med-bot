// REQ-LAUNCH-038: consult route must use nodejs runtime for pgvector compatibility
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../');
const CONSULT_ROUTE = path.join(ROOT, 'app/api/ra/consult/route.ts');

describe('consult route runtime (REQ-LAUNCH-038)', () => {
  it('consult route file exists', () => {
    expect(existsSync(CONSULT_ROUTE)).toBe(true);
  });

  it('consult route declares nodejs runtime', () => {
    const content = readFileSync(CONSULT_ROUTE, 'utf-8');
    // Must have explicit nodejs runtime export to prevent edge runtime
    expect(content).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
  });
});
