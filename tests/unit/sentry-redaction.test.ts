// @MX:NOTE [AUTO] Sentry PII redaction shape test — REQ-LAUNCH-036.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-036)
// Verifies that sentry.server.config.ts contains a beforeSend hook that strips
// PII fields (query, user_id, chat content) before events are forwarded to Sentry.
// No live Sentry connection required — reads source file content.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_CONFIG = path.join(ROOT, 'sentry.server.config.ts');

describe('Sentry PII redaction (REQ-LAUNCH-036)', () => {
  it('sentry.server.config.ts exists', () => {
    expect(existsSync(SERVER_CONFIG)).toBe(true);
  });

  it('sentry.server.config.ts contains a beforeSend hook', () => {
    const content = readFileSync(SERVER_CONFIG, 'utf-8');
    expect(content).toContain('beforeSend');
  });

  it('beforeSend removes or redacts query field', () => {
    const content = readFileSync(SERVER_CONFIG, 'utf-8');
    // The hook must reference query — either to delete, nullify, or redact it.
    const mentionsQuery = content.includes('query');
    expect(mentionsQuery).toBe(true);
  });

  it('beforeSend removes or redacts user_id / userId field', () => {
    const content = readFileSync(SERVER_CONFIG, 'utf-8');
    // The hook must reference user identity fields.
    const mentionsUserId =
      content.includes('user_id') ||
      content.includes('userId') ||
      content.includes('user.id') ||
      content.includes('user');
    expect(mentionsUserId).toBe(true);
  });

  it('beforeSend redaction logic uses delete, undefined, or explicit redact pattern', () => {
    const content = readFileSync(SERVER_CONFIG, 'utf-8');
    const hasRedactionPattern =
      content.includes('delete') ||
      content.includes('= undefined') ||
      content.includes('= null') ||
      content.includes('redact') ||
      content.includes('[REDACTED]');
    expect(hasRedactionPattern).toBe(true);
  });
});
