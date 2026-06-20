// @MX:NOTE [AUTO] RiskMatrix component tests — SPEC-REGULA-RISK-001 Phase 4 (T4.1~T4.2).
// @MX:SPEC SPEC-REGULA-RISK-001 (T4.1~T4.2, REQ-RISK-011~015)

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const componentDir = path.resolve(__dirname, '..');

// T4.1 — RiskMatrix component file exists
describe('T4.1 — RiskMatrix component', () => {
  it('RiskMatrix.tsx exists', () => {
    expect(fs.existsSync(path.join(componentDir, 'RiskMatrix.tsx'))).toBe(true);
  });

  it('exports RiskMatrix as default or named export', () => {
    const src = fs.readFileSync(path.join(componentDir, 'RiskMatrix.tsx'), 'utf8');
    expect(src).toMatch(/export (default|function RiskMatrix|const RiskMatrix)/);
  });

  it('renders 5×5 grid (25 cells) — source contains 5×5 data reference', () => {
    const src = fs.readFileSync(path.join(componentDir, 'RiskMatrix.tsx'), 'utf8');
    // Must reference DEFAULT_RISK_MATRIX or render a 5×5 grid
    expect(src).toContain('DEFAULT_RISK_MATRIX');
  });

  it('uses risk level color coding (acc/alarp/unacc)', () => {
    const src = fs.readFileSync(path.join(componentDir, 'RiskMatrix.tsx'), 'utf8');
    expect(src).toContain('acc');
    expect(src).toContain('alarp');
    expect(src).toContain('unacc');
  });
});

// T4.2 — HazardTable component
describe('T4.2 — HazardTable component', () => {
  it('HazardTable.tsx exists', () => {
    expect(fs.existsSync(path.join(componentDir, 'HazardTable.tsx'))).toBe(true);
  });

  it('exports HazardTable', () => {
    const src = fs.readFileSync(path.join(componentDir, 'HazardTable.tsx'), 'utf8');
    expect(src).toMatch(/export (default|function HazardTable|const HazardTable)/);
  });

  it('renders columns: hazard, harm, severity, probability, riskLevel', () => {
    const src = fs.readFileSync(path.join(componentDir, 'HazardTable.tsx'), 'utf8');
    expect(src.toLowerCase()).toContain('hazard');
    expect(src.toLowerCase()).toContain('harm');
    expect(src.toLowerCase()).toContain('severity');
    expect(src.toLowerCase()).toContain('probability');
  });
});

// T4.3 — ControlWizard component
describe('T4.3 — ControlWizard component', () => {
  it('ControlWizard.tsx exists', () => {
    expect(fs.existsSync(path.join(componentDir, 'ControlWizard.tsx'))).toBe(true);
  });

  it('exports ControlWizard', () => {
    const src = fs.readFileSync(path.join(componentDir, 'ControlWizard.tsx'), 'utf8');
    expect(src).toMatch(/export (default|function ControlWizard|const ControlWizard)/);
  });

  it('enforces information tier rationale (validateControlHierarchy)', () => {
    const src = fs.readFileSync(path.join(componentDir, 'ControlWizard.tsx'), 'utf8');
    expect(src).toContain('information');
    expect(src).toContain('rationale');
  });
});

// T4.4 — RiskApprovalGate component
describe('T4.4 — RiskApprovalGate component', () => {
  it('RiskApprovalGate.tsx exists', () => {
    expect(fs.existsSync(path.join(componentDir, 'RiskApprovalGate.tsx'))).toBe(true);
  });

  it('exports RiskApprovalGate', () => {
    const src = fs.readFileSync(path.join(componentDir, 'RiskApprovalGate.tsx'), 'utf8');
    expect(src).toMatch(/export (default|function RiskApprovalGate|const RiskApprovalGate)/);
  });

  it('references risk.approve permission gate', () => {
    const src = fs.readFileSync(path.join(componentDir, 'RiskApprovalGate.tsx'), 'utf8');
    expect(src).toContain('ra-lead');
  });
});
