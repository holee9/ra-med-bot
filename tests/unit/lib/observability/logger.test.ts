/**
 * logger.test.ts — TASK-004 (SPEC-REGULA-RELEASE-HARDENING-001)
 *
 * Unit tests for lib/observability/logger.ts
 * - PII scrubbing: meta with sensitive fields → [REDACTED]
 * - Production JSON format via process.stdout
 * - Development passthrough via console.*
 * - Error serialization: Error object → {name, message} only
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Capture process.stdout.write calls and return the parsed JSON entries.
 * Used to validate production-mode structured output.
 */
function captureStdout(fn: () => void): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    // Each call writes a single JSON line terminated with \n
    for (const line of str.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) {
        entries.push(JSON.parse(trimmed) as Record<string, unknown>);
      }
    }
    return true;
  });
  fn();
  spy.mockRestore();
  return entries;
}

// ---------------------------------------------------------------------------
// Module isolation helpers — we need to re-import the module with different
// NODE_ENV values to test both branches.
// ---------------------------------------------------------------------------

async function importLoggerWithEnv(nodeEnv: string) {
  // Reset the module registry so the new import picks up the env change.
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  const mod = await import('@/lib/observability/logger');
  vi.unstubAllEnvs();
  return mod.logger;
}

// ---------------------------------------------------------------------------
// Tests: PII scrubbing
// ---------------------------------------------------------------------------

describe('PII scrubbing (production mode)', () => {
  it('masks email field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() =>
      prod.info('test', { email: 'user@example.com', name: 'Alice' }),
    );
    expect(entries).toHaveLength(1);
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.email).toBe('[REDACTED]');
    expect(meta.name).toBe('Alice');
  });

  it('masks password field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.warn('test', { password: 'secret123' }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.password).toBe('[REDACTED]');
  });

  it('masks token field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('test', { token: 'abc123' }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.token).toBe('[REDACTED]');
  });

  it('masks apiKey field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('test', { apiKey: 'key-xyz' }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.apiKey).toBe('[REDACTED]');
  });

  it('masks api_key field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('test', { api_key: 'key-xyz' }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.api_key).toBe('[REDACTED]');
  });

  it('masks secret field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('test', { secret: 'mysecret' }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.secret).toBe('[REDACTED]');
  });

  it('masks userId field', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('test', { userId: 'user-123' }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.userId).toBe('[REDACTED]');
  });

  it('passes through non-PII fields unchanged', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('test', { region: 'FDA', count: 42 }));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.region).toBe('FDA');
    expect(meta.count).toBe(42);
  });

  it('handles multiple PII fields in one meta object', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() =>
      prod.info('test', { email: 'a@b.com', token: 'tok', name: 'Bob' }),
    );
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.email).toBe('[REDACTED]');
    expect(meta.token).toBe('[REDACTED]');
    expect(meta.name).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// Tests: Production JSON format
// ---------------------------------------------------------------------------

describe('Production JSON format', () => {
  it('emits a valid JSON line with level, message, and ts fields', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('hello world'));
    expect(entries).toHaveLength(1);
    const entry = entries[0] as Record<string, unknown>;
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('hello world');
    expect(typeof entry.ts).toBe('string');
    // ts must be a valid ISO-8601 date
    expect(new Date(entry.ts as string).toISOString()).toBe(entry.ts);
  });

  it('emits warn level correctly', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.warn('something off'));
    expect((entries[0] as Record<string, unknown>).level).toBe('warn');
  });

  it('emits error level correctly', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.error('boom'));
    expect((entries[0] as Record<string, unknown>).level).toBe('error');
  });

  it('omits meta key when no meta provided', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.info('no meta'));
    expect(entries[0]).not.toHaveProperty('meta');
  });
});

// ---------------------------------------------------------------------------
// Tests: Development passthrough (console.*)
// ---------------------------------------------------------------------------

describe('Development passthrough', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls console.info in development mode', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const dev = await importLoggerWithEnv('development');
    dev.info('dev message');
    expect(spy).toHaveBeenCalledWith('dev message');
    spy.mockRestore();
  });

  it('calls console.warn in development mode', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dev = await importLoggerWithEnv('development');
    dev.warn('dev warn');
    expect(spy).toHaveBeenCalledWith('dev warn');
    spy.mockRestore();
  });

  it('calls console.error in development mode', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dev = await importLoggerWithEnv('development');
    dev.error('dev error');
    expect(spy).toHaveBeenCalledWith('dev error');
    spy.mockRestore();
  });

  it('calls console.debug in development mode', async () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const dev = await importLoggerWithEnv('development');
    dev.debug('dev debug');
    expect(spy).toHaveBeenCalledWith('dev debug');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tests: Error serialization
// ---------------------------------------------------------------------------

describe('Error serialization', () => {
  it('serializes Error objects to name + message in production', async () => {
    const prod = await importLoggerWithEnv('production');
    const err = new TypeError('something broke');
    const entries = captureStdout(() => prod.error('oops', err));
    const entry = entries[0] as Record<string, unknown>;
    // Raw stack trace must NOT appear
    expect(JSON.stringify(entry)).not.toContain('stack');
    // Error fields are emitted under entry.meta (combined into the meta object)
    const meta = entry.meta as Record<string, unknown>;
    expect(meta.name).toBe('TypeError');
    expect(meta.message).toBe('something broke');
  });

  it('serializes unknown thrown values (strings) gracefully', async () => {
    const prod = await importLoggerWithEnv('production');
    const entries = captureStdout(() => prod.error('oops', 'plain string error'));
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.raw).toBe('plain string error');
  });

  it('merges error serialization with additional meta', async () => {
    const prod = await importLoggerWithEnv('production');
    const err = new Error('net error');
    const entries = captureStdout(() => prod.error('request failed', err, { url: '/api/test' }));
    // Error fields and additional meta are merged into entry.meta
    const meta = (entries[0] as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.message).toBe('net error');
    expect(meta.url).toBe('/api/test');
  });
});
