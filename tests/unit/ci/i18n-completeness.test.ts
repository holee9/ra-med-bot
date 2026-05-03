/**
 * i18n-completeness.test.ts — REQ-ENTERPRISE-043
 *
 * Unit tests for the key extraction and completeness-check logic.
 * The CI script (scripts/ci/i18n-completeness.ts) uses these functions.
 */

import { describe, expect, it } from 'vitest';

/** Recursively extract all leaf key paths from a nested object. */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...extractKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Returns keys present in a but missing in b. */
function missingKeys(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((k) => !setB.has(k));
}

describe('i18n key extraction (REQ-ENTERPRISE-043)', () => {
  it('should extract flat keys from a flat object', () => {
    const obj = { foo: 'bar', baz: 'qux' };
    expect(extractKeys(obj)).toEqual(['foo', 'baz']);
  });

  it('should extract nested keys with dot notation', () => {
    const obj = { a: { b: 'val', c: { d: 'deep' } } };
    expect(extractKeys(obj)).toEqual(['a.b', 'a.c.d']);
  });

  it('should detect keys missing between two sets', () => {
    const koKeys = ['common.save', 'common.cancel', 'nav.dashboard'];
    const enKeys = ['common.save', 'nav.dashboard'];
    expect(missingKeys(koKeys, enKeys)).toEqual(['common.cancel']);
  });

  it('should return empty array when all keys match', () => {
    const keys = ['a', 'b', 'c'];
    expect(missingKeys(keys, keys)).toEqual([]);
  });

  it('should detect keys in en missing from ko', () => {
    const koKeys = ['common.save'];
    const enKeys = ['common.save', 'common.extra'];
    expect(missingKeys(enKeys, koKeys)).toEqual(['common.extra']);
  });
});

describe('i18n message files structure', () => {
  // These tests verify that the actual message files have the required structure
  // They run in Node environment so we can import JSON
  it('ko.json should contain common, nav, expertReview, chat, regulatory keys', async () => {
    const ko = (await import('@/messages/ko.json')).default as Record<string, unknown>;
    expect(ko).toHaveProperty('common');
    expect(ko).toHaveProperty('nav');
    expect(ko).toHaveProperty('expertReview');
    expect(ko).toHaveProperty('chat');
    expect(ko).toHaveProperty('regulatory');
  });

  it('en.json should contain common, nav, expertReview, chat, regulatory keys', async () => {
    const en = (await import('@/messages/en.json')).default as Record<string, unknown>;
    expect(en).toHaveProperty('common');
    expect(en).toHaveProperty('nav');
    expect(en).toHaveProperty('expertReview');
    expect(en).toHaveProperty('chat');
    expect(en).toHaveProperty('regulatory');
  });

  it('ko.json and en.json should have the same top-level keys', async () => {
    const ko = (await import('@/messages/ko.json')).default as Record<string, unknown>;
    const en = (await import('@/messages/en.json')).default as Record<string, unknown>;
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });
});
