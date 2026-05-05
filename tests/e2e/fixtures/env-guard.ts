// @MX:NOTE [AUTO] Shared environment guard helpers for Playwright E2E specs.
// @MX:SPEC SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

export function requiresLiveServer(): { skip: boolean; reason: string } {
  const skip = process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL;
  return {
    skip,
    reason: skip ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)' : '',
  };
}

export function requiresAuthState(): { skip: boolean; reason: string } {
  const skip = !process.env.PLAYWRIGHT_AUTH_STATE && !process.env.PLAYWRIGHT_SESSION_TOKEN;
  return {
    skip,
    reason: skip
      ? 'Requires authenticated session (set PLAYWRIGHT_AUTH_STATE or PLAYWRIGHT_SESSION_TOKEN)'
      : '',
  };
}
