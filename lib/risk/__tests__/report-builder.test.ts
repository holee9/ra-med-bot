// @MX:NOTE [AUTO] Unit tests for report-builder.ts — SPEC-REGULA-RISK-001 Phase 3 (T3.1~T3.4).
// @MX:SPEC SPEC-REGULA-RISK-001 (T3.1~T3.4, REQ-RISK-034~036)

import { describe, expect, it } from 'vitest';
import { type RiskRunPayload, buildRiskReport } from '../report-builder';

const sampleRun: RiskRunPayload = {
  id: 'run-abc-123',
  deviceDescription: 'Insulin pump with wireless BLE telemetry',
  deviceClass: 'Class III',
  createdAt: '2026-06-20T00:00:00Z',
  approvedBy: null,
  items: [
    {
      id: 'item-001',
      hazard: 'Electrical failure',
      sequenceOfEvents: 'Battery depletes → pump stops',
      hazardousSituation: 'No insulin delivery',
      harm: 'Diabetic ketoacidosis',
      severity: 5,
      probability: 2,
      riskLevel: 'unacc',
      lowConfidence: false,
      citation: [{ source: 'MAUDE', id: 'MDR123' }],
      controls: [
        {
          id: 'ctrl-001',
          tier: 'inherent',
          description: 'Redundant battery design',
          rationale: null,
          isAdopted: true,
          residualSeverity: 3,
          residualProbability: 1,
          residualRiskLevel: 'acc',
          alarpJustification: null,
        },
      ],
    },
  ],
  gsprMappings: [
    {
      gsprClause: 'Annex I §4',
      requirement: 'Devices must be designed to eliminate or reduce risks',
      compliance: 'compliant',
      evidence: 'Redundant battery design reduces risk to acceptable level',
    },
  ],
};

// ---------------------------------------------------------------------------
// T3.1 — buildRiskReport returns a non-empty Buffer
// ---------------------------------------------------------------------------
describe('T3.1 — buildRiskReport output', () => {
  it('returns a Buffer (Uint8Array)', async () => {
    const result = await buildRiskReport(sampleRun);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns content that looks like a DOCX (PK zip magic bytes)', async () => {
    const result = await buildRiskReport(sampleRun);
    // DOCX is a zip file starting with PK\x03\x04 magic bytes
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4b); // K
  });
});

// ---------------------------------------------------------------------------
// T3.2 — Type validation: RiskRunPayload
// ---------------------------------------------------------------------------
describe('T3.2 — RiskRunPayload type contract', () => {
  it('accepts run with empty items array', async () => {
    const emptyRun: RiskRunPayload = { ...sampleRun, items: [], gsprMappings: [] };
    const result = await buildRiskReport(emptyRun);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('accepts run with unapproved status (approvedBy: null)', async () => {
    const unapproved: RiskRunPayload = { ...sampleRun, approvedBy: null };
    const result = await buildRiskReport(unapproved);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

// ---------------------------------------------------------------------------
// T3.3 — Run with no GSPR mappings
// ---------------------------------------------------------------------------
describe('T3.3 — GSPR mapping section', () => {
  it('handles run with no GSPR mappings', async () => {
    const noGspr: RiskRunPayload = { ...sampleRun, gsprMappings: [] };
    const result = await buildRiskReport(noGspr);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// T3.4 — Multi-item run
// ---------------------------------------------------------------------------
describe('T3.4 — Multi-item report', () => {
  it('handles multiple risk items and controls', async () => {
    const multiRun: RiskRunPayload = {
      ...sampleRun,
      items: [
        ...sampleRun.items,
        {
          id: 'item-002',
          hazard: 'Software over-infusion bug',
          sequenceOfEvents: 'Software error → excess dose',
          hazardousSituation: 'Hypoglycemia',
          harm: 'Hypoglycaemic shock, death',
          severity: 5,
          probability: 3,
          riskLevel: 'unacc',
          lowConfidence: false,
          citation: [],
          controls: [],
        },
      ],
    };
    const result = await buildRiskReport(multiRun);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
