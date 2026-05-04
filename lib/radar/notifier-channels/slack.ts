// Slack webhook channel — sends high-impact radar alerts to org Slack.
// @MX:SPEC SPEC-REGULA-RADAR-001

import type { RelevantUpdate } from './email';

/**
 * Send a Slack alert for a single high-impact regulatory update.
 * Only called for updates with impact_score >= 0.9.
 *
 * @param webhookUrl - Org's configured Slack incoming webhook URL
 * @param update - The relevant update to alert on
 */
export async function sendSlackAlert(webhookUrl: string, update: RelevantUpdate): Promise<void> {
  const impactPct = (update.impact_score * 100).toFixed(0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regula.ai';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Regula Radar — High-Impact Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Title*\n${update.title}` },
          { type: 'mrkdwn', text: `*Region*\n${update.region}` },
          { type: 'mrkdwn', text: `*Impact Score*\n${impactPct}%` },
          {
            type: 'mrkdwn',
            text: `*Type*\n${update.impact_type ?? 'unspecified'}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in Regula' },
            url: `${appUrl}/updates/${update.id}`,
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[radar/slack] Webhook error ${res.status}`);
    }
  } catch (err) {
    console.error('[radar/slack] Failed to send Slack alert:', err);
  }
}
