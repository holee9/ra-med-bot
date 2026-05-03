// @MX:NOTE [AUTO] T-003 RED phase — RBAC coverage script unit tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { describe, expect, it } from 'vitest';

// These functions will be extracted from the script for testability.
// They are imported after the script is created in the GREEN phase.
import { isCompliant, isExempt, parseExemptPatterns } from '../../../scripts/qa/rbac-coverage';

describe('rbac-coverage — isExempt()', () => {
  const patterns = ['app/api/auth/**', 'app/api/health/**'];

  it('returns true for auth routes', () => {
    expect(isExempt('app/api/auth/callback/route.ts', patterns)).toBe(true);
  });

  it('returns true for health routes', () => {
    expect(isExempt('app/api/health/route.ts', patterns)).toBe(true);
  });

  it('returns false for non-exempt routes', () => {
    expect(isExempt('app/api/ra/consult/route.ts', patterns)).toBe(false);
  });

  it('returns false for routes that start with auth but are not in the pattern', () => {
    expect(isExempt('app/api/ra/auth-check/route.ts', patterns)).toBe(false);
  });
});

describe('rbac-coverage — isCompliant()', () => {
  it('flags plain export async function POST as violation', () => {
    const content = `
export async function POST(req: Request) {
  return Response.json({ ok: true });
}
    `;
    expect(isCompliant(content)).toBe(false);
  });

  it('flags plain export async function GET as violation', () => {
    const content = `
export async function GET(_req: Request) {
  return Response.json({ data: [] });
}
    `;
    expect(isCompliant(content)).toBe(false);
  });

  it('flags plain export async function DELETE as violation', () => {
    const content = `
export async function DELETE(req: Request) {
  return Response.json({ deleted: true });
}
    `;
    expect(isCompliant(content)).toBe(false);
  });

  it('passes for withPermission-wrapped export const GET', () => {
    const content = `
export const GET = withPermission('conversation.view', async (req, ctx, session) => {
  return Response.json({ data: [] });
});
    `;
    expect(isCompliant(content)).toBe(true);
  });

  it('passes for withPermission-wrapped export const POST', () => {
    const content = `
export const POST = withPermission('consult.create', async (req, ctx, session) => {
  return Response.json({ ok: true });
});
    `;
    expect(isCompliant(content)).toBe(true);
  });

  it('passes for file with no HTTP method exports at all', () => {
    const content = `
// utility module with no route exports
export function helper() { return 42; }
    `;
    expect(isCompliant(content)).toBe(true);
  });

  it('detects violation when only some exports are wrapped', () => {
    const content = `
export const GET = withPermission('dashboard.view', async (req, ctx, session) => {
  return Response.json({});
});

export async function POST(req: Request) {
  return Response.json({ ok: true });
}
    `;
    expect(isCompliant(content)).toBe(false);
  });
});

describe('rbac-coverage — parseExemptPatterns()', () => {
  it('extracts exempt_patterns from whitelist JSON', () => {
    const whitelist = { exempt_patterns: ['app/api/auth/**', 'app/api/health/**'] };
    expect(parseExemptPatterns(whitelist)).toEqual(['app/api/auth/**', 'app/api/health/**']);
  });

  it('returns empty array when exempt_patterns is missing', () => {
    expect(parseExemptPatterns({})).toEqual([]);
  });
});
