// @MX:NOTE [AUTO] CAPA domain shared types.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001~012)
//
// Shared TypeScript types for the complaint → CAPA closed-loop domain.
// Mirrors the labeling/change-control types pattern — pure types, no DB imports.

// REQ-001: structured complaint intake payload.
export interface ComplaintIntake {
  deviceName: string;
  deviceModel?: string;
  lotNumber?: string;
  eventDescription: string;
  patientOutcome: PatientOutcome;
  deviceCategory: DeviceCategory;
  eventDate: string;
  awarenessDate: string;
  isManufacturerAware: boolean;
  reporterName: string;
  reporterRole: string;
}

// REQ-002: reportability assessment result (mirrors vigilance ReportabilityDecision).
export interface ComplaintReportabilityResult {
  reportabilityStatus: 'reportable' | 'not_reportable';
  fdaMdrRequired: boolean;
  fdaMdrDeadlineDays: number | null;
  euMdvRequired: boolean;
  euMdvDeadlineDays: number | null;
  fscaRequired: boolean;
  rationale: string;
}

// REQ-003: root cause analysis methods.
export type RootCauseMethod = '5whys' | 'fishbone';

export interface FiveWhysAnalysis {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  rootCause: string;
}

// Fishbone 6M categories: Man, Machine, Material, Method, Measurement, Environment.
export interface FishboneAnalysis {
  man: string[];
  machine: string[];
  material: string[];
  method: string[];
  measurement: string[];
  environment: string[];
  rootCause: string;
}

// REQ-004: corrective vs preventive.
export type CapaType = 'corrective' | 'preventive';

// REQ-005: CAPA status lifecycle.
export type CapaStatus = 'open' | 'in_progress' | 'pending_effectiveness' | 'closed' | 'cancelled';

// REQ-005: effectiveness check result.
export type EffectivenessResult = 'effective' | 'ineffective';

// REQ-008: cross-workflow link targets.
export type CapaLinkTarget = 'risk' | 'change_control' | 'dhf' | 'pms';

export interface CapaLinkInput {
  targetType: CapaLinkTarget;
  targetId: string;
}

// REQ-011: close gate decision.
export interface CloseGateResult {
  allowed: boolean;
  reason: string;
}

// REQ-002 reuse: vigilance engine types (re-exported for wrapper convenience).
export type PatientOutcome = 'death' | 'serious_injury' | 'malfunction' | 'no_injury' | 'other';

export type DeviceCategory = 'class_I' | 'class_II' | 'class_III' | 'IIa' | 'IIb' | 'III';
