/**
 * Base exporter abstract class
 * REQ-EXP-001: All exporters must extend this base class
 */

import type { ExportErrorCode, ExportFormat, ExportOptions, ExportResult, Exporter } from './types';

/**
 * Abstract base class for all exporters
 * Provides common interface and utility methods for export operations
 */
export abstract class BaseExporter implements Exporter {
  /**
   * Export data to the specified format
   * Must be implemented by concrete exporters
   */
  abstract export(data: unknown, options: ExportOptions): Promise<ExportResult>;

  /**
   * Validate that the export can be performed
   * Must be implemented by concrete exporters
   */
  abstract validate(data: unknown, options: ExportOptions): Promise<boolean>;

  /**
   * Get the format this exporter handles
   * Must be implemented by concrete exporters
   */
  abstract getFormat(): ExportFormat;

  /**
   * Common validation logic for all exporters
   * Checks that required options are present
   */
  protected validateOptions(options: ExportOptions): void {
    if (!options.format) {
      throw new Error('Export format is required');
    }
  }

  /**
   * Common result generation logic
   * Creates a successful ExportResult
   */
  protected createSuccessResult(
    format: ExportFormat,
    content: string,
    filename: string,
  ): ExportResult {
    const blob = new Blob([content], { type: 'text/plain' });
    return {
      success: true,
      format,
      content,
      filename,
      size: blob.size,
      timestamp: new Date(),
    };
  }

  /**
   * Common error generation logic
   * Creates a failed ExportResult
   */
  protected createErrorResult(
    format: ExportFormat,
    code: ExportErrorCode,
    message: string,
  ): ExportResult {
    return {
      success: false,
      format,
      error: {
        code,
        message,
        name: 'ExportError',
      },
    };
  }
}
