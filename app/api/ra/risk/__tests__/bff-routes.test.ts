// @MX:NOTE [AUTO] BFF route tests for SPEC-REGULA-RISK-001 Phase 2.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.1~T2.10)
// Tests verify RBAC enforcement and source-level route existence.
// Full integration tests require a running DB; these are smoke + RBAC tests.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeBase = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// T2.1 — Source-level: all required route files exist
// ---------------------------------------------------------------------------
describe('T2.1~T2.10 — BFF route files exist', () => {
  const expectedRoutes = [
    'runs/route.ts',
    'runs/[id]/route.ts',
    'identify/route.ts',
    'items/[id]/route.ts',
    'items/[id]/evaluate/route.ts',
    'controls/recommend/route.ts',
    'controls/[id]/route.ts',
    'runs/[id]/gspr/route.ts',
    'runs/[id]/export/route.ts',
    'runs/[id]/approve/route.ts',
  ];

  for (const route of expectedRoutes) {
    it(`route file exists: ${route}`, () => {
      const fullPath = path.join(routeBase, route);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// T2.10 — Source-level: approve route uses risk.approve permission (ra-lead ONLY)
// ---------------------------------------------------------------------------
describe('T2.10 — approve route enforces ra-lead permission', () => {
  it('runs/[id]/approve/route.ts uses withPermission("risk.approve")', () => {
    const src = fs.readFileSync(path.join(routeBase, 'runs/[id]/approve/route.ts'), 'utf8');
    expect(src).toContain("'risk.approve'");
    // Must NOT use risk.generate or risk.update (would allow ra-member)
    expect(src).not.toContain("'risk.generate'");
    expect(src).not.toContain("'risk.update'");
  });
});

// ---------------------------------------------------------------------------
// T2.1 — Source-level: runs POST uses risk.generate
// ---------------------------------------------------------------------------
describe('T2.1 — runs route uses risk.generate permission', () => {
  it('runs/route.ts uses withPermission("risk.generate")', () => {
    const src = fs.readFileSync(path.join(routeBase, 'runs/route.ts'), 'utf8');
    expect(src).toContain("'risk.generate'");
  });
});

// ---------------------------------------------------------------------------
// T2.9 — Source-level: export route exists and generates DOCX
// ---------------------------------------------------------------------------
describe('T2.9 — export route', () => {
  it('runs/[id]/export/route.ts uses risk.generate or risk.view permission', () => {
    const src = fs.readFileSync(path.join(routeBase, 'runs/[id]/export/route.ts'), 'utf8');
    // Export can be triggered by ra-member (generate) or read (view)
    expect(src).toMatch(/'risk\.(generate|view)'/);
  });

  it('runs/[id]/export/route.ts references report-builder', () => {
    const src = fs.readFileSync(path.join(routeBase, 'runs/[id]/export/route.ts'), 'utf8');
    expect(src).toContain('report-builder');
  });
});

// ---------------------------------------------------------------------------
// T2.2 — Source-level: identify route audits risk.hazard_identified
// ---------------------------------------------------------------------------
describe('T2.2 — identify route audit action', () => {
  it('identify/route.ts references risk.hazard_identified audit action', () => {
    const src = fs.readFileSync(path.join(routeBase, 'identify/route.ts'), 'utf8');
    expect(src).toContain('risk.hazard_identified');
  });
});

// ---------------------------------------------------------------------------
// T2.8 — Source-level: gspr route audits risk.gspr_mapped
// ---------------------------------------------------------------------------
describe('T2.8 — GSPR route audit action', () => {
  it('runs/[id]/gspr/route.ts references risk.gspr_mapped audit action', () => {
    const src = fs.readFileSync(path.join(routeBase, 'runs/[id]/gspr/route.ts'), 'utf8');
    expect(src).toContain('risk.gspr_mapped');
  });
});
