// @MX:NOTE [AUTO] ZIP extractor with bomb protection — rejects if uncompressed > 500MB.
// @MX:WARN Zip bomb protection is critical — malicious archives can exhaust memory.
// @MX:REASON Without size limit check, a crafted ZIP can expand to GBs and crash the server.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
import { ExtractError } from './pdf';

const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB

type ZipEntry = {
  dir: boolean;
  async(type: 'nodebuffer'): Promise<Buffer>;
};

type ZipArchive = {
  files: Record<string, ZipEntry>;
};

type JSZipModule = {
  loadAsync(buffer: Buffer): Promise<ZipArchive>;
};

/**
 * Extract file buffers from a ZIP archive.
 * Rejects zip bombs (uncompressed size > 500 MB).
 * Returns an array of contained file buffers.
 */
export async function extractZip(buffer: Buffer): Promise<Buffer[]> {
  let JSZip: JSZipModule;
  try {
    // @ts-expect-error - jszip is an optional runtime dependency
    JSZip = (await import('jszip')) as JSZipModule;
  } catch {
    throw new ExtractError('jszip package not available');
  }

  let zip: ZipArchive;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new ExtractError('Failed to load ZIP archive', err);
  }

  const files = Object.values(zip.files).filter((f) => !f.dir);
  const buffers: Buffer[] = [];
  let totalSize = 0;

  for (const file of files) {
    const content = await file.async('nodebuffer');
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
