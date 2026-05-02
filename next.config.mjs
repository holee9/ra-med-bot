// @MX:NOTE Next.js 15 App Router configuration.
// REQ-FND-003: Next.js 15 pinned with React 18.
// Strict mode enabled across the app for early error surfacing.

/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default nextConfig;
