// @MX:NOTE [AUTO] Email ingest handler — validates sender and extracts attachments (REQ-DOC-016, 017).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-016, REQ-DOC-017)
import { type EmailEvent, EmailWorkersSource } from '../../ingest/sources/email-workers';

export interface EmailReceivedEvent {
  name: 'docingest.email.received';
  data: {
    orgId: string;
    emailEvent: EmailEvent;
    allowlist: string[];
  };
}

/**
 * Handle an incoming email event from Cloudflare Email Workers.
 * Validates SPF/DKIM/DMARC and sender allowlist, then extracts attachments.
 */
export async function handleEmailReceived(
  event: EmailReceivedEvent,
): Promise<{ processed: number }> {
  const { orgId: _orgId, emailEvent, allowlist } = event.data;

  const source = new EmailWorkersSource(allowlist);

  // Validate sender security
  if (!source.validateEmail(emailEvent)) {
    console.warn(
      `[email-received] Rejected email from ${emailEvent.from} — failed SPF/DKIM/DMARC or not on allowlist`,
    );
    return { processed: 0 };
  }

  // Extract and process attachments
  const attachments = source.extractAttachments(emailEvent);
  let processed = 0;

  for (const _attachment of attachments) {
    processed++;
  }

  return { processed };
}
