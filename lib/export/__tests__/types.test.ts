/**
 * Unit tests for export types and interfaces
 * REQ-EXP-001: Export type system must support multiple formats
 */

import { describe, it, expect } from 'vitest';
import {
  ExportFormat,
  ExportResult,
  ExportOptions,
  ExportError,
  ExportErrorCode
} from '../types';

describe('ExportFormat', () => {
  it('should have all required format values', () => {
    expect(ExportFormat.MARKDOWN).toBe('markdown');
    expect(ExportFormat.DOCX).toBe('docx');
    expect(ExportFormat.PDF).toBe('pdf');
  });

  it('should have at least 3 formats supported', () => {
    const formats = Object.values(ExportFormat);
    expect(formats.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ExportResult', () => {
  it('should create successful export result', () => {
    const result: ExportResult = {
      success: true,
      format: ExportFormat.MARKDOWN,
      content: '# Test Content',
      filename: 'test.md',
      size: 15,
      timestamp: new Date('2024-01-01T00:00:00Z')
    };

    expect(result.success).toBe(true);
    expect(result.format).toBe(ExportFormat.MARKDOWN);
    expect(result.content).toBeDefined();
    expect(result.filename).toBe('test.md');
    expect(result.size).toBe(15);
  });

  it('should create failed export result', () => {
    const result: ExportResult = {
      success: false,
      format: ExportFormat.PDF,
      error: new ExportError(
        ExportErrorCode.GENERATION_FAILED,
        'PDF generation failed'
      )
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ExportError);
    expect(result.error?.code).toBe(ExportErrorCode.GENERATION_FAILED);
  });
});

describe('ExportOptions', () => {
  it('should accept minimal options', () => {
    const options: ExportOptions = {
      format: ExportFormat.MARKDOWN,
      includeMetadata: true
    };

    expect(options.format).toBe(ExportFormat.MARKDOWN);
    expect(options.includeMetadata).toBe(true);
  });

  it('should accept complete options', () => {
    const options: ExportOptions = {
      format: ExportFormat.DOCX,
      includeMetadata: false,
      includeTimestamp: true,
      customFilename: 'custom.docx',
      template: 'standard'
    };

    expect(options.format).toBe(ExportFormat.DOCX);
    expect(options.includeMetadata).toBe(false);
    expect(options.includeTimestamp).toBe(true);
    expect(options.customFilename).toBe('custom.docx');
    expect(options.template).toBe('standard');
  });
});

describe('ExportError', () => {
  it('should create error with code and message', () => {
    const error = new ExportError(
      ExportErrorCode.GENERATION_FAILED,
      'Generation failed'
    );

    expect(error.code).toBe(ExportErrorCode.GENERATION_FAILED);
    expect(error.message).toBe('Generation failed');
    expect(error.name).toBe('ExportError');
  });

  it('should support all error codes', () => {
    const codes = [
      ExportErrorCode.INVALID_FORMAT,
      ExportErrorCode.GENERATION_FAILED,
      ExportErrorCode.FILE_WRITE_ERROR,
      ExportErrorCode.VALIDATION_ERROR
    ];

    codes.forEach(code => {
      const error = new ExportError(code, `Test ${code}`);
      expect(error.code).toBe(code);
      expect(error).toBeInstanceOf(ExportError);
    });
  });
});
