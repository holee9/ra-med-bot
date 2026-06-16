// @MX:ANCHOR [AUTO] Reportability engine — determines regulatory filing obligation.
// @MX:REASON Public API boundary; called by route handler and unit tests. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-VIGILANCE-001 (REQ-VIG-001~010)
//
// Implements deterministic rules (no AI) for two regulatory frameworks:
//   FDA MDR: 21 CFR Part 803 — 30-day (803.50) or 5-day (803.53)
//   EU MDV:  EU MDR Article 87 — immediate/2-day, 15-day, or 30-day
//   FSCA:    Field Safety Corrective Action (recall/corrective action)

export type PatientOutcome = 'death' | 'serious_injury' | 'malfunction' | 'no_injury' | 'other';

export type DeviceCategory = 'class_I' | 'class_II' | 'class_III' | 'IIa' | 'IIb' | 'III';

export interface AdverseEventInput {
  eventDescription: string;
  patientOutcome: PatientOutcome;
  // EU MDR device classification (IIa / IIb / III) or FDA class (class_I / class_II / class_III)
  deviceCategory: DeviceCategory;
  eventDate: string;
  awarenessDate: string;
  isManufacturerAware: boolean;
}

export interface ReportabilityDecision {
  fdaMdrRequired: boolean;
  // 5-day (malfunction with serious injury risk) or 30-day (death/serious injury)
  fdaMdrDeadlineDays: number | null;
  euMdvRequired: boolean;
  // 2-day (death/serious incident), 15-day (unanticipated serious incident), or 30-day (trend)
  euMdvDeadlineDays: number | null;
  fscaRequired: boolean;
  rationale: string;
}

// Outcomes that trigger FDA MDR 30-day reporting (21 CFR 803.50(a))
const FDA_30DAY_OUTCOMES: ReadonlySet<PatientOutcome> = new Set(['death', 'serious_injury']);

// Outcomes that trigger EU MDV 2-day serious incident reporting (EU MDR Art. 87(2))
const EU_2DAY_OUTCOMES: ReadonlySet<PatientOutcome> = new Set(['death', 'serious_injury']);

// EU device classes that are subject to vigilance reporting (Art. 87 scope)
const EU_REPORTABLE_CLASSES: ReadonlySet<DeviceCategory> = new Set([
  'IIa',
  'IIb',
  'III',
  'class_II',
  'class_III',
]);

// @MX:ANCHOR [AUTO] assessReportability — core decision engine entry point.
// @MX:REASON Called by POST /api/ra/vigilance route handler + 5 unit tests + audit wiring.
// @MX:SPEC SPEC-REGULA-VIGILANCE-001 (REQ-VIG-001~010)
export function assessReportability(event: AdverseEventInput): ReportabilityDecision {
  const rationale: string[] = [];

  // ---- FDA MDR assessment (21 CFR Part 803) ----
  let fdaMdrRequired = false;
  let fdaMdrDeadlineDays: number | null = null;

  if (FDA_30DAY_OUTCOMES.has(event.patientOutcome)) {
    // 21 CFR 803.50(a): death or serious injury → 30-day MDR
    fdaMdrRequired = true;
    fdaMdrDeadlineDays = 30;
    rationale.push(
      `FDA MDR required (30-day): 21 CFR 803.50(a) — ${event.patientOutcome} outcome triggers mandatory reporting.`,
    );
  } else if (event.patientOutcome === 'malfunction') {
    // 21 CFR 803.53: malfunction that could cause death/serious injury if it recurs → 30-day
    // 21 CFR 803.53(a): if the malfunction poses an unreasonable risk → 5-day
    // Conservative rule: all malfunctions for Class II/III devices require 30-day reporting.
    if (
      event.deviceCategory === 'class_II' ||
      event.deviceCategory === 'class_III' ||
      event.deviceCategory === 'IIb' ||
      event.deviceCategory === 'III'
    ) {
      fdaMdrRequired = true;
      fdaMdrDeadlineDays = 30;
      rationale.push(
        'FDA MDR required (30-day): 21 CFR 803.53 — Class II/III device malfunction requiring reporting.',
      );
    }
  }

  // 5-day expedited: malfunction with imminent risk (death-level outcome description)
  if (
    fdaMdrRequired &&
    event.patientOutcome === 'malfunction' &&
    (event.eventDescription.toLowerCase().includes('death') ||
      event.eventDescription.toLowerCase().includes('life-threatening'))
  ) {
    fdaMdrDeadlineDays = 5;
    rationale.push(
      'FDA MDR upgraded to 5-day (21 CFR 803.53(a)): malfunction with imminent risk of death or serious injury.',
    );
  }

  // ---- EU MDV assessment (EU MDR Article 87) ----
  let euMdvRequired = false;
  let euMdvDeadlineDays: number | null = null;

  if (EU_REPORTABLE_CLASSES.has(event.deviceCategory)) {
    if (EU_2DAY_OUTCOMES.has(event.patientOutcome)) {
      // Art. 87(2): serious incident with imminent risk — 2-day immediate notice
      euMdvRequired = true;
      euMdvDeadlineDays = 2;
      rationale.push(
        `EU MDV required (2-day): EU MDR Art. 87(2) — serious incident with ${event.patientOutcome} outcome.`,
      );
    } else if (event.patientOutcome === 'malfunction') {
      // Art. 87(1): unanticipated serious incident — 15-day
      euMdvRequired = true;
      euMdvDeadlineDays = 15;
      rationale.push(
        'EU MDV required (15-day): EU MDR Art. 87(1) — device malfunction that may have led to serious incident.',
      );
    } else if (event.patientOutcome === 'other') {
      // Art. 87(3): trend reporting — 30-day
      euMdvRequired = true;
      euMdvDeadlineDays = 30;
      rationale.push(
        'EU MDV required (30-day): EU MDR Art. 87(3) — trend report for non-serious incident.',
      );
    }
  } else if (!EU_REPORTABLE_CLASSES.has(event.deviceCategory)) {
    rationale.push(
      `EU MDV not required: ${event.deviceCategory} devices are outside EU MDR Article 87 scope.`,
    );
  }

  // ---- FSCA assessment (Field Safety Corrective Action) ----
  // FSCA is required when the manufacturer takes or plans corrective action to reduce risk.
  // Triggered by: systematic malfunction, death, serious injury requiring product recall/correction.
  const fscaRequired =
    (fdaMdrRequired || euMdvRequired) &&
    (event.patientOutcome === 'death' ||
      event.patientOutcome === 'serious_injury' ||
      (event.patientOutcome === 'malfunction' &&
        (event.deviceCategory === 'class_III' || event.deviceCategory === 'III')));

  if (fscaRequired) {
    rationale.push(
      'FSCA required: systematic malfunction or serious harm involving high-risk device warrants field safety corrective action notice.',
    );
  }

  if (rationale.length === 0) {
    rationale.push(
      `No mandatory reporting required: ${event.patientOutcome} outcome on ${event.deviceCategory} device does not trigger FDA MDR or EU MDV obligations.`,
    );
  }

  return {
    fdaMdrRequired,
    fdaMdrDeadlineDays,
    euMdvRequired,
    euMdvDeadlineDays,
    fscaRequired,
    rationale: rationale.join(' '),
  };
}
