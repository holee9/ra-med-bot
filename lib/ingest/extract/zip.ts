// @MX:NOTE [AUTO] ZIP extractor with bomb protection — rejects if uncompressed > 500MB.
// @MX:WARN Zip bomb protection is critical — malicious archives can exhaust memory.
// @MX:REASON Without size limit check, a crafted ZIP can expand to GBs and crash the server.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
import { ExtractError } from './pdf';

const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * Extract file buffers from a ZIP archive.
 * Rejects zip bombs (uncompressed size > 500 MB).
 * Returns an array of contained file buffers.
 */
export async function extractZip(buffer: Buffer): Promise<Buffer[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let JSZip: any;
  try {
    // @ts-expect-error - jszip is an optional runtime dependency
    JSZip = await import('jszip');
  } catch {
    throw new ExtractError('jszip package not available');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let zip: any;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new ExtractError('Failed to load ZIP archive', err);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const files = Object.values(zip.files as Record<string, any>).filter((f: any) => !f.dir);
  const buffers: Buffer[] = [];
  let totalSize = 0;

  for (const file of files) {
    const content = await (file as any).async('nodebuffer') as Buffer;
    totalSize += content.byteLength;
    if (totalSize > MAX_UNCOMPRESSED_BYTES) {
      throw new ExtractError(
        `ZIP bomb detected: uncompressed size exceeds ${MAX_UNCOMPRESSED_BYTES / 1024 / 1024}MB limit`,
      );
    }
    buffers.push(content);
  }

  return buffers;
}
