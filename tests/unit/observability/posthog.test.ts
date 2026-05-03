/**
 * posthog.test.ts — REQ-ENTERPRISE-050
 *
 * Unit tests for lib/observability/posthog.ts
 * Verifies null-safe behavior and EU endpoint default.
 */

import { describe, expect, it } from 'vitest';

describe('trackEvent (REQ-ENTERPRISE-050)', () => {
  it('should not throw when PostHog is not initialized', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    const { trackEvent } = await import('@/lib/observability/posthog');
    expect(() => trackEvent('test_event')).not.toThrow();
    expect(() => trackEvent('test_event', { prop: 'value' })).not.toThrow();
  });
});

describe('initPostHog (REQ-ENTERPRISE-050)', () => {
  it('should not throw when NEXT_PUBLIC_POSTHOG_KEY is not set', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    const { initPostHog } = await import('@/lib/observability/posthog');
    expect(() => initPostHog()).not.toThrow();
  });
});

describe('EU endpoint default (REQ-ENTERPRISE-050)', () => {
  it('module should reference EU endpoint as default', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.join(process.cwd(), 'lib', 'observability', 'posthog.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('eu.i.posthog.com');
  });
});

describe('module exports (REQ-ENTERPRISE-050)', () => {
  it('should export trackEvent and initPostHog as functions', async () => {
    const mod = await import('@/lib/observability/posthog');
    expect(typeof mod.trackEvent).toBe('function');
    expect(typeof mod.initPostHog).toBe('function');
  });
});
