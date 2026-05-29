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

  // Email: stub — wire to Resend/SendGrid in production.
  if (payload.recipientEmail) {
    if (process.env.RESEND_API_KEY) {
      // TODO: integrate Resend SDK (pnpm add resend)
      logger.info('[notifications] Email stub — RESEND_API_KEY present but not yet integrated');
    }
    result.email = 'skipped';
  }

  return result;
}
