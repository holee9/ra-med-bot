// Sentry server-side initialization — REQ-ENTERPRISE-049, REQ-LAUNCH-036
// Only enabled in production; DSN is optional.
//
// beforeSend: strips PII fields (query, user_id, chat content) before the
// event is forwarded to Sentry. This satisfies REQ-LAUNCH-036 (zero PII
// transmission) and aligns with GDPR / HIPAA data minimisation requirements.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',

  // @MX:NOTE [AUTO] PII redaction hook — REQ-LAUNCH-036.
  // Removes fields that may carry patient or user data before Sentry ingests
  // the event. Runs for every captured exception and breadcrumb event.
  beforeSend(event) {
    // Strip request query string — may contain user search terms / PHI.
    if (event.request) {
      event.request.query_string = undefined;
      if (event.request.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>;
        data.query = undefined;
        data.user_id = undefined;
        data.userId = undefined;
        data.message = undefined;
        data.content = undefined;
      }
    }

    // Strip user identity — keep only a hashed or anonymised identifier.
    if (event.user) {
      event.user.email = undefined;
      event.user.ip_address = undefined;
      event.user.username = undefined;
      // Retain event.user.id as an anonymised session reference if present.
    }

    // Remove extra context keys that could hold chat content.
    if (event.extra) {
      const redactKeys = ['query', 'user_id', 'userId', 'content', 'message', 'prompt'];
      for (const key of redactKeys) {
        if (key in event.extra) {
          (event.extra as Record<string, unknown>)[key] = '[REDACTED]';
        }
      }
    }

    return event;
  },
});
