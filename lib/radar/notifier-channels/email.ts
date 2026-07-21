// SendGrid daily digest email channel for high-impact radar updates.
// @MX:SPEC SPEC-REGULA-RADAR-001
import { logger } from '@/lib/observability/logger';

export interface RelevantUpdate {
  id: string;
  title: string;
  region: string;
  impact_score: number;
  impact_type?: string;
  source_url?: string | null;
  published_at?: Date;
}

/**
 * Resolve the org's digest recipient email list from orgDigestPreferences.
 * Skips when frequency is 'disabled' or recipientEmails is empty.
 * Uses dynamic import so module load does not trigger env validation
 * (lib/kernel/db/client calls getEnv() at init — would break unit tests).
 */
async function resolveRecipients(orgId: string): Promise<string[]> {
  const { db } = await import('@/lib/kernel/db/client');
  const { orgDigestPreferences } = await import('@/lib/kernel/db/schema');
  const { and, eq, ne } = await import('drizzle-orm');

  const rows = await db
    .select({ recipientEmails: orgDigestPreferences.recipientEmails })
    .from(orgDigestPreferences)
    .where(
      and(eq(orgDigestPreferences.orgId, orgId), ne(orgDigestPreferences.frequency, 'disabled')),
    )
    .limit(1);

  return rows[0]?.recipientEmails ?? [];
}

/**
 * Send a daily digest email to the org's configured recipient list via SendGrid.
 * Reuses the SENDGRID_API_KEY env var pattern from admin-quarantine.ts.
 *
 * Recipients are resolved from orgDigestPreferences.recipientEmails.
 * Caller (notifier.ts) additionally gates on email_digest_enabled.
 */
export async function sendDigestEmail(orgId: string, updates: RelevantUpdate[]): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@regula.ai';

  if (!apiKey) {
    logger.warn('[radar/email] SENDGRID_API_KEY not set — skipping digest email');
    return;
  }

  if (!updates.length) return;

  const recipients = await resolveRecipients(orgId);
  if (recipients.length === 0) {
    logger.info(`[radar/email] No recipients configured for org ${orgId} — skipping`);
    return;
  }

  const subject = `Regula Radar: ${updates.length} new regulatory update${updates.length > 1 ? 's' : ''} require your attention`;

  const htmlBody = `
    <h2>Regulatory Radar — Daily Digest</h2>
    <p>${updates.length} high-impact update${updates.length > 1 ? 's' : ''} for your portfolio:</p>
    <ul>
      ${updates
        .map(
          (u) =>
            `<li>
          <strong>${escapeHtml(u.title)}</strong> (${escapeHtml(u.region)}) — Impact score: ${(u.impact_score * 100).toFixed(0)}%
          ${u.source_url ? `<br><a href="${escapeHtml(u.source_url)}">View source</a>` : ''}
        </li>`,
        )
        .join('')}
    </ul>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regula.ai'}/updates">View all updates in Regula</a></p>
  `;

  const payload = {
    personalizations: [{ to: recipients.map((email) => ({ email })) }],
    from: { email: fromEmail },
    subject,
    content: [{ type: 'text/html', value: htmlBody }],
  };

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.error(`[radar/email] SendGrid error ${res.status} for org ${orgId}`);
    }
  } catch (err) {
    logger.error('[radar/email] Failed to send digest email:', err);
  }
}

/** Server-side HTML escape (no DOM dependency). */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
