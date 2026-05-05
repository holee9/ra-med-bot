// Unit tests for env-guard helpers.
// Uses vitest (not Playwright runner).
// @MX:SPEC SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requiresAuthState, requiresLiveServer } from './env-guard';

describe('requiresLiveServer', () => {
  const savedCI = process.env.CI;
  const savedBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

  beforeEach(() => {
    // biome-ignore lint/performance/noDelete: env cleanup in tests requires delete
    delete process.env.CI;
    // biome-ignore lint/performance/noDelete: env cleanup in tests requires delete
    delete process.env.PLAYWRIGHT_BASE_URL;
  });

  afterEach(() => {
    if (savedCI !== undefined) process.env.CI = savedCI;
    // biome-ignore lint/performance/noDelete: env restore in tests requires delete
    else delete process.env.CI;
    if (savedBaseUrl !== undefined) process.env.PLAYWRIGHT_BASE_URL = savedBaseUrl;
    // biome-ignore lint/performance/noDelete: env restore in tests requires delete
    else delete process.env.PLAYWRIGHT_BASE_URL;
  });

  it('returns skip=false when CI=true', () => {
    process.env.CI = 'true';
    const result = requiresLiveServer();
    expect(result.skip).toBe(false);
    expect(result.reason).toBe('');
  });

  it('returns skip=false when PLAYWRIGHT_BASE_URL is set', () => {
    process.env.PLAYWRIGHT_BASE_URL = 'http://localhost:3000';
    const result = requiresLiveServer();
    expect(result.skip).toBe(false);
    expect(result.reason).toBe('');
  });

  it('returns skip=true when neither CI nor PLAYWRIGHT_BASE_URL is set', () => {
    const result = requiresLiveServer();
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('Requires running Next.js server');
  });
});

describe('requiresAuthState', () => {
  const savedAuthState = process.env.PLAYWRIGHT_AUTH_STATE;
  const savedSessionToken = process.env.PLAYWRIGHT_SESSION_TOKEN;

  beforeEach(() => {
    // biome-ignore lint/performance/noDelete: env cleanup in tests requires delete
    delete process.env.PLAYWRIGHT_AUTH_STATE;
    // biome-ignore lint/performance/noDelete: env cleanup in tests requires delete
    delete process.env.PLAYWRIGHT_SESSION_TOKEN;
  });

  afterEach(() => {
    if (savedAuthState !== undefined) process.env.PLAYWRIGHT_AUTH_STATE = savedAuthState;
    // biome-ignore lint/performance/noDelete: env restore in tests requires delete
    else delete process.env.PLAYWRIGHT_AUTH_STATE;
    if (savedSessionToken !== undefined) process.env.PLAYWRIGHT_SESSION_TOKEN = savedSessionToken;
    // biome-ignore lint/performance/noDelete: env restore in tests requires delete
    else delete process.env.PLAYWRIGHT_SESSION_TOKEN;
  });

  it('returns skip=false when PLAYWRIGHT_AUTH_STATE is set', () => {
    process.env.PLAYWRIGHT_AUTH_STATE = 'tests/e2e/fixtures/.auth.json';
    const result = requiresAuthState();
    expect(result.skip).toBe(false);
    expect(result.reason).toBe('');
  });

  it('returns skip=false when PLAYWRIGHT_SESSION_TOKEN is set', () => {
    process.env.PLAYWRIGHT_SESSION_TOKEN = 'some-token';
    const result = requiresAuthState();
    expect(result.skip).toBe(false);
    expect(result.reason).toBe('');
  });

  it('returns skip=true when neither env is set', () => {
    const result = requiresAuthState();
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('Requires authenticated session');
  });
});
