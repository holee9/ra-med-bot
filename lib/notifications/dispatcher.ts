// @MX:NOTE [AUTO] Notification dispatcher — sends to Slack webhook, Teams webhook, and email.
// @MX:SPEC SPEC-REGULA-NOTIFICATIONS-001 (REQ-NOTIFY-001..005)

import { logger } from '@/lib/observability/logger';

export type NotificationEventType =
  | 'expert_review.assigned'
  | 'expert_review.sla_warning'
  | 'regulatory_update.high_risk'
  | 'regulatory_update.weekly_digest'
  | 'workflow.completed'
  | 'batch_query.completed'
  | 'knowledge_gap.detected';

export interface NotificationPayload {
  eventType: NotificationEventType;
  title: string;
  body: string;
  actionUrl?: string;
  recipientEmail?: string;
  orgSlackWebhookUrl?: string;
  orgTeamsWebhookUrl?: string;
}

export interface DispatchResult {
  slack: 'sent' | 'skipped' | 'error';
  teams: 'sent' | 'skipped' | 'error';
  email: 'sent' | 'skipped' | 'error';
}

/** Send a Slack message via incoming webhook. */
async function sendSlack(webhookUrl: string, title: string, body: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }
}

/**
 * Send a transactional email via SendGrid v3 REST API.
 * Reuses the SENDGRID_API_KEY / SENDGRID_FROM_EMAIL env pattern from
 * lib/radar/notifier-channels/email.ts and lib/digest/email-sender.ts.
 * No SDK dependency — raw fetch keeps the module Edge/Node portable.
 * @MX:ANCHOR: [AUTO] External system integration point (SendGrid v3 mail/send)
 * @MX:REASON: REQ-NOTIFY-004 email channel contract; fan_in ≥ 3 callers via dispatch()
 */
async function sendEmail(
  to: string,
  title: string,
  body: string,
  actionUrl?: string,
): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@regula.ai';

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not set');
  }

  // Minimal HTML wrapper. actionUrl renders as a primary CTA when provided.
  const html = actionUrl
    ? `<html><body style="font-family:sans-serif;">
        <h2>${escapeHtml(title)}</h2>
        <p style="white-space:pre-wrap;">${escapeHtml(body)}</p>
        <p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:midnightblue;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;">Regula에서 보기</a></p>
      </body></html>`
    : `<html><body style="font-family:sans-serif;">
        <h2>${escapeHtml(title)}</h2>
        <p style="white-space:pre-wrap;">${escapeHtml(body)}</p>
      </body></html>`;

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail },
    subject: title,
    content: [{ type: 'text/html', value: html }],
  };

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`SendGrid returned ${res.status}`);
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

/** Send a Teams message via incoming webhook. */
async function sendTeams(webhookUrl: string, title: string, body: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: '0076D7',
      summary: title,
      sections: [{ activityTitle: title, activityText: body }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Teams webhook returned ${res.status}`);
  }
}

/**
 * Dispatch a notification to configured channels.
 * Failures in individual channels do not block others (fire-and-forget per channel).
 */
export async function dispatch(payload: NotificationPayload): Promise<DispatchResult> {
  const result: DispatchResult = { slack: 'skipped', teams: 'skipped', email: 'skipped' };

  if (payload.orgSlackWebhookUrl) {
    try {
      await sendSlack(payload.orgSlackWebhookUrl, payload.title, payload.body);
      result.slack = 'sent';
    } catch (err) {
      logger.error('[notifications] Slack dispatch failed:', err);
      result.slack = 'error';
    }
  }

  if (payload.orgTeamsWebhookUrl) {
    try {
      await sendTeams(payload.orgTeamsWebhookUrl, payload.title, payload.body);
      result.teams = 'sent';
    } catch (err) {
      logger.error('[notifications] Teams dispatch failed:', err);
      result.teams = 'error';
    }
  }

  // Email: SendGrid v3 REST API. Skipped silently when SENDGRID_API_KEY is
  // unset (dev/test environments) to avoid surfacing env misconfiguration as a
  // hard error — matches radar/notifier-channels/email.ts skip behavior.
  // Actual API failures (auth, network, non-2xx) are logged as 'error'.
  if (payload.recipientEmail) {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('[notifications] Email skipped — SENDGRID_API_KEY not set');
      result.email = 'skipped';
    } else {
      try {
        await sendEmail(payload.recipientEmail, payload.title, payload.body, payload.actionUrl);
        result.email = 'sent';
      } catch (err) {
        logger.error('[notifications] Email dispatch failed:', err);
        result.email = 'error';
      }
    }
  }

  return result;
}
