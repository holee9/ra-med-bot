/**
 * TDD tests for SPEC-V3-AUDIT-CHAIN-001 M1: computeAuditRowHash + canonicalization.
 *
 * Covers:
 * - AC-1: 64-char lowercase hex SHA-256 output
 * - AC-5b: Field-order sensitivity (REQ-AC-005 canonical order changes hash)
 * - NFR-AC-003: Determinism (same input → same hash)
 * - REQ-AC-005: meta_json stable key order via canonicalizeMetaJson
 */

import { describe, expect, it } from 'vitest';
import {
  type CanonicalAuditRow,
  GENESIS_SENTINEL,
  canonicalizeMetaJson,
  computeAuditRowHash,
} from '../hash-chain';

function baseRow(overrides: Partial<CanonicalAuditRow> = {}): CanonicalAuditRow {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    actor_id: 'actor-1',
    action: 'llm.call',
    resource_type: 'message',
    resource_id: 'msg-123',
    conversation_id: 'conv-456',
    meta_json: canonicalizeMetaJson({ test: 'data' }),
    created_at: '2026-07-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('SPEC-V3-AUDIT-CHAIN-001 M1: GENESIS_SENTINEL', () => {
  it('is the exact literal "<genesis>" (C2 / REQ-AC-003)', () => {
    expect(GENESIS_SENTINEL).toBe('<genesis>');
  });
});

describe('SPEC-V3-AUDIT-CHAIN-001 M1: computeAuditRowHash', () => {
  it('returns 64-char lowercase hex (AC-1, REQ-AC-006)', async () => {
    const hash = await computeAuditRowHash(GENESIS_SENTINEL, baseRow());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for identical input (NFR-AC-003)', async () => {
    const row = baseRow();
    const a = await computeAuditRowHash(GENESIS_SENTINEL, row);
    const b = await computeAuditRowHash(GENESIS_SENTINEL, row);
    expect(a).toBe(b);
  });

  it('changes when prevChainHash changes (forward-chain dependence)', async () => {
    const row = baseRow();
    const asGenesis = await computeAuditRowHash(GENESIS_SENTINEL, row);
    const asLink = await computeAuditRowHash(
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      row,
    );
    expect(asGenesis).not.toBe(asLink);
  });

  it('changes when a field value is swapped into a different position (AC-5b)', async () => {
    // REQ-AC-005 fixes the field order. Swapping the VALUES of actor_id and action
    // produces a different canonical serialization → different hash.
    const row1 = baseRow({ actor_id: 'actor-1', action: 'action-1' });
    const row2 = baseRow({ actor_id: 'action-1', action: 'actor-1' });
    const h1 = await computeAuditRowHash(GENESIS_SENTINEL, row1);
    const h2 = await computeAuditRowHash(GENESIS_SENTINEL, row2);
    expect(h1).not.toBe(h2);
  });
});

describe('SPEC-V3-AUDIT-CHAIN-001 M1: canonicalizeMetaJson', () => {
  it('produces identical output regardless of key insertion order (REQ-AC-005)', () => {
    const a = canonicalizeMetaJson({ z: 1, a: 2, m: 3 });
    const b = canonicalizeMetaJson({ a: 2, m: 3, z: 1 });
    expect(a).toBe(b);
  });

  it('sorts nested object keys recursively', () => {
    const a = canonicalizeMetaJson({ outer: { z: 1, a: 2 } });
    const b = canonicalizeMetaJson({ outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('preserves array order (semantically meaningful)', () => {
    const a = canonicalizeMetaJson({ list: [3, 1, 2] });
    const b = canonicalizeMetaJson({ list: [1, 2, 3] });
    expect(a).not.toBe(b);
  });

  it('makes hash stable across key-order variations (AC-5b negative case)', async () => {
    const row1 = baseRow({ meta_json: canonicalizeMetaJson({ z: 1, a: 2 }) });
    const row2 = baseRow({ meta_json: canonicalizeMetaJson({ a: 2, z: 1 }) });
    const h1 = await computeAuditRowHash(GENESIS_SENTINEL, row1);
    const h2 = await computeAuditRowHash(GENESIS_SENTINEL, row2);
    expect(h1).toBe(h2);
  });
});
