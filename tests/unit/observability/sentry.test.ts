/**
 * sentry.test.ts — REQ-ENTERPRISE-049
 *
 * Unit tests for lib/observability/sentry.ts
 * Verifies null-safe behavior when NEXT_PUBLIC_SENTRY_DSN is not set.
 */

import { describe, expect, it } from 'vitest';

describe('captureError (REQ-ENTERPRISE-049)', () => {
  it('should not throw when NEXT_PUBLIC_SENTRY_DSN is not set', async () => {
    const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = undefined;
    try {
      const { captureError } = await import('@/lib/observability/sentry');
      expect(() => captureError(new Error('test error'))).not.toThrow();
      expect(() => captureError(new Error('with context'), { userId: '123' })).not.toThrow();
    } finally {
      if (originalDsn !== undefined) process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it('should not throw for non-Error values', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = undefined;
    const { captureError } = await import('@/lib/observability/sentry');
    expect(() => captureError('string error')).not.toThrow();
    expect(() => captureError(null)).not.toThrow();
    expect(() => captureError(undefined)).not.toThrow();
  });
});

describe('captureMessage (REQ-ENTERPRISE-049)', () => {
  it('should not throw when NEXT_PUBLIC_SENTRY_DSN is not set', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = undefined;
    const { captureMessage } = await import('@/lib/observability/sentry');
    expect(() => captureMessage('test message')).not.toThrow();
    expect(() => captureMessage('warning message', 'warning')).not.toThrow();
  });
});

describe('module exports (REQ-ENTERPRISE-049)', () => {
  it('should export captureError and captureMessage as functions', async () => {
    const mod = await import('@/lib/observability/sentry');
    expect(typeof mod.captureError).toBe('function');
    expect(typeof mod.captureMessage).toBe('function');
  });
});
