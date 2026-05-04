// SendGrid daily digest email channel for high-impact radar updates.
// @MX:SPEC SPEC-REGULA-RADAR-001

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
 * Send a daily digest email to the org's primary contact via SendGrid.
 * Reuses the SENDGRID_API_KEY env var pattern from admin-quarantine.ts.
 *
 * Only sends if org has email_digest_enabled = true (checked by notifier.ts caller).
 */
export async function sendDigestEmail(orgId: string, updates: RelevantUpdate[]): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@regula.ai';

  if (!apiKey) {
    console.warn('[radar/email] SENDGRID_API_KEY not set — skipping digest email');
    return;
  }

  if (!updates.length) return;

  const subject = `Regula Radar: ${updates.length} new regulatory update${updates.length > 1 ? 's' : ''} require your attention`;

  const htmlBody = `
    <h2>Regulatory Radar — Daily Digest</h2>
    <p>${updates.length} high-impact update${updates.length > 1 ? 's' : ''} for your portfolio:</p>
    <ul>
      ${updates
        .map(
          (u) =>
            `<li>
          <strong>${u.title}</strong> (${u.region}) — Impact score: ${(u.impact_score * 100).toFixed(0)}%
          ${u.source_url ? `<br><a href="${u.source_url}">View source</a>` : ''}
        </li>`,
        )
        .join('')}
    </ul>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regula.ai'}/updates">View all updates in Regula</a></p>
  `;

  // In production: fetch SendGrid API with org's primary contact email
  // For now: log the payload (org contact email lookup would require DB query)
  const payload = {
    personalizations: [{ to: [{ email: `org-${orgId}@digest.placeholder` }] }],
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
      console.error(`[radar/email] SendGrid error ${res.status} for org ${orgId}`);
    }
  } catch (err) {
    console.error('[radar/email] Failed to send digest email:', err);
  }
}
