/**
 * Tests for MarkdownExporter
 * SPEC-REGULA-EXPORT-HUB-001 Phase 3 (T-011, T-012, T-013, T-014)
 * REQ-EXP-002, REQ-EXP-003: Markdown export with citations and headers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownExporter } from '../exporters/markdown-exporter';
import { ExportFormat, ExportOptions } from '../types';
import { ExportError, ExportErrorCode } from '../types';

describe('MarkdownExporter', () => {
  let exporter: MarkdownExporter;

  beforeEach(() => {
    exporter = new MarkdownExporter();
  });

  describe('export - basic markdown generation', () => {
    it('should generate markdown from plain text', async () => {
      const data = {
        content: 'This is a test document',
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe(ExportFormat.MARKDOWN);
      expect(result.content).toBe('This is a test document');
      expect(result.filename).toMatch(/\.md$/);
    });

    it('should handle multi-line content', async () => {
      const data = {
        content: 'Line 1\nLine 2\nLine 3',
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should include timestamp when requested', async () => {
      const data = {
        content: 'Test content',
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        includeTimestamp: true,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should use custom filename when provided', async () => {
      const data = {
        content: 'Test content',
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        customFilename: 'custom-name',
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('custom-name.md');
    });

    it('should generate default filename when not provided', async () => {
      const data = {
        content: 'Test content',
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/export-\d{14}\.md$/); // export-YYYYMMDDHHmmss.md
    });
  });

  describe('export - citation formatting (T-012)', () => {
    it('should format single citation as markdown link', async () => {
      const data = {
        content: 'Test with citation',
        citations: [
          { text: '21 CFR 820', url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/cfrsearch.cfm?cfrpart=820' }
        ]
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        includeMetadata: true,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('[21 CFR 820](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/cfrsearch.cfm?cfrpart=820)');
    });

    it('should format multiple citations', async () => {
      const data = {
        content: 'Test with multiple citations',
        citations: [
          { text: '21 CFR 820', url: 'https://example.com/820' },
          { text: 'ISO 13485', url: 'https://example.com/iso13485' }
        ]
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        includeMetadata: true,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('[21 CFR 820](https://example.com/820)');
      expect(result.content).toContain('[ISO 13485](https://example.com/iso13485)');
    });

    it('should handle missing citation url gracefully', async () => {
      const data = {
        content: 'Test with incomplete citation',
        citations: [
          { text: 'Missing URL' }
        ]
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        includeMetadata: true,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Missing URL');
    });

    it('should handle empty citations array', async () => {
      const data = {
        content: 'Test content',
        citations: []
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        includeMetadata: true,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toBe('Test content');
    });
  });

  describe('export - section header conversion (T-013)', () => {
    it('should convert h1 to markdown #', async () => {
      const data = {
        content: '<h1>Main Title</h1>',
        html: true
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('# Main Title');
    });

    it('should convert h2 to markdown ##', async () => {
      const data = {
        content: '<h2>Subtitle</h2>',
        html: true
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('## Subtitle');
    });

    it('should convert h3 to markdown ###', async () => {
      const data = {
        content: '<h3>Section</h3>',
        html: true
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('### Section');
    });

    it('should preserve header hierarchy', async () => {
      const data = {
        content: '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>',
        html: true
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('# Title');
      expect(result.content).toContain('## Subtitle');
      expect(result.content).toContain('### Section');
    });

    it('should handle nested sections', async () => {
      const data = {
        content: '<h1>Chapter 1</h1><p>Content</p><h2>Section 1.1</h2><p>More content</p>',
        html: true
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('# Chapter 1');
      expect(result.content).toContain('## Section 1.1');
    });
  });

  describe('validate', () => {
    it('should validate correct data format', async () => {
      const data = {
        content: 'Test content',
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const isValid = await exporter.validate(data, options);

      expect(isValid).toBe(true);
    });

    it('should reject data without content', async () => {
      const data = {};
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const isValid = await exporter.validate(data, options);

      expect(isValid).toBe(false);
    });

    it('should reject invalid format', async () => {
      const data = {
        content: 'Test',
      };
      const options: ExportOptions = {
        format: ExportFormat.DOCX, // Wrong format
      };

      const isValid = await exporter.validate(data, options);

      expect(isValid).toBe(false);
    });
  });

  describe('getFormat', () => {
    it('should return MARKDOWN format', () => {
      expect(exporter.getFormat()).toBe(ExportFormat.MARKDOWN);
    });
  });

  describe('error handling', () => {
    it('should handle export errors gracefully', async () => {
      const data = null;
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return proper error code on failure', async () => {
      const data = { invalid: 'data' };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(false);
      if (result.error) {
        expect(result.error.code).toBeDefined();
      }
    });
  });

  describe('integration - combined features', () => {
    it('should handle markdown with headers and citations', async () => {
      const data = {
        content: '<h1>Regulatory Overview</h1><p>This document covers key regulations.</p>',
        citations: [
          { text: '21 CFR 820', url: 'https://example.com/820' },
          { text: 'ISO 13485', url: 'https://example.com/iso13485' }
        ],
        html: true
      };
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        includeMetadata: true,
      };

      const result = await exporter.export(data, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('# Regulatory Overview');
      expect(result.content).toContain('[21 CFR 820](https://example.com/820)');
      expect(result.content).toContain('[ISO 13485](https://example.com/iso13485)');
    });
  });
});
