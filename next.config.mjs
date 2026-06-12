import createNextIntlPlugin from 'next-intl/plugin';
// @MX:NOTE Next.js 15 App Router configuration.
// REQ-FND-003: Next.js 15 pinned with React 18.
// REQ-ENTERPRISE-037: next-intl without i18n routing (cookie-based locale).
// Strict mode enabled across the app for early error surfacing.

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// SKIP_ENV_VALIDATION is injected by the build script (package.json) and the
// Dockerfile ENV, so we do not need a phase-function wrapper here.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output bundles only the minimal server runtime needed for
  // Docker deployment. Dev mode (pnpm dev) is unaffected.
  output: 'standalone',
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

export default withNextIntl(nextConfig);
