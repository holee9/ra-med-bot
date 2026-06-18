// @MX:TEST Unit tests for 3-layer PII redaction
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-026, REQ-DOC-027, REQ-DOC-028, REQ-DOC-035)

import { describe, it, expect, beforeEach } from 'vitest';
import { redactPiiForIngest, redactRegexPii } from '@/lib/ingest/pii/redact';
import { DocClass } from '@/lib/ingest/doc-class';

describe('3-layer PII Redaction', () => {
  describe('Layer 1: Regex-based redaction', () => {
    it('should redact SSN format XXX-XX-XXXX', () => {
      const input = 'Patient SSN: 123-45-6789 and another 987-65-4321';
      const result = redactRegexPii(input);

      expect(result.text).not.toContain('123-45-6789');
      expect(result.text).not.toContain('987-65-4321');
      expect(result.redactionCount).toBe(2);
    });

    it('should redact email addresses', () => {
      const input = 'Contact: john.doe@example.com and jane@test.org';
      const result = redactRegexPii(input);

      expect(result.text).not.toContain('john.doe@example.com');
      expect(result.text).not.toContain('jane@test.org');
      expect(result.redactionCount).toBe(2);
    });

    it('should redact phone numbers', () => {
      const input = 'Call: (555) 123-4567 or +1-800-555-1234';
      const result = redactRegexPii(input);

      expect(result.text).not.toContain('(555) 123-4567');
      expect(result.text).not.toContain('+1-800-555-1234');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card: 4111-1111-1111-1111 or 4111 1111 1111 1111';
      const result = redactRegexPii(input);

      expect(result.text).not.toContain('4111-1111-1111-1111');
      expect(result.text).not.toContain('4111 1111 1111 1111');
    });

    it('should redact URLs', () => {
      const input = 'Visit https://example.com/patient-data for info';
      const result = redactRegexPii(input);

      expect(result.text).not.toContain('https://example.com/patient-data');
    });
  });

  describe('3-layer pipeline integration', () => {
    it('should apply Layer 1+2 for medium sensitivity documents', async () => {
      const input = 'Dr. John Smith (john.smith@example.com) can be reached at (555) 123-4567. SSN: 123-45-6789';

      const result = await redactPiiForIngest(input, DocClass.issued_certificate);

      expect(result.layersRun).toContain('regex');
      expect(result.layersRun).toContain('workers_ai');
      expect(result.layersRun).not.toContain('presidio'); // medium sensitivity
      expect(result.sensitivityLevel).toBe('medium');

      // Verify PII is redacted
      expect(result.text).not.toContain('john.smith@example.com');
      expect(result.text).not.toContain('(555) 123-4567');
      expect(result.text).not.toContain('123-45-6789');
    });

    it('should apply all 3 layers for critical_phi documents', async () => {
      const input = 'Patient: Jane Doe, SSN: 987-65-4321, treated at Medical Center on 2024-01-15';

      const result = await redactPiiForIngest(input, DocClass.clinical_report);

      expect(result.layersRun).toContain('regex');
      expect(result.layersRun).toContain('workers_ai');
      expect(result.layersRun).toContain('presidio'); // critical PHI
      expect(result.sensitivityLevel).toBe('critical');
    });

    it('should apply only Layer 1 for low sensitivity documents', async () => {
      const input = 'Checklist reference: sample@example.com';

      const result = await redactPiiForIngest(input, DocClass.checklist_template);

      expect(result.layersRun).toEqual(['regex']); // low sensitivity
      expect(result.layersRun).not.toContain('workers_ai');
      expect(result.layersRun).not.toContain('presidio');
      expect(result.sensitivityLevel).toBe('low');
    });
  });

  describe('Fail-closed policy', () => {
    it('should continue with Layer 1 results if Layer 2 fails', async () => {
      const input = 'SSN: 123-45-6789, Email: test@example.com';

      // Mock Workers AI failure
      const originalWorkersAi = process.env.CF_WORKERS_AI_TOKEN;
      process.env.CF_WORKERS_AI_TOKEN = '';

      try {
        const result = await redactPiiForIngest(input, DocClass.submission_success);

        // Should still have Layer 1 results
        expect(result.layersRun).toContain('regex');
        expect(result.text).not.toContain('123-45-6789');
        expect(result.text).not.toContain('test@example.com');
      } finally {
        process.env.CF_WORKERS_AI_TOKEN = originalWorkersAi;
      }
    });

    it('should handle empty text gracefully', async () => {
      const result = await redactPiiForIngest('', DocClass.issued_certificate);

      expect(result.text).toBe('');
      expect(result.redactionCount).toBe(0);
      expect(result.layersRun).toEqual(['regex', 'workers_ai']);
    });
  });

  describe('Redaction map requirements', () => {
    it('should track all redacted entities count', async () => {
      const input = 'Contact: john@example.com, Phone: (555) 123-4567, SSN: 123-45-6789';

      const result = await redactPiiForIngest(input, DocClass.issued_certificate);

      expect(result.redactionCount).toBeGreaterThan(0);
      expect(result.layersRun.length).toBeGreaterThan(0);
    });

    it('should preserve non-PII text', async () => {
      const input = 'Medical Device Model ABC, Manufacturer: Acme Corporation';

      const result = await redactPiiForIngest(input, DocClass.issued_certificate);

      expect(result.text).toContain('ABC');
      expect(result.text).toContain('Acme Corporation');
    });
  });
});
