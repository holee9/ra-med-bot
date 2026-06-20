/**
 * TDD RED: Tests for computeAnswerHash — SHA-256 hash of answer content.
 * REQ-ESIG-002: Signature/record linkage via cryptographic hash (21 CFR Part 11 §11.70)
 */

import { describe, expect, it } from 'vitest';
import { computeAnswerHash } from '../hash';

describe('computeAnswerHash', () => {
  it('returns a hex string of 64 characters (SHA-256)', async () => {
    const hash = await computeAnswerHash('hello world', []);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same hash', async () => {
    const prose = 'Regulatory answer text';
    const blocks = [{ id: 'b1', content: 'block content', type: 'prose' }];

    const hash1 = await computeAnswerHash(prose, blocks);
    const hash2 = await computeAnswerHash(prose, blocks);

    expect(hash1).toBe(hash2);
  });

  it('different content_prose produces different hash', async () => {
    const blocks = [{ id: 'b1', content: 'same block', type: 'prose' }];

    const hash1 = await computeAnswerHash('answer A', blocks);
    const hash2 = await computeAnswerHash('answer B', blocks);

    expect(hash1).not.toBe(hash2);
  });

  it('block ORDER matters — canonicalization preserves sequence', async () => {
    const prose = 'Same prose';
    const block1 = { id: 'b1', content: 'first block', type: 'prose' };
    const block2 = { id: 'b2', content: 'second block', type: 'checklist' };

    const hashOrdered = await computeAnswerHash(prose, [block1, block2]);
    const hashReversed = await computeAnswerHash(prose, [block2, block1]);

    expect(hashOrdered).not.toBe(hashReversed);
  });

  it('empty blocks is valid — hashes prose-only content', async () => {
    const hash = await computeAnswerHash('prose only', []);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different block content produces different hash', async () => {
    const prose = 'Same prose';
    const hash1 = await computeAnswerHash(prose, [{ id: 'b1', content: 'X', type: 'prose' }]);
    const hash2 = await computeAnswerHash(prose, [{ id: 'b1', content: 'Y', type: 'prose' }]);

    expect(hash1).not.toBe(hash2);
  });

  it('encodes as lowercase hex string (not base64 or uppercase)', async () => {
    const hash = await computeAnswerHash('test', []);
    // Must be all lowercase hex — no uppercase letters, no +, /, = (base64 chars)
    expect(hash).not.toMatch(/[A-Z+/=]/);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
