// @MX:NOTE [AUTO] PDF text extractor — wraps pdf-parse with error normalization.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
// pdf-parse uses `export =`; esModuleInterop allows default import.
import pdfParse from 'pdf-parse';

export class ExtractError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExtractError';
  }
}

/**
 * Extract text content from a PDF buffer.
 * Throws ExtractError for encrypted, corrupted, or empty PDFs.
 */
export async function extractPdf(buffer: Buffer): Promise<string> {
  let data: { text: string };
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    throw new ExtractError('Failed to parse PDF', err);
  }

  const text = data.text.trim();
  if (!text) {
    throw new ExtractError('PDF contains no extractable text');
  }

  return text;
}
