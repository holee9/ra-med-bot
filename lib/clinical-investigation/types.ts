// @MX:NOTE [AUTO] Clinical Investigation shared types & Zod input schemas.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-001~012)
// @MX:REASON Every Route Handler under app/api/clinical-investigation/ validates
//           request bodies against these Zod schemas before touching the DB.
//           Mirrors the lib/pms + lib/capa input-validation discipline.

import { z } from 'zod';

// -------------------------------------
// §1 Primitives
// -------------------------------------

export const ciPathwaySchema = z.enum(['fda_ide', 'eu_mdr']);
export type CiPathway = z.infer<typeof ciPathwaySchema>;

export const ciEventTypeSchema = z.enum(['milestone', 'deviation', 'adverse_event']);
export type CiEventType = z.infer<typeof ciEventTypeSchema>;

export const ciLinkTargetSchema = z.enum(['cer', 'pms', 'dhf']);
export type CiLinkTarget = z.infer<typeof ciLinkTargetSchema>;

// Regulatory citation carried by every pathway/recommendation output (REQ-010).
// Mirrors lib/classify/validate.ts Citation shape (source + identifier).
export interface RegulatoryCitation {
  source: string; // e.g. '21 CFR 812.3(k)', 'EU MDR Article 62(1)', 'ISO 14155 §6'
  id: string; // e.g. '812.3(k)', '62(1)', '6.2'
  url?: string;
}

// Confidence mirrors the classify/cer convention: 'high'|'med'|'low'|'unverified'.
// 'unverified' is set when citation enforcement strips ALL emitted citations.
export type Confidence = 'high' | 'med' | 'low' | 'unverified';

// -------------------------------------
// §2 Request schemas (Route Handler inputs)
// -------------------------------------

// REQ-CLININV-001: POST /assess — gap-based necessity assessment.
export const assessInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  cerGapSummary: z.string().min(1).max(8000),
  literatureGapSummary: z.string().min(1).max(8000).optional(),
  intendedUse: z.string().min(1).max(2000).optional(),
  deviceClass: z.string().max(120).optional(),
});
export type AssessInput = z.infer<typeof assessInputSchema>;

// REQ-CLININV-002: POST /[id]/ide-decision.
export const ideDecisionInputSchema = z.object({
  riskLevel: z.enum(['non_significant', 'significant', 'nsr_eligible']),
  isExemptDevice: z.boolean().default(false),
});
export type IdeDecisionInput = z.infer<typeof ideDecisionInputSchema>;

// REQ-CLININV-005: POST /[id]/protocol.
export const protocolInputSchema = z.object({
  synopsis: z.string().min(1).max(8000),
  endpoints: z
    .array(
      z.object({
        name: z.string().min(1).max(400),
        description: z.string().max(2000).optional(),
      }),
    )
    .max(20),
  inclusionCriteria: z.array(z.string().min(1).max(800)).max(50),
  exclusionCriteria: z.array(z.string().min(1).max(800)).max(50),
});
export type ProtocolInput = z.infer<typeof protocolInputSchema>;

// REQ-CLININV-004: POST /[id]/irb-package.
export const irbPackageInputSchema = z.object({
  pathway: ciPathwaySchema,
  includeConsentDraft: z.boolean().default(true),
  includeBrochure: z.boolean().default(true),
  includeMonitoringPlan: z.boolean().default(true),
});
export type IrbPackageInput = z.infer<typeof irbPackageInputSchema>;

// REQ-CLININV-008: POST /[id]/events — milestone / deviation / AE.
export const ciEventInputSchema = z.object({
  type: ciEventTypeSchema,
  title: z.string().min(1).max(400),
  description: z.string().max(4000).optional(),
  // AC-08: when type='adverse_event', an optional vigilance_ref links the CI
  // event to the Vigilance domain (reportability assessment / MDR report).
  vigilanceRef: z.string().max(200).optional(),
  occurredAt: z.string().datetime().optional(),
});
export type CiEventInput = z.infer<typeof ciEventInputSchema>;

// REQ-CLININV-009: POST /[id]/links — link results to CER/PMS/DHF.
export const ciLinkInputSchema = z.object({
  targetType: ciLinkTargetSchema,
  targetId: z.string().uuid(),
});
export type CiLinkInput = z.infer<typeof ciLinkInputSchema>;

// REQ-CLININV-012: POST /[id]/close.
export const closeInputSchema = z.object({
  expertSignoffId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
export type CloseInput = z.infer<typeof closeInputSchema>;

// -------------------------------------
// §3 Result types
// -------------------------------------

export interface GapAssessmentResult {
  necessityStatus: 'required' | 'not_required' | 'conditional';
  recommendation: string;
  rationale: string;
  citations: RegulatoryCitation[];
  confidence: Confidence;
}

export interface PathwayDecision {
  pathway: CiPathway;
  decision: string;
  regulatoryBasis: string;
  citations: RegulatoryCitation[];
  confidence: Confidence;
}

export interface ProtocolDraft {
  synopsis: string;
  endpoints: Array<{ name: string; description?: string }>;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
}

export interface IrbPackageDraft {
  irbPackage: string;
  consentDraft?: string;
  brochure?: string;
  monitoringPlan?: string;
  citations: RegulatoryCitation[];
}

export interface CloseGateResult {
  allowed: boolean;
  reason:
    | 'ok'
    | 'investigation_not_found_or_org_mismatch'
    | 'expert_signoff_missing'
    | 'expert_signoff_not_resolved'
    | 'already_closed';
}
