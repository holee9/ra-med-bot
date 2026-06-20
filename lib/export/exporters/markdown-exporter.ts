/**
 * MarkdownExporter class
 * SPEC-REGULA-EXPORT-HUB-001 Phase 3 (T-011, T-012, T-013)
 * REQ-EXP-002, REQ-EXP-003: Markdown export with citations and headers
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001
 */

import { BaseExporter } from '../base-exporter';
import { ExportFormat, type ExportOptions, type ExportResult } from '../types';
import { ExportErrorCode } from '../types';

/**
 * Data structure for export with metadata
 */
interface MarkdownData {
  content: string;
  citations?: Array<{ text: string; url?: string }>;
  html?: boolean;
}

/**
 * MarkdownExporter - Export data to Markdown format
 * Supports citation formatting and HTML header conversion
 * @MX:NOTE Implements REQ-EXP-002 (citation formatting) and REQ-EXP-003 (header conversion)
 */
export class MarkdownExporter extends BaseExporter {
  /**
   * Export data to Markdown format
   */
  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    try {
      this.validateOptions(options);

      if (!(await this.validate(data, options))) {
        return this.createErrorResult(
          options.format,
          ExportErrorCode.VALIDATION_ERROR,
          'Invalid data for Markdown export',
        );
      }

      const markdownData = data as MarkdownData;
      let markdown = markdownData.content;

      // Convert HTML headers to markdown if html flag is set
      if (markdownData.html) {
        markdown = this.convertHeaders(markdown);
      }

      // Add citations as markdown links if includeMetadata is true
      if (options.includeMetadata && markdownData.citations) {
        markdown = this.addCitations(markdown, markdownData.citations);
      }

      // Ensure .md extension
      const baseFilename = options.customFilename || `export-${this.getTimestamp()}`;
      const filename = baseFilename.endsWith('.md') ? baseFilename : `${baseFilename}.md`;

      return this.createSuccessResult(options.format, markdown, filename);
    } catch (error) {
      return this.createErrorResult(
        options.format,
        ExportErrorCode.GENERATION_FAILED,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Validate that the export can be performed
   */
  async validate(data: unknown, options: ExportOptions): Promise<boolean> {
    if (options.format !== this.getFormat()) {
      return false;
    }

    const markdownData = data as MarkdownData;
    return !!markdownData?.content;
  }

  /**
   * Get the format this exporter handles
   */
  getFormat(): ExportFormat {
    return ExportFormat.MARKDOWN;
  }

  /**
   * Convert HTML headers to markdown format
   * Converts <h1>, <h2>, <h3> to #, ##, ###
   * @MX:NOTE Part of REQ-EXP-003 implementation
   */
  private convertHeaders(content: string): string {
    let markdown = content;

    // Convert h1 to #
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1');

    // Convert h2 to ##
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1');

    // Convert h3 to ###
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/gi, '### $1');

    return markdown;
  }

  /**
   * Add citations as markdown links
   * Formats citations as [text](url) markdown links
   * @MX:NOTE Part of REQ-EXP-002 implementation
   */
  private addCitations(content: string, citations: Array<{ text: string; url?: string }>): string {
    let markdown = content;

    for (const citation of citations) {
      if (citation.url) {
        // Format as markdown link: [text](url)
        const link = `[${citation.text}](${citation.url})`;
        markdown += `\n\n${link}`;
      } else {
        // Just add text if no URL
        markdown += `\n\n${citation.text}`;
      }
    }

    return markdown;
  }

  /**
   * Generate timestamp for filename
   * Format: YYYYMMDDHHmmss
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}
