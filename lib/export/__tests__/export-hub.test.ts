/**
 * ExportHub tests
 * SPEC-REGULA-EXPORT-HUB-001 Phase 5 (T-027)
 * REQ-EXP-006: ExportHub integration with PDF exporter
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportHub } from '../export-hub';
import { ExportFormat, ExportOptions } from '../types';
import { PDFExporter } from '../exporters/pdf-exporter';

/**
 * @vitest-environment jsdom
 */

// Mock @react-pdf/renderer globally for all tests
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => ({ type: 'text', content: children }),
  View: ({ children }: any) => ({ type: 'view', children }),
  Font: { register: vi.fn() },
  pdf: () => ({
    toBlob: async () => ({
      arrayBuffer: async () => new ArrayBuffer(1024),
    }),
  }),
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

describe('ExportHub', () => {
  let hub: ExportHub;
  let mockOptions: ExportOptions;

  beforeEach(() => {
    hub = new ExportHub();
    mockOptions = {
      format: ExportFormat.PDF,
      includeMetadata: true,
      includeTimestamp: true,
    };
  });

  describe('exporter registration', () => {
    it('should register PDF exporter by default', () => {
      const pdfExporter = hub.getExporter(ExportFormat.PDF);
      expect(pdfExporter).toBeDefined();
      expect(pdfExporter).toBeInstanceOf(PDFExporter);
    });

    it('should register at least Markdown and PDF exporters', () => {
      const formats = hub.getSupportedFormats();
      expect(formats).toContain(ExportFormat.PDF);
      expect(formats).toContain(ExportFormat.MARKDOWN);
      expect(formats.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow custom exporter registration', () => {
      const customExporter = new PDFExporter();
      hub.register(customExporter);

      const registered = hub.getExporter(ExportFormat.PDF);
      expect(registered).toBeDefined();
    });
  });

  describe('format support', () => {
    it('should support PDF format', () => {
      expect(hub.isFormatSupported(ExportFormat.PDF)).toBe(true);
    });

    it('should return false for unsupported format', () => {
      expect(hub.isFormatSupported('UNSUPPORTED' as ExportFormat)).toBe(false);
    });

    it('should list all supported formats', () => {
      const formats = hub.getSupportedFormats();
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain(ExportFormat.PDF);
    });
  });

  describe('export integration', () => {
    it('should export data using PDF exporter', async () => {
      const data = {
        content: 'Test content for hub export',
        title: 'Hub Test',
      };

      const result = await hub.export(data, mockOptions);

      expect(result.success).toBe(true);
      expect(result.format).toBe(ExportFormat.PDF);
      expect(result.content).toBeDefined();
    });

    it('should return error for unsupported format', async () => {
      const unsupportedOptions = {
        ...mockOptions,
        format: 'UNSUPPORTED' as ExportFormat,
      };

      const result = await hub.export({ content: 'Test' }, unsupportedOptions);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FORMAT');
    });

    it('should export to Markdown format', async () => {
      const markdownOptions = {
        ...mockOptions,
        format: ExportFormat.MARKDOWN,
      };

      const data = {
        content: '# Test Markdown',
      };

      const result = await hub.export(data, markdownOptions);

      expect(result.success).toBe(true);
      expect(result.format).toBe(ExportFormat.MARKDOWN);
    });

    it('should export to DOCX format if available', async () => {
      const docxOptions = {
        ...mockOptions,
        format: ExportFormat.DOCX,
      };

      const data = {
        content: 'Test DOCX content',
      };

      const result = await hub.export(data, docxOptions);

      // DOCX might not be available if 'docx' package is missing
      if (hub.isFormatSupported(ExportFormat.DOCX)) {
        expect(result.success).toBe(true);
        expect(result.format).toBe(ExportFormat.DOCX);
      } else {
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_FORMAT');
      }
    });

    it('should use custom filename in export', async () => {
      const customOptions = {
        ...mockOptions,
        customFilename: 'hub-test-export',
      };

      const data = {
        content: 'Test content',
        title: 'Test',
      };

      const result = await hub.export(data, customOptions);

      // Debug: print result if failed
      if (!result.success) {
        console.log('Export failed:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.filename).toBe('hub-test-export.pdf');
    });
  });

  describe('default export hub', () => {
    it('should provide default hub instance', async () => {
      const { defaultExportHub } = await import('../export-hub');

      expect(defaultExportHub).toBeDefined();
      expect(defaultExportHub instanceof ExportHub).toBe(true);
    });

    it('should export using default hub', async () => {
      const { defaultExportHub } = await import('../export-hub');

      const data = {
        content: 'Test via default hub',
        title: 'Default Hub Test',
      };

      const result = await defaultExportHub.export(data, mockOptions);

      expect(result.success).toBe(true);
      expect(result.format).toBe(ExportFormat.PDF);
    });
  });

  describe('exporter retrieval', () => {
    it('should return PDF exporter instance', () => {
      const exporter = hub.getExporter(ExportFormat.PDF);
      expect(exporter).toBeInstanceOf(PDFExporter);
      expect(exporter?.getFormat()).toBe(ExportFormat.PDF);
    });

    it('should return undefined for unregistered format', () => {
      const exporter = hub.getExporter('UNSUPPORTED' as ExportFormat);
      expect(exporter).toBeUndefined();
    });
  });
});
