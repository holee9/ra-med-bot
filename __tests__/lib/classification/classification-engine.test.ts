// SPEC-REGULA-CLASSIFY-001 — unit tests for the deterministic classification engine.
// REQ-CLASSIFY-001~010: verify correct class assignment for each device type × jurisdiction.
import { describe, expect, it } from 'vitest';
import {
  type DeviceInput,
  classifyDevice,
} from '../../../lib/classification/classification-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const base: DeviceInput = {
  deviceDescription: 'test device',
  deviceType: 'non_active',
  contactType: 'no_contact',
  hasSoftware: false,
  hasAiMl: false,
  isSterile: false,
};

function input(overrides: Partial<DeviceInput>): DeviceInput {
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// FDA Tests
// ---------------------------------------------------------------------------
describe('FDA classification', () => {
  it('REQ-CLASSIFY-001: active implantable → Class III / PMA', () => {
    const result = classifyDevice(input({ deviceType: 'implantable', contactType: 'implant' }));
    expect(result.fda.deviceClass).toBe('III');
    expect(result.fda.pathway).toBe('PMA');
  });

  it('REQ-CLASSIFY-002: IVD → Class II / 510k', () => {
    const result = classifyDevice(input({ deviceType: 'ivd', contactType: 'no_contact' }));
    expect(result.fda.deviceClass).toBe('II');
    expect(result.fda.pathway).toBe('510k');
  });

  it('REQ-CLASSIFY-003: software-only with AI/ML → Class II / 510k', () => {
    const result = classifyDevice(
      input({ deviceType: 'software_only', contactType: 'no_contact', hasAiMl: true }),
    );
    expect(result.fda.deviceClass).toBe('II');
    expect(result.fda.pathway).toBe('510k');
    expect(result.fda.rationale).toContain('AI/ML');
  });

  it('REQ-CLASSIFY-004: active device no patient contact → Class I exempt', () => {
    const result = classifyDevice(input({ deviceType: 'active', contactType: 'no_contact' }));
    expect(result.fda.deviceClass).toBe('I');
    expect(result.fda.pathway).toBe('exempt');
  });

  it('REQ-CLASSIFY-005: active device internal contact → Class III / PMA', () => {
    const result = classifyDevice(input({ deviceType: 'active', contactType: 'internal' }));
    expect(result.fda.deviceClass).toBe('III');
    expect(result.fda.pathway).toBe('PMA');
  });
});

// ---------------------------------------------------------------------------
// EU MDR Tests
// ---------------------------------------------------------------------------
describe('EU MDR classification', () => {
  it('REQ-CLASSIFY-006: IVD → Class B / notified_body', () => {
    const result = classifyDevice(input({ deviceType: 'ivd', contactType: 'no_contact' }));
    expect(result.eu.deviceClass).toBe('B');
    expect(result.eu.requiresNotifiedBody).toBe(true);
    expect(result.eu.rule).toBe('IVDR Rule 3');
  });

  it('REQ-CLASSIFY-007: active implantable → Class III / Rule 8', () => {
    const result = classifyDevice(input({ deviceType: 'implantable', contactType: 'implant' }));
    expect(result.eu.deviceClass).toBe('III');
    expect(result.eu.rule).toBe('Rule 8');
    expect(result.eu.requiresNotifiedBody).toBe(true);
  });

  it('REQ-CLASSIFY-008: software-only with AI/ML → Class IIb / Rule 11', () => {
    const result = classifyDevice(input({ deviceType: 'software_only', hasAiMl: true }));
    expect(result.eu.deviceClass).toBe('IIb');
    expect(result.eu.rule).toBe('Rule 11');
  });

  it('REQ-CLASSIFY-009: software-only without AI/ML → Class IIa / Rule 11', () => {
    const result = classifyDevice(input({ deviceType: 'software_only', hasAiMl: false }));
    expect(result.eu.deviceClass).toBe('IIa');
    expect(result.eu.rule).toBe('Rule 11');
  });

  it('REQ-CLASSIFY-010: non-invasive external contact → Class I self_cert', () => {
    const result = classifyDevice(input({ deviceType: 'non_active', contactType: 'external' }));
    expect(result.eu.deviceClass).toBe('I');
    expect(result.eu.pathway).toBe('self_cert');
    expect(result.eu.requiresNotifiedBody).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MFDS Tests
// ---------------------------------------------------------------------------
describe('MFDS classification', () => {
  it('REQ-CLASSIFY-011: implantable contact → Class 4', () => {
    const result = classifyDevice(input({ deviceType: 'active', contactType: 'implant' }));
    expect(result.mfds.deviceClass).toBe('4');
  });

  it('REQ-CLASSIFY-012: IVD → Class 3', () => {
    const result = classifyDevice(input({ deviceType: 'ivd', contactType: 'no_contact' }));
    expect(result.mfds.deviceClass).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// NMPA Tests
// ---------------------------------------------------------------------------
describe('NMPA classification', () => {
  it('REQ-CLASSIFY-013: implantable contact → Class III', () => {
    const result = classifyDevice(input({ deviceType: 'active', contactType: 'implant' }));
    expect(result.nmpa.deviceClass).toBe('III');
  });

  it('REQ-CLASSIFY-014: general non-active device → Class II', () => {
    const result = classifyDevice(input({ deviceType: 'non_active', contactType: 'external' }));
    expect(result.nmpa.deviceClass).toBe('II');
  });
});

// ---------------------------------------------------------------------------
// PMDA Tests
// ---------------------------------------------------------------------------
describe('PMDA classification', () => {
  it('REQ-CLASSIFY-015: AI/ML software → Class III', () => {
    const result = classifyDevice(input({ deviceType: 'software_only', hasAiMl: true }));
    expect(result.pmda.deviceClass).toBe('III');
    expect(result.pmda.pathway).toBe('製造販売承認');
  });

  it('REQ-CLASSIFY-016: no patient contact non-active → Class I届出', () => {
    const result = classifyDevice(input({ deviceType: 'non_active', contactType: 'no_contact' }));
    expect(result.pmda.deviceClass).toBe('I');
    expect(result.pmda.pathway).toBe('届出');
  });
});

// ---------------------------------------------------------------------------
// Applicable Standards Tests
// ---------------------------------------------------------------------------
describe('applicableStandardTypes', () => {
  it('REQ-CLASSIFY-017: always includes ISO 14971', () => {
    const result = classifyDevice(base);
    expect(result.applicableStandardTypes).toContain('ISO 14971 (Risk Management)');
  });

  it('REQ-CLASSIFY-018: software device includes IEC 62304', () => {
    const result = classifyDevice(input({ deviceType: 'software_only' }));
    expect(result.applicableStandardTypes).toContain('IEC 62304 (Software Lifecycle)');
  });

  it('REQ-CLASSIFY-019: sterile device includes ISO 11607', () => {
    const result = classifyDevice(input({ isSterile: true }));
    expect(result.applicableStandardTypes).toContain('ISO 11607 (Packaging)');
  });

  it('REQ-CLASSIFY-020: implantable device includes ISO 10993-1', () => {
    const result = classifyDevice(input({ contactType: 'implant' }));
    expect(result.applicableStandardTypes).toContain('ISO 10993-1 (Biocompatibility)');
  });
});
