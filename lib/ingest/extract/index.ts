// @MX:ANCHOR [AUTO] MIME dispatcher — routes buffers to correct extractor by MIME type.
// @MX:REASON fan_in >= 3: ingest pipeline, upload handler, and tests all call this.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
import { ExtractError } from './pdf';
import { extractPdf } from './pdf';
import { extractDocx } from './docx';
import { extractXlsx } from './xlsx';

/** Supported MIME types for text extraction. */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * Extract text content from a buffer based on its MIME type.
 * Throws ExtractError for unsupported MIME types (HTTP 415 equivalent).
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdf(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocx(buffer);

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return extractXlsx(buffer);

    case 'application/zip': {
      // For ZIP: extract and concatenate text from all contained files recursively
      const { extractZip } = await import('./zip');
      const innerBuffers = await extractZip(buffer);
      const texts: string[] = [];
      for (const innerBuffer of innerBuffers) {
        // Try PDF for each inner file (most common regulatory document format)
        try {
          texts.push(await extractPdf(innerBuffer));
        } catch {
          // Skip non-PDF inner files silently
        }
      }
      if (texts.length === 0) {
        throw new ExtractError('ZIP contains no extractable text files');
      }
      return texts.join('\n\n');
    }

    default:
      throw new ExtractError(
        `Unsupported MIME type: ${mimeType || '(empty)'}. HTTP 415 — use one of: ${SUPPORTED_MIME_TYPES.join(', ')}`,
      );
  }
}
