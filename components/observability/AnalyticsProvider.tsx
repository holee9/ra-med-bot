// @MX:NOTE [AUTO] Client-side analytics provider — REQ-ENTERPRISE-052
// Initializes PostHog and renders Vercel Analytics (Vercel-hosted builds only).
// Must be a client component; rendered once in root layout.

'use client';

import { initPostHog } from '@/lib/observability/posthog';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';

export function AnalyticsProvider() {
  useEffect(() => {
    initPostHog();
  }, []);

  // 2026-10-26 #540: the self-hosted deployment (docker next start on t3610,
  // regula.abyz-lab.work) has no Vercel edge — the injected
  // /_vercel/insights/script.js 404'd on every page load, throwing a console
  // error and a MIME error per navigation. Render the script only when the
  // build actually runs on Vercel (VERCEL=1 is set by the Vercel platform).
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    return null;
  }

  return <Analytics />;
}
