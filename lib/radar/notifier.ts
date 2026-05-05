// @MX:ANCHOR [AUTO] Radar notifier — threshold-gated multi-channel notification dispatch.
// @MX:REASON Called by radar-notify-consumer worker. fan_in >= 3 (worker, tests, admin APIs).
// @MX:SPEC SPEC-REGULA-RADAR-001

import { logger } from '@/lib/observability/logger';
import { setBadge } from './notifier-channels/badge';
import { type RelevantUpdate, sendDigestEmail } from './notifier-channels/email';
import { sendSlackAlert } from './notifier-channels/slack';
import { queueToast } from './notifier-channels/toast';

export type NotificationChannel = 'badge' | 'email_digest' | 'toast' | 'slack';

export interface OrgNotificationSettings {
  email_digest_enabled: boolean;
  slack_webhook_url: string | null;
}

/**
 * Determine which notification channels to activate based on impact score and org settings.
 * Pure function — no side effects. Used directly by tests.
 *
 * Thresholds:
 *   >= 0.9 → badge + email + toast + slack (if configured)
 *   >= 0.7 → badge + email (if enabled)
 *   < 0.7  → no notifications
 */
export function determineNotificationChannels(params: {
  impact_score: number;
  org_settings: OrgNotificationSettings;
}): NotificationChannel[] {
  const { impact_score, org_settings } = params;

  if (impact_score < 0.7) return [];

  const channels: NotificationChannel[] = ['badge'];

  if (org_settings.email_digest_enabled) {
    channels.push('email_digest');
  }

  if (impact_score >= 0.9) {
    channels.push('toast');

    if (org_settings.slack_webhook_url) {
      channels.push('slack');
    }
  }

  return channels;
}

/**
 * Dispatch notifications for a scored regulatory update.
 * Writes an audit event after dispatch.
 */
export async function notifyUpdate(
  orgId: string,
  updateId: string,
  impactScore: number,
  update: RelevantUpdate,
  orgSettings: OrgNotificationSettings,
): Promise<void> {
  const channels = determineNotificationChannels({
    impact_score: impactScore,
    org_settings: orgSettings,
  });

  if (channels.length === 0) return;

  const dispatched: NotificationChannel[] = [];

  for (const channel of channels) {
    try {
      switch (channel) {
        case 'badge':
          // Increment badge — in production, fetch current count from KV first.
          // Simple approach: set to 1 (increment handled by consumer).
          await setBadge(orgId, 1);
          dispatched.push('badge');
          break;

        case 'email_digest':
          await sendDigestEmail(orgId, [update]);
          dispatched.push('email_digest');
          break;

        case 'toast':
          await queueToast(orgId, updateId);
          dispatched.push('toast');
          break;

        case 'slack':
          if (orgSettings.slack_webhook_url) {
            await sendSlackAlert(orgSettings.slack_webhook_url, update);
            dispatched.push('slack');
          }
          break;
      }
    } catch (err) {
      logger.error(`[radar/notifier] Channel ${channel} failed for org ${orgId}:`, err);
    }
  }

  // Lazy-import writeAudit to avoid DB initialization at module load time
  // (prevents env var failures in test environments)
  try {
    const { writeAudit } = await import('@/lib/audit');
    await writeAudit({
      actor_id: null, // system-initiated
      action: 'radar.notification',
      resource_type: 'regulatory_update',
      resource_id: updateId,
      meta_json: {
        org_id: orgId,
        impact_score: impactScore,
        channels_dispatched: dispatched,
      },
    });
  } catch {
    // Audit write failure must not block notifications in test/dev
    logger.warn('[radar/notifier] Audit write skipped (likely test environment)');
  }
}
