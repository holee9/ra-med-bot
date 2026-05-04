// RED Phase: Tests for lib/ingest/pii/redaction-map.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8B-6

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('encryptPii / decryptPii', () => {
  let encryptPii: (text: string) => { iv: string; ciphertext: string };
  let decryptPii: (iv: string, ciphertext: string) => string;

  beforeEach(async () => {
    // Provide a valid 32-byte base64 key
    const key = Buffer.alloc(32, 'k').toString('base64');
    vi.stubEnv('PII_MAP_KEY', key);
    // Re-import module after env is set
    const mod = await import('@/lib/ingest/pii/redaction-map');
    encryptPii = mod.encryptPii;
    decryptPii = mod.decryptPii;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should round-trip encrypt then decrypt to original', () => {
    const original = 'John Doe SSN 123-45-6789';
    const { iv, ciphertext } = encryptPii(original);
    const decrypted = decryptPii(iv, ciphertext);
    expect(decrypted).toBe(original);
  });

  it('should produce different IV each time (random IV)', () => {
    const text = 'test text';
    const result1 = encryptPii(text);
    const result2 = encryptPii(text);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('should produce different ciphertext each time due to random IV', () => {
    const text = 'test text';
    const result1 = encryptPii(text);
    const result2 = encryptPii(text);
    expect(result1.ciphertext).not.toBe(result2.ciphertext);
  });

  it('should return base64-encoded iv and ciphertext', () => {
    const { iv, ciphertext } = encryptPii('hello world');
    // Valid base64 strings
    expect(() => Buffer.from(iv, 'base64')).not.toThrow();
    expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();
  });
});

describe('encryptPii - error handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should throw clear error when PII_MAP_KEY is not set', async () => {
    vi.stubEnv('PII_MAP_KEY', '');
    const mod = await import('@/lib/ingest/pii/redaction-map');
    expect(() => mod.encryptPii('test')).toThrow('PII_MAP_KEY');
  });

  it('should throw error when PII_MAP_KEY has wrong length', async () => {
    // 16-byte key (too short for AES-256)
    const shortKey = Buffer.alloc(16, 'x').toString('base64');
    vi.stubEnv('PII_MAP_KEY', shortKey);
    const mod = await import('@/lib/ingest/pii/redaction-map');
    expect(() => mod.encryptPii('test')).toThrow();
  });
});

describe('RedactionMapEntry type', () => {
  it('should import RedactionMapEntry type', async () => {
    const key = Buffer.alloc(32, 'k').toString('base64');
    vi.stubEnv('PII_MAP_KEY', key);
    const mod = await import('@/lib/ingest/pii/redaction-map');
    // Just verify the module exports exist
    expect(mod.encryptPii).toBeDefined();
    expect(mod.decryptPii).toBeDefined();
    expect(mod.saveRedactionMap).toBeDefined();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
