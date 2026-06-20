/**
 * Export type definitions
 * REQ-EXP-001: Export type system supports multiple formats
 */

/**
 * Supported export formats
 */
export enum ExportFormat {
  MARKDOWN = 'markdown',
  DOCX = 'docx',
  PDF = 'pdf',
  EMAIL = 'email'
}

/**
 * Export error codes for consistent error handling
 */
export enum ExportErrorCode {
  INVALID_FORMAT = 'INVALID_FORMAT',
  GENERATION_FAILED = 'GENERATION_FAILED',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * Custom error class for export operations
 */
export class ExportError extends Error {
  constructor(
    public code: ExportErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  content?: string;
  filename?: string;
  size?: number;
  timestamp?: Date;
  error?: ExportError;
}

/**
 * Options for export operations
 */
export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeTimestamp?: boolean;
  customFilename?: string;
  template?: string;
}

/**
 * Base interface for all exporters
 */
export interface Exporter {
  /**
   * Export data to the specified format
   */
  export(data: unknown, options: ExportOptions): Promise<ExportResult>;

  /**
   * Validate that the export can be performed
   */
  validate(data: unknown, options: ExportOptions): Promise<boolean>;
}
