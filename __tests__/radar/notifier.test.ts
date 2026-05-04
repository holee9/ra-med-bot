/**
 * Tests for notifier threshold gating
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Notifier — Threshold Gating', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should trigger badge + email digest for impact_score >= 0.7', async () => {
    const { determineNotificationChannels } = await import('../../lib/radar/notifier');

    const channels = determineNotificationChannels({
      impact_score: 0.75,
      org_settings: {
        email_digest_enabled: true,
        slack_webhook_url: null,
      },
    });

    expect(channels).toContain('badge');
    expect(channels).toContain('email_digest');
    expect(channels).not.toContain('toast');
    expect(channels).not.toContain('slack');
  });

  it('should trigger toast + slack for impact_score >= 0.9', async () => {
    const { determineNotificationChannels } = await import('../../lib/radar/notifier');

    const channels = determineNotificationChannels({
      impact_score: 0.95,
      org_settings: {
        email_digest_enabled: true,
        slack_webhook_url: 'https://hooks.slack.com/services/xxx',
      },
    });

    expect(channels).toContain('badge');
    expect(channels).toContain('toast');
    expect(channels).toContain('slack');
  });

  it('should not include slack when org has no webhook URL', async () => {
    const { determineNotificationChannels } = await import('../../lib/radar/notifier');

    const channels = determineNotificationChannels({
      impact_score: 0.95,
      org_settings: {
        email_digest_enabled: true,
        slack_webhook_url: null,
      },
    });

    expect(channels).not.toContain('slack');
    expect(channels).toContain('toast');
  });

  it('should not trigger any channels for impact_score < 0.7', async () => {
    const { determineNotificationChannels } = await import('../../lib/radar/notifier');

    const channels = determineNotificationChannels({
      impact_score: 0.5,
      org_settings: {
        email_digest_enabled: true,
        slack_webhook_url: 'https://hooks.slack.com/services/xxx',
      },
    });

    expect(channels).toHaveLength(0);
  });

  it('should not include email_digest when org has email digest disabled', async () => {
    const { determineNotificationChannels } = await import('../../lib/radar/notifier');

    const channels = determineNotificationChannels({
      impact_score: 0.8,
      org_settings: {
        email_digest_enabled: false,
        slack_webhook_url: null,
      },
    });

    expect(channels).not.toContain('email_digest');
    expect(channels).toContain('badge');
  });
});
