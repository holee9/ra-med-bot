// @MX:NOTE: [AUTO] Sentry error tracking wrapper — REQ-ENTERPRISE-049
// Null-safe: all functions no-op when NEXT_PUBLIC_SENTRY_DSN is not set.
// CRITICAL: This module must remain isolated from the audit system (21 CFR Part 11).
// Observability is for engineering metrics only.

import * as Sentry from '@sentry/nextjs';

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' = 'info'): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}
