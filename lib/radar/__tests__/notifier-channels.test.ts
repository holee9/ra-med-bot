// @MX:NOTE [AUTO] Unit tests for determineNotificationChannels (coverage 402).
// @MX:SPEC SPEC-REGULA-RADAR-001 (notification routing by impact score)

import { describe, expect, it } from 'vitest';
import { determineNotificationChannels } from '../notifier';

const baseSettings = {
  email_digest_enabled: false,
  slack_webhook_url: null,
};

describe('determineNotificationChannels (impact-score routing)', () => {
  it('returns [] when impact_score < 0.7 (below threshold)', () => {
    expect(
      determineNotificationChannels({ impact_score: 0.69, org_settings: baseSettings }),
    ).toEqual([]);
  });

  it('returns only badge for 0.7 <= score < 0.9 with no extras', () => {
    expect(
      determineNotificationChannels({ impact_score: 0.75, org_settings: baseSettings }),
    ).toEqual(['badge']);
  });

  it('adds email_digest when enabled (mid score)', () => {
    expect(
      determineNotificationChannels({
        impact_score: 0.8,
        org_settings: { ...baseSettings, email_digest_enabled: true },
      }),
    ).toEqual(['badge', 'email_digest']);
  });

  it('adds toast at score >= 0.9', () => {
    expect(
      determineNotificationChannels({ impact_score: 0.95, org_settings: baseSettings }),
    ).toEqual(['badge', 'toast']);
  });

  it('adds slack at score >= 0.9 when webhook configured', () => {
    expect(
      determineNotificationChannels({
        impact_score: 0.95,
        org_settings: { ...baseSettings, slack_webhook_url: 'https://hooks.slack.example/x' },
      }),
    ).toEqual(['badge', 'toast', 'slack']);
  });

  it('full set: badge + email_digest + toast + slack at score 0.9 with all enabled', () => {
    expect(
      determineNotificationChannels({
        impact_score: 0.9,
        org_settings: {
          email_digest_enabled: true,
          slack_webhook_url: 'https://hooks.slack.example/y',
        },
      }),
    ).toEqual(['badge', 'email_digest', 'toast', 'slack']);
  });
});
