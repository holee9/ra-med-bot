// @MX:TEST Unit tests for embed-time PII guard
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-035)

import { describe, it, expect, beforeEach } from 'vitest';
import { embedChunks } from '@/lib/ingest/embed';

describe('Embed-time PII Guard', () => {
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

    it('should reject URLs', async () => {
      const texts = ['Visit https://example.com/patient-data'];

      await expect(embedChunks(texts)).rejects.toThrow('PII guard triggered');
    });

    it('should pass redacted text with placeholders', async () => {
      const texts = ['Patient SSN: [REDACTED:SSN] and email [REDACTED:EMAIL]'];

      const result = await embedChunks(texts);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].length).toBeGreaterThan(0);
    });

    it('should pass clean text without PII patterns', async () => {
      const texts = ['Medical Device Model: MD-2024-001, Regulatory Body: FDA'];

      const result = await embedChunks(texts);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });

    it('should detect PII in batch of multiple chunks', async () => {
      const texts = [
        'Patient John Smith',
        'SSN: 123-45-6789',
        'Contact: test@example.com',
      ];

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
