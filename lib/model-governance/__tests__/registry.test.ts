// @MX:NOTE [AUTO] Unit tests for model-governance registry (coverage 402).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-001)

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/kernel/db/client', () => ({ db: {} }));
vi.mock('@/lib/kernel/db/schema', () => ({ promptRegistry: {} }));

import { computeContentHash } from '../registry';

describe('computeContentHash (pure — REQ-MODELGOV-001 dedup key)', () => {
  it('returns a 64-char lowercase hex SHA-256 digest', () => {
    const h = computeContentHash('hello');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same content produces the same hash', () => {
    expect(computeContentHash('prompt body v1')).toBe(computeContentHash('prompt body v1'));
  });

  it('different content produces different hashes', () => {
    expect(computeContentHash('a')).not.toBe(computeContentHash('b'));
  });

  it('matches a known SHA-256 vector', () => {
    // echo -n 'hello' | sha256sum
    expect(computeContentHash('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});
