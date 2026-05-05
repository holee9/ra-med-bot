// @MX:NOTE Dev bootstrap tests — REQ-QUAL-026.
// Verifies idempotency, placeholder substitution, and that generated content
// includes the `dev-placeholder-*` markers lib/env.ts rejects in production.

import { describe, expect, it } from 'vitest';
import { generateEnvLocal, transformLine } from '../../../scripts/dev-bootstrap';

describe('transformLine', () => {
  it('preserves blank lines verbatim', () => {
    expect(transformLine('')).toBe('');
  });

  it('preserves comment lines verbatim', () => {
    const comment = '# --- Database (Postgres 16) ---';
    expect(transformLine(comment)).toBe(comment);
  });

  it('substitutes ANTHROPIC_API_KEY with the dev placeholder', () => {
    expect(transformLine('ANTHROPIC_API_KEY=sk-ant-replace-with-real-key')).toBe(
      'ANTHROPIC_API_KEY=dev-placeholder-anthropic',
    );
  });

  it('substitutes OPENAI_API_KEY with the dev placeholder', () => {
    expect(transformLine('OPENAI_API_KEY=sk-replace')).toBe(
      'OPENAI_API_KEY=dev-placeholder-openai',
    );
  });

  it('substitutes DATABASE_URL with the local Postgres default', () => {
    expect(transformLine('DATABASE_URL=postgresql://user:password@localhost:5432/regula')).toBe(
      'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/regula_dev',
    );
  });

  it('leaves keys without a registered placeholder unchanged', () => {
    expect(transformLine('NEXTAUTH_URL=http://localhost:3000')).toBe(
      'NEXTAUTH_URL=http://localhost:3000',
    );
  });

  it('substitutes Sentry/PostHog/Langfuse observability keys', () => {
    expect(transformLine('NEXT_PUBLIC_SENTRY_DSN=')).toContain('dev-placeholder-sentry');
    expect(transformLine('NEXT_PUBLIC_POSTHOG_KEY=')).toContain('dev-placeholder-posthog');
    expect(transformLine('LANGFUSE_PUBLIC_KEY=')).toContain('dev-placeholder-langfuse');
    expect(transformLine('LANGFUSE_SECRET_KEY=')).toContain('dev-placeholder-langfuse-secret');
  });
});

describe('generateEnvLocal', () => {
  const sampleExample = [
    '# Regula env example',
    'DATABASE_URL=postgresql://user:password@localhost:5432/regula',
    '',
    'AUTH_SECRET=replace-with-32-plus-character-random-string',
    'ANTHROPIC_API_KEY=sk-ant-replace-with-real-key',
    'OPENAI_API_KEY=sk-replace',
    'NEXT_PUBLIC_SENTRY_DSN=',
  ].join('\n');

  it('emits a do-not-commit header', () => {
    const out = generateEnvLocal(sampleExample);
    expect(out).toMatch(/DO NOT COMMIT/);
  });

  it('contains dev-placeholder-* markers for sensitive keys', () => {
    const out = generateEnvLocal(sampleExample);
    expect(out).toContain('ANTHROPIC_API_KEY=dev-placeholder-anthropic');
    expect(out).toContain('OPENAI_API_KEY=dev-placeholder-openai');
    expect(out).toContain('NEXT_PUBLIC_SENTRY_DSN=dev-placeholder-sentry');
  });

  it('rewrites DATABASE_URL to the local docker Postgres default', () => {
    const out = generateEnvLocal(sampleExample);
    expect(out).toContain('DATABASE_URL=postgresql://postgres:postgres@localhost:5432/regula_dev');
  });

  it('preserves the original line ordering of .env.example', () => {
    const out = generateEnvLocal(sampleExample);
    const dbIdx = out.indexOf('DATABASE_URL=');
    const authIdx = out.indexOf('AUTH_SECRET=');
    const anthropicIdx = out.indexOf('ANTHROPIC_API_KEY=');
    expect(dbIdx).toBeLessThan(authIdx);
    expect(authIdx).toBeLessThan(anthropicIdx);
  });

  it('produces idempotent output for the same input', () => {
    expect(generateEnvLocal(sampleExample)).toBe(generateEnvLocal(sampleExample));
  });
});
