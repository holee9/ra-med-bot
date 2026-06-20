/**
 * EmailExporter for mailto link generation
 * SPEC-REGULA-EXPORT-HUB-001 Phase 6 (T-028 through T-033)
 * REQ-EXP-007: Email export with mailto link generation
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001
 */

import { BaseExporter } from '../base-exporter';
import { ExportFormat, ExportOptions, ExportResult } from '../types';

/**
 * Email exporter interface
 * Defines the expected data structure for email export
 */
interface EmailData {
  title: string;
  content: string;
  artifactType: string;
  citations?: Array<{ source: string; offset: number }>;
  attachment?: boolean;
  attachmentFormat?: 'docx' | 'pdf';
}

/**
 * EmailExporter - Generates mailto links for email forwarding
 * @MX:NOTE Browser security prevents actual file attachments via mailto protocol
 * @MX:NOTE Maximum URL length typically 2000 characters
 */
export class EmailExporter extends BaseExporter {
  /**
   * Get the export format
   */
  getFormat(): ExportFormat {
    return ExportFormat.EMAIL;
  }

  /**
   * Validate email export data
   */
  async validate(data: unknown, options: ExportOptions): Promise<boolean> {
    try {
      const emailData = data as EmailData;

      if (!emailData.title || typeof emailData.title !== 'string') {
        return false;
      }

      if (!emailData.content || typeof emailData.content !== 'string') {
        return false;
      }

      if (!emailData.artifactType || typeof emailData.artifactType !== 'string') {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export to email via mailto link
   * Opens user's default mail client with pre-filled subject and body
   */
  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    try {
      // Validate data
      const isValid = await this.validate(data, options);
      if (!isValid) {
        return this.createErrorResult(
          ExportFormat.EMAIL,
          'VALIDATION_ERROR',
          'Invalid email data: title, content, and artifactType are required'
        );
      }

      const emailData = data as EmailData;

      // Generate subject line with artifact type and title
      const subject = this.formatSubject(emailData.artifactType, emailData.title);

      // Generate body with content and citations
      const body = this.formatBody(emailData);

      // Handle attachment request (document limitation)
      let attachmentNotice = '';
      if (emailData.attachment || emailData.attachmentFormat) {
        attachmentNotice = this.formatAttachmentNotice(emailData.attachmentFormat);
      }

      // Build mailto URL
      const mailtoUrl = this.buildMailtoUrl(subject, body, attachmentNotice);

      // Open mail client
      if (typeof window !== 'undefined' && window.open) {
        window.open(mailtoUrl, '_blank');
      }

      return this.createSuccessResult(
        ExportFormat.EMAIL,
        mailtoUrl,
        `email-${emailData.artifactType}-${emailData.title}.mailto`
      );
    } catch (error) {
      return this.createErrorResult(
        ExportFormat.EMAIL,
        'GENERATION_FAILED',
        (error as Error).message
      );
    }
  }

  /**
   * Format subject line with artifact type and title
   * @MX:NOTE Formats as "Regula {ArtifactType}: {Title}"
   */
  private formatSubject(artifactType: string, title: string): string {
    const capitalizedType = artifactType.charAt(0).toUpperCase() + artifactType.slice(1);
    return `Regula ${capitalizedType}: ${title}`;
  }

  /**
   * Format email body with content and citations
   * @MX:NOTE Preserves paragraph structure with double newlines
   */
  private formatBody(data: EmailData): string {
    let body = data.content;

    // Add citations if present and metadata requested
    if (data.citations && data.citations.length > 0) {
      body += '\n\nCitations:\n';
      data.citations.forEach((citation) => {
        body += `- ${citation.source}\n`;
      });
    }

    return body;
  }

  /**
   * Format attachment notice explaining browser limitations
   * @MX:NOTE Documents that mailto protocol doesn't support file attachments
   */
  private formatAttachmentNotice(format?: 'docx' | 'pdf'): string {
    const formatText = format ? format.toUpperCase() : 'DOCX or PDF';

    return `\n\n---\n` +
      `File attachments not supported via mailto protocol.\n` +
      `Browser security limitation: Cannot attach files directly.\n` +
      `Alternative: Export to ${formatText} first, then attach in email client.\n`;
  }

  /**
   * Build mailto URL with URL-encoded subject and body
   * @MX:NOTE Uses encodeURIComponent for proper URL encoding
   */
  private buildMailtoUrl(subject: string, body: string, attachmentNotice: string): string {
    const fullBody = body + attachmentNotice;

    // URL encode subject and body
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(fullBody);

    // Build mailto URL
    return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  }
}
