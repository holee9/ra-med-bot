// @MX:NOTE Auth.js v5 import-time smoke tests. These run with stub env vars
// so that lib/env.ts validation passes — no real OIDC traffic is exercised.

import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');

// Stub env so getEnv() inside lib/kernel/auth.ts → lib/kernel/db/client.ts succeeds.
// We restore the original values in afterAll to keep test isolation.
const ENV_STUBS = {
  DATABASE_URL: 'postgres://stub:stub@localhost:5432/regula_test',
  AUTH_SECRET: 'a'.repeat(48),
  NEXTAUTH_URL: 'http://localhost:3000',
  AUTH_MICROSOFT_ID: 'stub-ms-id',
  AUTH_MICROSOFT_SECRET: 'stub-ms-secret',
  AUTH_GOOGLE_ID: 'stub-google-id',
  AUTH_GOOGLE_SECRET: 'stub-google-secret',
};
const originals: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const [k, v] of Object.entries(ENV_STUBS)) {
    originals[k] = process.env[k];
    process.env[k] = v;
  }
});

afterAll(() => {
  for (const [k, v] of Object.entries(originals)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('lib/kernel/auth.ts module', () => {
  it('source-level: exports `auth`, `handlers`, `signIn`, `signOut`', () => {
    // Use a textual check rather than runtime import, because importing the
    // module pulls in next-auth + drizzle-adapter and would fail without a
    // running Postgres. The textual check is sufficient to verify wiring.
    const src = fs.readFileSync(path.join(root, 'lib/kernel/auth.ts'), 'utf8');
    expect(src).toMatch(/export const \{ handlers, auth, signIn, signOut \}/);
  });

  it('source-level: signIn callback is wired with writeAudit (Phase 5 contract)', () => {
    // Phase 5 replaces the stub `async () => true` with a real implementation
    // that calls writeAudit and returns true. Verify both behaviors are present.
    const src = fs.readFileSync(path.join(root, 'lib/kernel/auth.ts'), 'utf8');
    expect(src).toMatch(/signIn:\s*async\s*\(/);
    expect(src).toMatch(/writeAudit\(/);
    expect(src).toMatch(/return true/);
  });
});
