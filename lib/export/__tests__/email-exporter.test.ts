/**
 * EmailExporter tests
 * SPEC-REGULA-EXPORT-HUB-001 Phase 6 (T-028 through T-033)
 * REQ-EXP-007: Email export with mailto link generation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailExporter } from '../exporters/email-exporter';
import { ExportFormat, type ExportOptions } from '../types';

describe('EmailExporter', () => {
  let exporter: EmailExporter;
  let mockWindow: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    exporter = new EmailExporter();
    mockWindow = {
      open: vi.fn(),
    };
    vi.stubGlobal('window', mockWindow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getMailtoCall = (): string => {
    const mailtoCall = mockWindow.open.mock.calls[0]?.[0];
    expect(mailtoCall).toEqual(expect.stringContaining('mailto:'));
    return mailtoCall as string;
  };

  describe('T-028: Basic mailto link generation', () => {
    it('should generate mailto link with basic artifact data', async () => {
      const data = {
        title: 'Test Answer',
        content: 'Test content line 1\nTest content line 2',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
        includeMetadata: true,
      };

      await exporter.export(data, options);

      expect(mockWindow.open).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    });

    it('should get format as EMAIL', () => {
      expect(exporter.getFormat()).toBe(ExportFormat.EMAIL);
    });

    it('should validate valid data', async () => {
      const data = {
        title: 'Test',
        content: 'Content',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      const result = await exporter.validate(data, options);
      expect(result).toBe(true);
    });
  });

  describe('T-029: Email subject line formatting', () => {
    it('should format subject with artifact type and title', async () => {
      const data = {
        title: 'My Regulatory Answer',
        content: 'Content here',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      expect(mailtoCall).toMatch(/subject=Regula%20Answer%3A%20My%20Regulatory%20Answer/);
    });

    it('should handle special characters in title with URL encoding', async () => {
      const data = {
        title: 'Test & Answer <Special>',
        content: 'Content',
        artifactType: 'checklist',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      expect(mailtoCall).toMatch(/subject=/);
      // Special characters should be URL encoded
      expect(mailtoCall).not.toContain('<');
      expect(mailtoCall).not.toContain('>');
    });

    it('should URL encode subject properly', async () => {
      const data = {
        title: 'Test with spaces and spécial çhârs',
        content: 'Content',
        artifactType: 'draft',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      expect(mailtoCall).toMatch(/subject=/);
      // Spaces should be encoded as %20
      expect(mailtoCall).toContain('%20');
    });
  });

  describe('T-030: Email body formatting with artifact content', () => {
    it('should format artifact content as email body', async () => {
      const data = {
        title: 'Test Answer',
        content: 'Line 1\nLine 2\nLine 3',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      expect(mailtoCall).toMatch(/body=/);
      expect(mailtoCall).toContain('Line%201');
      expect(mailtoCall).toContain('Line%202');
      expect(mailtoCall).toContain('Line%203');
    });

    it('should include citations in readable format', async () => {
      const data = {
        title: 'Test Answer',
        content: 'Answer text with citation',
        artifactType: 'answer',
        citations: [
          { source: '21 CFR 820.30', offset: 10 },
          { source: 'EU MDR Annex IX', offset: 25 },
        ],
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
        includeMetadata: true,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      expect(mailtoCall).toMatch(/body=/);
      // Citations should be included
      expect(mailtoCall).toMatch(/21%20CFR%20820.30/);
    });

    it('should preserve paragraph structure', async () => {
      const data = {
        title: 'Test',
        content: 'Paragraph 1\n\nParagraph 2',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      // Double newline should be preserved
      expect(mailtoCall).toContain('%0A%0A');
    });

    it('should URL encode body content properly', async () => {
      const data = {
        title: 'Test',
        content: 'Content with <special> & characters',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      await exporter.export(data, options);

      const mailtoCall = getMailtoCall();
      // Special characters should be encoded
      expect(mailtoCall).not.toContain('<');
      expect(mailtoCall).not.toContain('>');
      expect(mailtoCall).toContain('%3C');
      expect(mailtoCall).toContain('%3E');
    });
  });

  describe('T-031: Attachment option limitations', () => {
    it('should document that file attachments are not supported via mailto', async () => {
      const data = {
        title: 'Test',
        content: 'Content',
        artifactType: 'answer',
        attachment: true,
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
        includeMetadata: true,
      };

      const result = await exporter.export(data, options);

      // Should return success but not actually attach file
      expect(result.success).toBe(true);
      // Should have warning about browser limitation
      expect(result.content).toMatch(/File%20attachments%20not%20supported/);
    });

    it('should suggest alternative for DOCX/PDF attachment', async () => {
      const data = {
        title: 'Test',
        content: 'Content',
        artifactType: 'answer',
        attachmentFormat: 'docx',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      // Should suggest export to DOCX first
      expect(result.content).toMatch(/Export%20to%20DOCX%20first/);
    });
  });

  describe('Error handling', () => {
    it('should return error if title is missing', async () => {
      const data = {
        content: 'Content',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      const result = await exporter.validate(data, options);
      expect(result).toBe(false);
    });

    it('should return error if content is missing', async () => {
      const data = {
        title: 'Test',
        artifactType: 'answer',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      const result = await exporter.validate(data, options);
      expect(result).toBe(false);
    });

    it('should return error if artifactType is missing', async () => {
      const data = {
        title: 'Test',
        content: 'Content',
      };

      const options: ExportOptions = {
        format: ExportFormat.EMAIL,
      };

      const result = await exporter.validate(data, options);
      expect(result).toBe(false);
    });
  });
});
