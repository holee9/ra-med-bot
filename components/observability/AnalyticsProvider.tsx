// @MX:NOTE: [AUTO] Client-side analytics provider — REQ-ENTERPRISE-052
// Initializes PostHog and renders Vercel Analytics.
// Must be a client component; rendered once in root layout.

'use client';

import { initPostHog } from '@/lib/observability/posthog';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';

export function AnalyticsProvider() {
  useEffect(() => {
    initPostHog();
  }, []);

  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === '0'
  ) {
    return null;
  }

  return <Analytics />;
}
