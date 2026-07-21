// @MX:NOTE [AUTO] Schema smoke tests for SPEC-REGULA-RISK-001 Phase 0.
// @MX:SPEC SPEC-REGULA-RISK-001 (T0.1~T0.8)
// Tests run against source text — no DB connection required.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const schemaPath = path.resolve(__dirname, '../../kernel/db/schema.ts');
const schemaSource = fs.readFileSync(schemaPath, 'utf8');

const permissionsPath = path.resolve(__dirname, '../../kernel/auth/permissions.ts');
const permissionsSource = fs.readFileSync(permissionsPath, 'utf8');

// ---------------------------------------------------------------------------
// T0.1 — workflowTypeEnum includes 'risk'
// ---------------------------------------------------------------------------
describe('T0.1 — workflowTypeEnum includes risk', () => {
  it("workflowTypeEnum contains 'risk' value", () => {
    expect(schemaSource).toMatch(/'risk'/);
  });
});

// ---------------------------------------------------------------------------
// T0.2 — auditActionEnum includes 6 new risk actions
// ---------------------------------------------------------------------------
describe('T0.2 — auditActionEnum includes risk audit actions', () => {
  const riskActions = [
    'risk.hazard_identified',
    'risk.matrix_evaluated',
    'risk.control_adopted',
    'risk.residual_accepted',
    'risk.gspr_mapped',
    'risk.report_approved',
  ];

  for (const action of riskActions) {
    it(`auditActionEnum contains '${action}'`, () => {
      expect(schemaSource).toContain(`'${action}'`);
    });
  }
});

// ---------------------------------------------------------------------------
// T0.3 — riskLevelEnum and riskItems table
// ---------------------------------------------------------------------------
describe('T0.3 — riskItems table', () => {
  it('riskLevelEnum is declared', () => {
    expect(schemaSource).toMatch(/riskLevelEnum\s*=/);
  });

  it("riskLevelEnum contains 'acc', 'alarp', 'unacc'", () => {
    expect(schemaSource).toContain("'acc'");
    expect(schemaSource).toContain("'alarp'");
    expect(schemaSource).toContain("'unacc'");
  });

  it('riskItems table is exported', () => {
    expect(schemaSource).toMatch(/export const riskItems\s*=/);
  });

  it('riskItems has required columns: hazard, severity, probability', () => {
    // Check these columns exist near riskItems definition
    const riskItemsIdx = schemaSource.indexOf('export const riskItems');
    const riskItemsSlice = schemaSource.slice(riskItemsIdx, riskItemsIdx + 2000);
    expect(riskItemsSlice).toContain('hazard');
    expect(riskItemsSlice).toContain('severity');
    expect(riskItemsSlice).toContain('probability');
    expect(riskItemsSlice).toContain('sequenceOfEvents');
    expect(riskItemsSlice).toContain('hazardousSituation');
    expect(riskItemsSlice).toContain('harm');
    expect(riskItemsSlice).toContain('citation');
    expect(riskItemsSlice).toContain('lowConfidence');
  });
});

// ---------------------------------------------------------------------------
// T0.4 — controlTierEnum and riskControls table
// ---------------------------------------------------------------------------
describe('T0.4 — riskControls table', () => {
  it('controlTierEnum is declared', () => {
    expect(schemaSource).toMatch(/controlTierEnum\s*=/);
  });

  it("controlTierEnum contains 'inherent', 'protective', 'information'", () => {
    expect(schemaSource).toContain("'inherent'");
    expect(schemaSource).toContain("'protective'");
    expect(schemaSource).toContain("'information'");
  });

  it('riskControls table is exported', () => {
    expect(schemaSource).toMatch(/export const riskControls\s*=/);
  });

  it('riskControls has required columns', () => {
    const idx = schemaSource.indexOf('export const riskControls');
    const slice = schemaSource.slice(idx, idx + 2000);
    expect(slice).toContain('riskItemId');
    expect(slice).toContain('tier');
    expect(slice).toContain('description');
    expect(slice).toContain('isAdopted');
    expect(slice).toContain('residualSeverity');
    expect(slice).toContain('alarpJustification');
  });
});

// ---------------------------------------------------------------------------
// T0.5 — riskGsprMappings table
// ---------------------------------------------------------------------------
describe('T0.5 — riskGsprMappings table', () => {
  it('riskGsprMappings table is exported', () => {
    expect(schemaSource).toMatch(/export const riskGsprMappings\s*=/);
  });

  it('riskGsprMappings has gsprClause, requirement, compliance, evidence', () => {
    const idx = schemaSource.indexOf('export const riskGsprMappings');
    const slice = schemaSource.slice(idx, idx + 1500);
    expect(slice).toContain('gsprClause');
    expect(slice).toContain('requirement');
    expect(slice).toContain('compliance');
    expect(slice).toContain('evidence');
  });
});

// ---------------------------------------------------------------------------
// T0.8 — Permissions matrix includes risk actions
// ---------------------------------------------------------------------------
describe('T0.8 — Permissions matrix includes risk actions', () => {
  const riskPermissions = ['risk.generate', 'risk.view', 'risk.update', 'risk.approve'];

  for (const perm of riskPermissions) {
    it(`permissions.ts contains '${perm}'`, () => {
      expect(permissionsSource).toContain(`'${perm}'`);
    });
  }

  it("risk.approve requires minRole 'ra-lead'", () => {
    // Find the risk.approve entry and verify minRole
    const approveMatch = permissionsSource.match(/'risk\.approve':\s*\{[^}]*minRole:\s*'([^']+)'/);
    expect(approveMatch).not.toBeNull();
    expect(approveMatch?.[1]).toBe('ra-lead');
  });

  it("risk.generate requires minRole 'ra-member'", () => {
    const genMatch = permissionsSource.match(/'risk\.generate':\s*\{[^}]*minRole:\s*'([^']+)'/);
    expect(genMatch).not.toBeNull();
    expect(genMatch?.[1]).toBe('ra-member');
  });
});
