// @MX:TEST Unit tests for embed-time PII guard
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-035)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase A: batch embedding centralized in lib/ai/embedding-provider.
const { mockEmbedBatch } = vi.hoisted(() => ({ mockEmbedBatch: vi.fn() }));
vi.mock('@/lib/ai/embedding-provider', () => ({
  embedBatchTexts: mockEmbedBatch,
  getEmbeddingModelId: () => 'text-embedding-3-small',
}));

import { embedChunks } from '@/lib/ingest/embed';

describe('Embed-time PII Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedBatch.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Array(1536).fill(0.1))),
    );
  });

  describe('Enhanced PII detection', () => {
    it('should reject SSN patterns', async () => {
      const texts = ['Patient SSN: 123-45-6789'];

      await expect(embedChunks(texts)).rejects.toThrow('PII guard triggered');
    });

    it('should reject email addresses', async () => {
      const texts = ['Contact: john.doe@example.com'];

      await expect(embedChunks(texts)).rejects.toThrow('PII guard triggered');
    });

    it('should reject phone numbers', async () => {
      const texts = ['Call: (555) 123-4567'];

      await expect(embedChunks(texts)).rejects.toThrow('PII guard triggered');
    });

    it('should reject credit card numbers', async () => {
      const texts = ['Card: 4111-1111-1111-1111'];

      await expect(embedChunks(texts)).rejects.toThrow('PII guard triggered');
    });

    // #517: URL was dropped from the guard. After #318 moved embedding on-prem
    // (gx10 LAN), a URL is not an exfiltration risk, and regulatory source docs
    // are URL-heavy — the old URL guard silently rejected ~74% of the corpus.
    it('should NOT reject URLs (on-prem embedding, regulatory docs are URL-heavy)', async () => {
      const texts = ['Visit https://www.fda.gov/media/510k.pdf for FDA guidance'];

      const result = await embedChunks(texts);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1536);
    });

    it('should pass redacted text with placeholders', async () => {
      const texts = ['Patient SSN: [REDACTED:SSN] and email [REDACTED:EMAIL]'];

      const result = await embedChunks(texts);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      const firstEmbedding = result[0];
      expect(firstEmbedding).toBeDefined();
      expect(firstEmbedding?.length).toBeGreaterThan(0);
    });

    it('should pass clean text without PII patterns', async () => {
      const texts = ['Medical Device Model: MD-2024-001, Regulatory Body: FDA'];

      const result = await embedChunks(texts);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });

    it('should detect PII in batch of multiple chunks', async () => {
      const texts = ['Patient John Smith', 'SSN: 123-45-6789', 'Contact: test@example.com'];

      await expect(embedChunks(texts)).rejects.toThrow();
    });
  });

  describe('Defense-in-depth', () => {
    it('should work as final safety net after redaction pipeline', async () => {
      // Simulate redacted output from Layer 1+2
      const redactedTexts = [
        'Patient: [REDACTED:PERSON]',
        'SSN: [REDACTED:ssn]',
        'Email: [REDACTED:email]',
      ];

      const result = await embedChunks(redactedTexts);

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
    });

    it('should handle empty input', async () => {
      const result = await embedChunks([]);

      expect(result).toEqual([]);
    });
  });
});
