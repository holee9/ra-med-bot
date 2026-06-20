/**
 * ExportHub - Central registry for all exporters
 * SPEC-REGULA-EXPORT-HUB-001 Phase 6 (T-033)
 * REQ-EXP-007: ExportHub integration with Email exporter
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001
 */

import type { BaseExporter } from './base-exporter';
import { DOCXExporter } from './exporters/docx-exporter';
import { EmailExporter } from './exporters/email-exporter';
import { MarkdownExporter } from './exporters/markdown-exporter';
import { PDFExporter } from './exporters/pdf-exporter';
import {
  ExportError,
  ExportErrorCode,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from './types';

/**
 * ExportHub - Central registry for all export formats
 * Manages exporter instantiation and format selection
 * @MX:NOTE Part of REQ-EXP-006 implementation
 */
export class ExportHub {
  private exporters: Map<ExportFormat, BaseExporter>;

  constructor() {
    this.exporters = new Map();
    this.registerDefaultExporters();
  }

  /**
   * Register default exporters
   * @MX:NOTE Auto-registers Markdown, PDF, and Email exporters (DOCX requires 'docx' package)
   * @MX:NOTE Phase 6 T-033: EmailExporter added to default exporters
   */
  private registerDefaultExporters(): void {
    this.register(new MarkdownExporter());
    this.register(new PDFExporter());
    this.register(new EmailExporter());

    this.register(new DOCXExporter());
  }

  /**
   * Register an exporter for a specific format
   * @param exporter - The exporter instance to register
   * @MX:NOTE Allows custom exporter registration
   */
  register(exporter: BaseExporter): void {
    this.exporters.set(exporter.getFormat(), exporter);
  }

  /**
   * Get exporter for a specific format
   * @param format - The export format
   * @returns The exporter instance or undefined
   * @MX:NOTE Returns undefined if format not supported
   */
  getExporter(format: ExportFormat): BaseExporter | undefined {
    return this.exporters.get(format);
  }

  /**
   * Export data using the specified format
   * @param data - The data to export
   * @param options - Export options including format
   * @returns Export result with success status
   * @MX:NOTE Main entry point for export operations
   */
  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    const exporter = this.getExporter(options.format);

    if (!exporter) {
      return {
        success: false,
        format: options.format,
        error: new ExportError(
          ExportErrorCode.INVALID_FORMAT,
          `Unsupported export format: ${options.format}`,
        ),
      };
    }

    return exporter.export(data, options);
  }

  /**
   * Get all supported export formats
   * @returns Array of supported formats
   * @MX:NOTE Lists available export formats
   */
  getSupportedFormats(): ExportFormat[] {
    return Array.from(this.exporters.keys());
  }

  /**
   * Check if a format is supported
   * @param format - The format to check
   * @returns True if format is supported
   * @MX:NOTE Validates format availability
   */
  isFormatSupported(format: ExportFormat): boolean {
    return this.exporters.has(format);
  }
}

/**
 * Default export hub instance
 * @MX:NOTE Singleton for convenient access
 */
export const defaultExportHub = new ExportHub();
