// @MX:NOTE [AUTO] Clinical Investigation shared types & Zod input schemas.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-001~012)

// @MX:LEGACY archived from lib
// @MX:REASON Every Route Handler under app/api/clinical-investigation/ validates
//           request bodies against these Zod schemas before touching the DB.

import { z } from 'zod';

// -------------------------------------
// §1 Primitives
// -------------------------------------

export const ciPathwaySchema = z.enum(['fda_ide', 'eu_mdr']);
export type CiPathway = z.infer<typeof ciPathwaySchema>;

// SPEC-REGULA-PHI-REMOVAL-001: 'adverse_event' removed — Regula does not handle
// patient outcomes. CI events track milestone / deviation only.
export const ciEventTypeSchema = z.enum(['milestone', 'deviation']);
export type CiEventType = z.infer<typeof ciEventTypeSchema>;

// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): 'pms' target removed — pms_inputs
// table dropped; CI results no longer link to PMS deliverables (patient data).
export const ciLinkTargetSchema = z.enum(['cer', 'dhf']);
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
//
// H-1 fix: 'authoritative' is a tier reserved for deterministic statute
// references baked into the tier1 decision trees (21 CFR 812.x, EU MDR Art 62,
// ISO 14155). These are NOT LLM-generated and do NOT require RAG grounding —
// they are authoritative-by-construction. Routing them through
// enforceCitations([]) → 'unverified' was incorrect (made REQ-010 look unmet).
// The 'authoritative' tier flows to the audit row so FDA inspectors see
// grounded citations, not 'unverified' on every deterministic pathway output.
export type Confidence = 'high' | 'med' | 'low' | 'unverified' | 'authoritative';

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

// REQ-CLININV-008: POST /[id]/events — milestone / deviation tracking.
// SPEC-REGULA-PHI-REMOVAL-001: vigilanceRef + adverse_event removed.
export const ciEventInputSchema = z.object({
  type: ciEventTypeSchema,
  title: z.string().min(1).max(400),
  description: z.string().max(4000).optional(),
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
  // H-1 fix: records the authoritative confidence tier so the audit row can
  // distinguish grounded statute references from LLM-generated citations.
  confidence: Confidence;
}

export interface CloseGateResult {
  allowed: boolean;
  reason:
    | 'ok'
    | 'investigation_not_found_or_org_mismatch'
    | 'expert_signoff_missing'
    | 'expert_signoff_not_resolved'
    // C-1 fix: signoff UUID exists and is resolved but belongs to another org
    // (or to a projectless conversation). Cross-org signoff probing is blocked.
    | 'expert_signoff_not_org_bound'
    | 'already_closed';
}
