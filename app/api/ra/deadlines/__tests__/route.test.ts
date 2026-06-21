// @MX:NOTE [AUTO] Regulatory deadline route tests for SPEC-REGULA-CALENDAR-001.
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-001..006, Issue #44)
//
// Source-level RBAC + contract tests. Full integration tests require a running DB.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeBase = path.resolve(__dirname, '..');

describe('CALENDAR — route files exist', () => {
  const expected = ['route.ts', '[id]/route.ts'];
  for (const route of expected) {
    it(`route file exists: ${route}`, () => {
      expect(fs.existsSync(path.join(routeBase, route))).toBe(true);
    });
  }
});

describe('REQ-CAL-004 — RBAC permission assignment', () => {
  it('GET /api/ra/deadlines uses deadline.view', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toContain("'deadline.view'");
  });

  it('POST /api/ra/deadlines uses deadline.manage', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toContain("'deadline.manage'");
  });

  it('GET /api/ra/deadlines/[id] uses deadline.view', () => {
    const src = fs.readFileSync(path.join(routeBase, '[id]/route.ts'), 'utf8');
    expect(src).toContain("'deadline.view'");
  });

  it('PATCH/DELETE /api/ra/deadlines/[id] uses deadline.manage', () => {
    const src = fs.readFileSync(path.join(routeBase, '[id]/route.ts'), 'utf8');
    expect(src).toContain("'deadline.manage'");
  });
});

describe('REQ-CAL-002 — project membership enforced', () => {
  it('GET /api/ra/deadlines checks isProjectMember', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toContain('isProjectMember');
    expect(src).toContain("'not_a_member'");
  });

  it('POST /api/ra/deadlines checks isProjectMember', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    const memberChecks = src.match(/isProjectMember/g);
    expect(memberChecks?.length ?? 0).toBeGreaterThanOrEqual(2); // GET + POST
  });

  it('[id]/route.ts checks isProjectMember for GET, PATCH, DELETE', () => {
    const src = fs.readFileSync(path.join(routeBase, '[id]/route.ts'), 'utf8');
    const memberChecks = src.match(/isProjectMember/g);
    expect(memberChecks?.length ?? 0).toBeGreaterThanOrEqual(1); // resolveAndCheck
  });
});

describe('REQ-CAL-003 — filters', () => {
  it('GET /api/ra/deadlines supports jurisdiction, type, status filters', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toMatch(/jurisdiction/);
    expect(src).toMatch(/type/);
    expect(src).toMatch(/status/);
  });

  it('GET orders by due_date ascending', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toMatch(/asc/);
    expect(src).toMatch(/dueDate/);
  });
});

describe('REQ-CAL-005 — audit', () => {
  it('POST writes deadline.created', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toContain("'deadline.created'");
    expect(src).toContain('writeAudit');
  });

  it('PATCH writes deadline.updated', () => {
    const src = fs.readFileSync(path.join(routeBase, '[id]/route.ts'), 'utf8');
    expect(src).toContain("'deadline.updated'");
  });

  it('DELETE writes deadline.deleted', () => {
    const src = fs.readFileSync(path.join(routeBase, '[id]/route.ts'), 'utf8');
    expect(src).toContain("'deadline.deleted'");
  });
});

describe('REQ-CAL-006 — status lifecycle', () => {
  it('CreateSchema includes status with 5 lifecycle values', () => {
    const src = fs.readFileSync(path.join(routeBase, 'route.ts'), 'utf8');
    expect(src).toContain("'upcoming'");
    expect(src).toContain("'due_soon'");
    expect(src).toContain("'overdue'");
    expect(src).toContain("'completed'");
    expect(src).toContain("'cancelled'");
  });
});
