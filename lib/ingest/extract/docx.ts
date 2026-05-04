// @MX:NOTE [AUTO] DOCX text extractor — uses mammoth to convert Word documents.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
import { ExtractError } from './pdf';

/**
 * Extract text content from a DOCX buffer using mammoth.
 * Throws ExtractError for corrupted or unreadable documents.
 */
export async function extractDocx(buffer: Buffer): Promise<string> {
  let mammoth: typeof import('mammoth');
  try {
    mammoth = await import('mammoth');
  } catch {
    throw new ExtractError('mammoth package not available');
  }

  let result: { value: string };
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    throw new ExtractError('Failed to extract DOCX text', err);
  }

  const text = result.value.trim();
  if (!text) {
    throw new ExtractError('DOCX contains no extractable text');
  }

  return text;
}
