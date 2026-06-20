/**
 * Unit tests for base exporter interface
 * REQ-EXP-001: Base exporter interface must be implemented
 */

import { describe, it, expect } from 'vitest';
import { BaseExporter } from '../base-exporter';
import { ExportFormat, ExportOptions, ExportResult } from '../types';

describe('BaseExporter', () => {
  it('should be defined as abstract class', () => {
    expect(BaseExporter).toBeDefined();
  });

  it('should require export method in subclass', () => {
    // This test verifies type-level constraint
    // If export method is not implemented, TypeScript will fail
    class TestExporter extends BaseExporter {
      getFormat(): ExportFormat {
        return ExportFormat.MARKDOWN;
      }

      async validate(_data: unknown, _options: ExportOptions): Promise<boolean> {
        return true;
      }

      async export(_data: unknown, _options: ExportOptions): Promise<ExportResult> {
        return {
          success: true,
          format: ExportFormat.MARKDOWN,
          content: '# Test',
          filename: 'test.md',
          size: 6,
          timestamp: new Date(),
        };
      }
    }

    const exporter = new TestExporter();
    expect(exporter.export).toBeDefined();
    expect(exporter.getFormat()).toBe(ExportFormat.MARKDOWN);
  });

  it('should require validate method in subclass', () => {
    class TestExporter extends BaseExporter {
      getFormat(): ExportFormat {
        return ExportFormat.DOCX;
      }

      async validate(_data: unknown, _options: ExportOptions): Promise<boolean> {
        return true;
      }

      async export(_data: unknown, _options: ExportOptions): Promise<ExportResult> {
        return {
          success: true,
          format: ExportFormat.DOCX,
          content: 'Test',
          filename: 'test.docx',
          size: 4,
          timestamp: new Date(),
        };
      }
    }

    const exporter = new TestExporter();
    expect(exporter.validate).toBeDefined();
    expect(exporter.getFormat()).toBe(ExportFormat.DOCX);
  });

  it('should provide createSuccessResult method', () => {
    class TestExporter extends BaseExporter {
      getFormat(): ExportFormat {
        return ExportFormat.PDF;
      }

      async validate(_data: unknown, _options: ExportOptions): Promise<boolean> {
        return true;
      }

      async export(_data: unknown, _options: ExportOptions): Promise<ExportResult> {
        return this.createSuccessResult(
          ExportFormat.PDF,
          'PDF content',
          'test.pdf'
        );
      }
    }

    const exporter = new TestExporter();
    const result = exporter.export({}, { format: ExportFormat.PDF });

    expect(result).resolves.toMatchObject({
      success: true,
      format: ExportFormat.PDF,
      content: 'PDF content',
      filename: 'test.pdf',
    });
  });

  it('should provide createErrorResult method', () => {
    class TestExporter extends BaseExporter {
      getFormat(): ExportFormat {
        return ExportFormat.MARKDOWN;
      }

      async validate(_data: unknown, _options: ExportOptions): Promise<boolean> {
        return true;
      }

      async export(_data: unknown, _options: ExportOptions): Promise<ExportResult> {
        return this.createErrorResult(
          ExportFormat.MARKDOWN,
          'GENERATION_FAILED',
          'Test error'
        );
      }
    }

    const exporter = new TestExporter();
    const result = exporter.export({}, { format: ExportFormat.MARKDOWN });

    expect(result).resolves.toMatchObject({
      success: false,
      format: ExportFormat.MARKDOWN,
      error: {
        code: 'GENERATION_FAILED',
        message: 'Test error',
      },
    });
  });

  it('should provide validateOptions method', () => {
    class TestExporter extends BaseExporter {
      getFormat(): ExportFormat {
        return ExportFormat.MARKDOWN;
      }

      async validate(_data: unknown, _options: ExportOptions): Promise<boolean> {
        this.validateOptions(_options);
        return true;
      }

      async export(_data: unknown, _options: ExportOptions): Promise<ExportResult> {
        return {
          success: true,
          format: ExportFormat.MARKDOWN,
          content: '# Test',
          filename: 'test.md',
          size: 6,
          timestamp: new Date(),
        };
      }
    }

    const exporter = new TestExporter();

    // Valid options should not throw
    expect(
      exporter.validate({}, { format: ExportFormat.MARKDOWN })
    ).resolves.toBe(true);

    // Invalid options should throw
    expect(
      exporter.validate({}, { format: undefined as any })
    ).rejects.toThrow('Export format is required');
  });
});
