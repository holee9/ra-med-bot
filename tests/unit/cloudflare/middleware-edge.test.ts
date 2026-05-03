// Tests for middleware-edge.ts
// RED: verify noindex behavior, /login whitelist, no @vercel/edge imports

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../../');

// ── File-shape tests (static analysis) ───────────────────────────────────────

describe('middleware-edge.ts static shape', () => {
  it('should exist at project root', () => {
    expect(() =>
      readFileSync(resolve(PROJECT_ROOT, 'middleware-edge.ts'), 'utf-8'),
    ).not.toThrow();
  });

  it('should NOT import @vercel/edge (REQ-CF-009)', () => {
    const content = readFileSync(
      resolve(PROJECT_ROOT, 'middleware-edge.ts'),
      'utf-8',
    );
    // Check that there is no actual import statement for @vercel/edge
    expect(content).not.toMatch(/from ['"]@vercel\/edge['"]/);
    expect(content).not.toMatch(/import\s+.*['"]@vercel\/edge['"]/);
  });

  it('should NOT import @vercel/og (REQ-CF-009)', () => {
    const content = readFileSync(
      resolve(PROJECT_ROOT, 'middleware-edge.ts'),
      'utf-8',
    );
    expect(content).not.toMatch(/from ['"]@vercel\/og['"]/);
    expect(content).not.toMatch(/import\s+.*['"]@vercel\/og['"]/);
  });

  it('should export a default function and config object', () => {
    const content = readFileSync(
      resolve(PROJECT_ROOT, 'middleware-edge.ts'),
      'utf-8',
    );
    expect(content).toContain('export default');
    expect(content).toContain('export const config');
  });
});

// ── Behavioral tests ──────────────────────────────────────────────────────────

// Minimal edge-compatible Request/Response stubs for unit testing
function makeRequest(pathname: string, sessionCookie?: string): Request {
  const url = `https://app.regula.com${pathname}`;
  const headers = new Headers();
  if (sessionCookie) {
    headers.set('cookie', `authjs.session-token=${sessionCookie}`);
  }
  return new Request(url, { headers });
}

describe('middleware-edge noindex header', () => {
  let middlewareFn: (req: Request) => Response | Promise<Response>;

  beforeEach(async () => {
    // Dynamically import so each test gets fresh module
    const mod = await import('../../../middleware-edge');
    middlewareFn = mod.default;
  });

  it('should add X-Robots-Tag: noindex to gated routes', async () => {
    const req = makeRequest('/dashboard', 'valid-token');
    const res = await middlewareFn(req);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('should NOT add X-Robots-Tag to /login (whitelist)', async () => {
    const req = makeRequest('/login');
    const res = await middlewareFn(req);
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });
});

describe('middleware-edge auth redirect', () => {
  let middlewareFn: (req: Request) => Response | Promise<Response>;

  beforeEach(async () => {
    const mod = await import('../../../middleware-edge');
    middlewareFn = mod.default;
  });

  it('should redirect unauthenticated requests to /login', async () => {
    const req = makeRequest('/dashboard');
    const res = await middlewareFn(req);
    // Redirect responses have location header
    const location = res.headers.get('location');
    expect(location).toContain('/login');
  });
});
