// @MX:NOTE [AUTO] Personal library route tests for SPEC-REGULA-PERSONAL-LIB-001.
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-001..008, Issue #86)
//
// Source-level RBAC + contract tests. Full integration tests require a running DB;
// these verify that every route enforces the privacy invariant and correct permission.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeBase = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Route files exist
// ---------------------------------------------------------------------------
describe('PERSONAL-LIB — route files exist', () => {
  const expected = ['bookmarks/route.ts', 'bookmarks/[id]/route.ts', 'tags/route.ts'];

  for (const route of expected) {
    it(`route file exists: ${route}`, () => {
      expect(fs.existsSync(path.join(routeBase, route))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-007 — every route uses personal.view permission (user scope)
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-007 — all routes enforce personal.view', () => {
  const routes = ['bookmarks/route.ts', 'bookmarks/[id]/route.ts', 'tags/route.ts'];

  for (const route of routes) {
    it(`${route} uses withPermission('personal.view')`, () => {
      const src = fs.readFileSync(path.join(routeBase, route), 'utf8');
      expect(src).toContain("'personal.view'");
    });
  }
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-002 — privacy invariant: every query filters by session.user.id
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-002 — userId isolation in queries', () => {
  it('bookmarks/route.ts GET filters by userId', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/route.ts'), 'utf8');
    expect(src).toContain('personalBookmarks.userId, session.user.id');
  });

  it('bookmarks/route.ts POST inserts session.user.id as userId', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/route.ts'), 'utf8');
    expect(src).toMatch(/userId:\s*session\.user\.id/);
  });

  it('bookmarks/[id]/route.ts GET filters by userId', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/[id]/route.ts'), 'utf8');
    // Every query in this file must include the userId condition.
    const userIdChecks = src.match(/personalBookmarks\.userId, session\.user\.id/g);
    expect(userIdChecks?.length ?? 0).toBeGreaterThanOrEqual(3); // GET + PATCH + DELETE
  });

  it('bookmarks/[id]/route.ts returns 404 (not 403) when not found', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/[id]/route.ts'), 'utf8');
    expect(src).toContain("'not_found'");
    expect(src).toContain('status: 404');
  });

  it('tags/route.ts filters by userId', () => {
    const src = fs.readFileSync(path.join(routeBase, 'tags/route.ts'), 'utf8');
    expect(src).toContain('personalBookmarks.userId, session.user.id');
  });
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-001 — create accepts message-level and block-level bookmarks
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-001 — create schema', () => {
  it('bookmarks/route.ts POST schema includes messageId, blockId, title, tags, note', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/route.ts'), 'utf8');
    expect(src).toContain('messageId:');
    expect(src).toContain('blockId:');
    expect(src).toContain('title:');
    expect(src).toContain('tags:');
    expect(src).toContain('note:');
  });
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-003 — tag filtering via overlaps
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-003 — tag filter', () => {
  it('bookmarks/route.ts GET supports tag filter via PostgreSQL array overlap', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/route.ts'), 'utf8');
    // PostgreSQL && operator for array overlap.
    expect(src).toMatch(/&&/);
  });
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-004 — search over title, note, tags
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-004 — search', () => {
  it('bookmarks/route.ts GET searches title, customTitle, note, tags', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/route.ts'), 'utf8');
    expect(src).toContain('ilike');
    expect(src).toMatch(/customTitle/);
  });
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-006 — audit on create and delete
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-006 — audit', () => {
  it('bookmarks/route.ts POST writes personal_bookmark.created audit', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/route.ts'), 'utf8');
    expect(src).toContain("'personal_bookmark.created'");
    expect(src).toContain('writeAudit');
  });

  it('bookmarks/[id]/route.ts DELETE writes personal_bookmark.deleted audit', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/[id]/route.ts'), 'utf8');
    expect(src).toContain("'personal_bookmark.deleted'");
    expect(src).toContain('writeAudit');
  });
});

// ---------------------------------------------------------------------------
// REQ-PERSONAL-005 — note is editable independently (PATCH route exists)
// ---------------------------------------------------------------------------
describe('REQ-PERSONAL-005 — note editing', () => {
  it('bookmarks/[id]/route.ts PATCH supports note, tags, customTitle', () => {
    const src = fs.readFileSync(path.join(routeBase, 'bookmarks/[id]/route.ts'), 'utf8');
    expect(src).toMatch(/customTitle/);
    expect(src).toMatch(/note:/);
    expect(src).toMatch(/tags:/);
  });
});
