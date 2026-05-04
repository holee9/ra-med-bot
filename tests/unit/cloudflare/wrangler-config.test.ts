// Tests for wrangler.toml shape and open-next.config.ts structure
// RED: These tests verify the config files exist and have required bindings

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../../');

function readWranglerToml(): string {
  return readFileSync(resolve(PROJECT_ROOT, 'wrangler.toml'), 'utf-8');
}

describe('wrangler.toml', () => {
  it('should exist at project root', () => {
    expect(() => readWranglerToml()).not.toThrow();
  });

  it('should define name = "regula"', () => {
    const content = readWranglerToml();
    expect(content).toMatch(/^name\s*=\s*"regula"/m);
  });

  it('should define compatibility_date = "2026-04-22"', () => {
    const content = readWranglerToml();
    expect(content).toMatch(/compatibility_date\s*=\s*"2026-04-22"/);
  });

  it('should include nodejs_compat flag', () => {
    const content = readWranglerToml();
    expect(content).toMatch(/nodejs_compat/);
  });

  it('should define 4 KV namespaces', () => {
    const content = readWranglerToml();
    expect(content).toContain('SESSION_KV');
    expect(content).toContain('RATELIMIT_KV');
    expect(content).toContain('FLAGS_KV');
    expect(content).toContain('LOCALE_KV');
  });

  it('should define 5 R2 buckets', () => {
    const content = readWranglerToml();
    expect(content).toContain('CORPUS_PUBLIC');
    expect(content).toContain('CORPUS_INTERNAL');
    expect(content).toContain('AUDIT_COLD');
    expect(content).toContain('ASSETS');
    expect(content).toContain('OPENNEXT_CACHE');
  });

  it('should define 5 Vectorize indexes', () => {
    const content = readWranglerToml();
    expect(content).toContain('FDA_PUBLIC');
    expect(content).toContain('EU_MDR_PUBLIC');
    expect(content).toContain('MFDS_PUBLIC');
    expect(content).toContain('NMPA_PUBLIC');
    expect(content).toContain('PMDA_PUBLIC');
  });

  it('should define 4 queue producers', () => {
    const content = readWranglerToml();
    expect(content).toContain('AUDIT_ARCHIVE_QUEUE');
    expect(content).toContain('CORPUS_UPDATE_QUEUE');
    expect(content).toContain('NOTIFICATION_QUEUE');
    expect(content).toContain('LANGFUSE_FLUSH_QUEUE');
  });

  it('should define cron triggers', () => {
    const content = readWranglerToml();
    expect(content).toMatch(/crons\s*=/);
  });

  it('should define production and preview environments', () => {
    const content = readWranglerToml();
    expect(content).toContain('[env.production]');
    expect(content).toContain('[env.preview]');
  });
});

describe('open-next.config.ts', () => {
  it('should exist at project root', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'open-next.config.ts'), 'utf-8');
    expect(content).toBeTruthy();
  });

  it('should reference cloudflare-node wrapper', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'open-next.config.ts'), 'utf-8');
    expect(content).toContain('cloudflare-node');
  });

  it('should reference OPENNEXT_CACHE bucket binding', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'open-next.config.ts'), 'utf-8');
    expect(content).toContain('OPENNEXT_CACHE');
  });
});

describe('lib/cloudflare/env.d.ts', () => {
  it('should exist and export CloudflareEnv interface', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'lib/cloudflare/env.d.ts'), 'utf-8');
    expect(content).toContain('CloudflareEnv');
  });

  it('should declare all KV namespace bindings', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'lib/cloudflare/env.d.ts'), 'utf-8');
    expect(content).toContain('SESSION_KV: KVNamespace');
    expect(content).toContain('RATELIMIT_KV: KVNamespace');
    expect(content).toContain('FLAGS_KV: KVNamespace');
    expect(content).toContain('LOCALE_KV: KVNamespace');
  });

  it('should declare all R2 bucket bindings', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'lib/cloudflare/env.d.ts'), 'utf-8');
    expect(content).toContain('CORPUS_PUBLIC: R2Bucket');
    expect(content).toContain('CORPUS_INTERNAL: R2Bucket');
    expect(content).toContain('AUDIT_COLD: R2Bucket');
    expect(content).toContain('ASSETS: R2Bucket');
    expect(content).toContain('OPENNEXT_CACHE: R2Bucket');
  });

  it('should declare Vectorize indexes', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'lib/cloudflare/env.d.ts'), 'utf-8');
    expect(content).toContain('FDA_PUBLIC: VectorizeIndex');
    expect(content).toContain('EU_MDR_PUBLIC: VectorizeIndex');
  });

  it('should declare all Queue bindings', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'lib/cloudflare/env.d.ts'), 'utf-8');
    expect(content).toContain('AUDIT_ARCHIVE_QUEUE: Queue');
    expect(content).toContain('CORPUS_UPDATE_QUEUE: Queue');
    expect(content).toContain('NOTIFICATION_QUEUE: Queue');
    expect(content).toContain('LANGFUSE_FLUSH_QUEUE: Queue');
  });

  it('should declare HIPAA BAA flag env var', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, 'lib/cloudflare/env.d.ts'), 'utf-8');
    expect(content).toContain('HIPAA_BAA_CONFIRMED');
  });
});
