// @MX:NOTE Env validation tests — REQ-FND-010a fail-fast guarantee.

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { parseEnv } from '../../lib/env';

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/regula',
  AUTH_SECRET: 'a'.repeat(32),
  NEXTAUTH_URL: 'http://localhost:3000',
  AUTH_MICROSOFT_ID: 'ms-id',
  AUTH_MICROSOFT_SECRET: 'ms-secret',
  AUTH_GOOGLE_ID: 'g-id',
  AUTH_GOOGLE_SECRET: 'g-secret',
  // Phase 2 LLM provider keys — required by lib/env.ts envSchema.
  ANTHROPIC_API_KEY: 'sk-ant-test',
  OPENAI_API_KEY: 'sk-test',
};

describe('parseEnv', () => {
  it('parses a fully-populated env successfully', () => {
    const env = parseEnv(validEnv);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.AUTH_SECRET).toHaveLength(32);
  });

  it('throws ZodError when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(ZodError);
  });

  it('throws ZodError when AUTH_SECRET is shorter than 32 chars', () => {
    expect(() => parseEnv({ ...validEnv, AUTH_SECRET: 'short' })).toThrow(ZodError);
  });

  it('throws ZodError when DATABASE_URL is not a URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow(ZodError);
  });

  it('throws ZodError when both Microsoft env-var aliases are missing', () => {
    const { AUTH_MICROSOFT_ID: _omit, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(ZodError);
  });

  it('accepts AUTH_MICROSOFT_ENTRA_ID as an alias for AUTH_MICROSOFT_ID', () => {
    const { AUTH_MICROSOFT_ID: _omit, ...rest } = validEnv;
    const env = parseEnv({ ...rest, AUTH_MICROSOFT_ENTRA_ID: 'ms-entra' });
    expect(env.AUTH_MICROSOFT_ID).toBe('ms-entra');
  });

  it('accepts AZURE_AD_CLIENT_ID as an alias for AUTH_MICROSOFT_ID', () => {
    const { AUTH_MICROSOFT_ID: _omit, ...rest } = validEnv;
    const env = parseEnv({ ...rest, AZURE_AD_CLIENT_ID: 'azure-id' });
    expect(env.AUTH_MICROSOFT_ID).toBe('azure-id');
  });

  it('reports every missing field at once (Zod aggregate errors)', () => {
    try {
      parseEnv({ NODE_ENV: 'test' });
      throw new Error('parseEnv should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const issues = (err as ZodError).issues;
      // At minimum DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, both Google keys,
      // and the Microsoft pair should each surface an issue.
      expect(issues.length).toBeGreaterThanOrEqual(6);
    }
  });
});
