// @MX:NOTE [AUTO] Manual upload source — R2 presigned URL flow (REQ-DOC-018).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-018)
import type { IngestionSource, RawFile, RawMetadata } from './base';

export class ManualUploadSource implements IngestionSource {
  /**
   * Generate a presigned URL for direct-to-R2 upload.
   * Requires CF_ACCOUNT_ID, CF_R2_BUCKET, CF_R2_TOKEN env vars.
   */
  generatePresignedUrl(filename: string, mimeType: string): string {
    const accountId = process.env.CF_ACCOUNT_ID;
    const bucket = process.env.CF_R2_BUCKET;
    const key = `uploads/${Date.now()}-${filename}`;

    if (!accountId || !bucket) {
      // Return a mock URL in development
      return `https://mock-r2.example.com/${bucket}/${key}?mimeType=${mimeType}`;
    }

    // In production, this would call Cloudflare R2 presigned URL API
    return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  }

  /**
   * Verify that a file was successfully uploaded to R2.
   */
  async verifyUpload(r2Key: string): Promise<boolean> {
    if (!process.env.CF_ACCOUNT_ID) return true; // Mock in dev
    // In production: HEAD request to R2
    try {
      const response = await fetch(r2Key, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  // IngestionSource interface — manual uploads are push-based, not pull-based
  async listChanged(_since: Date): Promise<RawFile[]> {
    return []; // Manual uploads are triggered by user action
  }

  async download(r2Key: string): Promise<Buffer> {
    const response = await fetch(r2Key);
    if (!response.ok) throw new Error(`Failed to download from R2: ${r2Key}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async getMetadata(externalId: string): Promise<RawMetadata> {
    return {
      externalId,
      name: externalId.split('/').pop() ?? externalId,
      mimeType: 'application/pdf',
      size: 0,
      modifiedAt: new Date(),
      source: 'manual_upload',
    };
  }
}
