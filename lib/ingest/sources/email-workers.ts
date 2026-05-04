// @MX:NOTE [AUTO] Email Workers source — Cloudflare Email Worker MIME event handler (REQ-DOC-016).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-016)
import type { IngestionSource, RawFile, RawMetadata } from './base';

export interface EmailEvent {
  from: string;
  to: string;
  subject: string;
  messageId: string;
  spf: 'pass' | 'fail' | 'neutral';
  dkim: 'pass' | 'fail' | 'neutral';
  dmarc: 'pass' | 'fail' | 'neutral';
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    data: Buffer;
  }>;
}

export class EmailWorkersSource implements IngestionSource {
  private readonly allowlist: string[];

  constructor(allowlist?: string[]) {
    // Parse email allowlist from env or use provided list
    const envAllowlist = process.env.EMAIL_INGEST_ALLOWLIST;
    this.allowlist = allowlist ?? (envAllowlist ? (JSON.parse(envAllowlist) as string[]) : []);
  }

  /**
   * Validate that an email sender is on the org allowlist and passes SPF/DKIM/DMARC.
   */
  validateEmail(event: EmailEvent): boolean {
    if (event.spf !== 'pass' || event.dkim !== 'pass' || event.dmarc !== 'pass') {
      return false;
    }
    if (this.allowlist.length === 0) return true;
    return this.allowlist.some((allowed) =>
      event.from.toLowerCase().endsWith(`@${allowed.toLowerCase()}`),
    );
  }

  /**
   * Extract attachments from an email event and return as RawFile arrays.
   */
  extractAttachments(event: EmailEvent): Array<RawFile & { data: Buffer }> {
    return event.attachments.map((att) => ({
      externalId: `email/${event.messageId}/${att.filename}`,
      name: att.filename,
      mimeType: att.mimeType,
      size: att.size,
      modifiedAt: new Date(),
      data: att.data,
    }));
  }

  // IngestionSource interface — email is push-based, not poll-based
  async listChanged(_since: Date): Promise<RawFile[]> {
    return []; // Email attachments are pushed via webhook events
  }

  async download(externalId: string): Promise<Buffer> {
    // In production: fetch from temporary storage where email attachment was staged
    throw new Error(`Cannot download email attachment ${externalId} — use Inngest event data`);
  }

  async getMetadata(externalId: string): Promise<RawMetadata> {
    const parts = externalId.split('/');
    return {
      externalId,
      name: parts[parts.length - 1] ?? externalId,
      mimeType: 'application/pdf',
      size: 0,
      modifiedAt: new Date(),
      source: 'email_workers',
    };
  }
}
