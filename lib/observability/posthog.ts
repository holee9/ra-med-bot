// @MX:NOTE: [AUTO] PostHog product analytics wrapper — REQ-ENTERPRISE-050
// EU endpoint used by default (eu.i.posthog.com) for GDPR compliance.
// Null-safe: all functions no-op when NEXT_PUBLIC_POSTHOG_KEY is not set.
// CRITICAL: This module must remain isolated from the audit system (21 CFR Part 11).

import posthog from 'posthog-js';

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, properties);
  }
}

export function initPostHog(): void {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
    });
  }
}
