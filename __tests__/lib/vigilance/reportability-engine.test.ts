// @MX:NOTE Unit tests for reportability-engine.ts — covers all 5 test scenarios
// @MX:SPEC SPEC-REGULA-VIGILANCE-001 (REQ-VIG-001~010)

import { describe, expect, it } from 'vitest';
import { assessReportability } from '../../../lib/vigilance/reportability-engine';
import type { AdverseEventInput } from '../../../lib/vigilance/reportability-engine';

const baseEvent: AdverseEventInput = {
  eventDescription: 'Device malfunctioned during normal operation.',
  patientOutcome: 'malfunction',
  deviceCategory: 'class_II',
  eventDate: '2024-01-15',
  awarenessDate: '2024-01-15',
  isManufacturerAware: true,
};

describe('assessReportability', () => {
  it('FDA 30-day: Class II malfunction triggers 30-day MDR (21 CFR 803.53)', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'malfunction',
      deviceCategory: 'class_II',
    };

    const decision = assessReportability(event);

    expect(decision.fdaMdrRequired).toBe(true);
    expect(decision.fdaMdrDeadlineDays).toBe(30);
    expect(decision.rationale).toContain('21 CFR 803.53');
  });

  it('FDA 5-day: Class III malfunction with death risk in description → 5-day MDR (21 CFR 803.53(a))', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'malfunction',
      deviceCategory: 'class_III',
      eventDescription: 'Device malfunction caused life-threatening complication.',
    };

    const decision = assessReportability(event);

    expect(decision.fdaMdrRequired).toBe(true);
    expect(decision.fdaMdrDeadlineDays).toBe(5);
    expect(decision.rationale).toContain('5-day');
  });

  it('EU MDV 2-day: serious incident with death on Class IIb device', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'death',
      deviceCategory: 'IIb',
    };

    const decision = assessReportability(event);

    expect(decision.euMdvRequired).toBe(true);
    expect(decision.euMdvDeadlineDays).toBe(2);
    expect(decision.rationale).toContain('Art. 87(2)');
  });

  it('No reporting: minor event (no_injury) on Class I device', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'no_injury',
      deviceCategory: 'class_I',
    };

    const decision = assessReportability(event);

    expect(decision.fdaMdrRequired).toBe(false);
    expect(decision.euMdvRequired).toBe(false);
    expect(decision.fscaRequired).toBe(false);
    expect(decision.fdaMdrDeadlineDays).toBeNull();
    expect(decision.euMdvDeadlineDays).toBeNull();
  });

  it('FSCA trigger: death on Class III device requires both MDR and FSCA', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'death',
      deviceCategory: 'class_III',
    };

    const decision = assessReportability(event);

    expect(decision.fdaMdrRequired).toBe(true);
    expect(decision.fscaRequired).toBe(true);
    expect(decision.rationale).toContain('FSCA');
  });

  it('EU MDV 15-day: Class IIa malfunction triggers unanticipated serious incident', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'malfunction',
      deviceCategory: 'IIa',
    };

    const decision = assessReportability(event);

    expect(decision.euMdvRequired).toBe(true);
    expect(decision.euMdvDeadlineDays).toBe(15);
    expect(decision.rationale).toContain('Art. 87(1)');
  });

  it('FDA 30-day: serious_injury on Class II device triggers 30-day MDR', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'serious_injury',
      deviceCategory: 'class_II',
    };

    const decision = assessReportability(event);

    expect(decision.fdaMdrRequired).toBe(true);
    expect(decision.fdaMdrDeadlineDays).toBe(30);
    expect(decision.rationale).toContain('21 CFR 803.50(a)');
  });

  it('EU MDV 30-day trend: "other" outcome on Class III device', () => {
    const event: AdverseEventInput = {
      ...baseEvent,
      patientOutcome: 'other',
      deviceCategory: 'III',
    };

    const decision = assessReportability(event);

    expect(decision.euMdvRequired).toBe(true);
    expect(decision.euMdvDeadlineDays).toBe(30);
    expect(decision.rationale).toContain('Art. 87(3)');
  });
});
