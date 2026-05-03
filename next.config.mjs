import createNextIntlPlugin from 'next-intl/plugin';
// @MX:NOTE Next.js 15 App Router configuration.
// REQ-FND-003: Next.js 15 pinned with React 18.
// REQ-ENTERPRISE-037: next-intl without i18n routing (cookie-based locale).
// Strict mode enabled across the app for early error surfacing.
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @param {string} phase @returns {import('next').NextConfig} */
function config(phase) {
  // During `next build`, route modules are imported to collect page data before
  // any real env vars are available. Inject SKIP_ENV_VALIDATION so lib/env.ts
  // bypasses Zod validation for that phase only. Runtime modes (dev, start)
  // never set this, so full validation is enforced there.
  if (phase === PHASE_PRODUCTION_BUILD) {
    process.env.SKIP_ENV_VALIDATION = '1';
  }

  return {
    reactStrictMode: true,
    poweredByHeader: false,
    // App Router is the default in Next.js 15; no `experimental.appDir` needed.
    experimental: {
      // Server Actions are GA in Next.js 15. Body size limit raised for
      // potential document upload payloads on the consult endpoint.
      serverActions: {
        bodySizeLimit: '4mb',
      },
    },
    // The `ai` SDK and several Radix packages ship ESM; transpile if needed.
    transpilePackages: [],
    // Images are not used in Phase 1 scaffolding; defaults are fine.
  };
}

export default withNextIntl(config);
