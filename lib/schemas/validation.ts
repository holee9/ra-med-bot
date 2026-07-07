// @MX:ANCHOR [AUTO] Validation domain Zod schemas — SPEC-REGULA-VALIDATION-001.
// @MX:REASON Consumed by M5 API routes (/api/validation/*) and M1-M4 collectors.
//   Enum values MUST match migration 0112 CHECK constraints exactly.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-006, REQ-VAL-007, REQ-VAL-008)

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants — single source of truth. Drizzle schema.ts and migration 0112
// CHECK constraints must stay in sync with these arrays.
// ---------------------------------------------------------------------------

/** REQ-VAL-003/004/005 — IQ/OQ/PQ qualification types (GAMP 5). */
export const QUALIFICATION_TYPES = ['iq', 'oq', 'pq'] as const;
export type QualificationType = (typeof QUALIFICATION_TYPES)[number];

/** REQ-VAL-006 — evidence result. `skip` covers expired or unavailable artifacts. */
export const EVIDENCE_RESULTS = ['pass', 'fail', 'skip'] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];

/** REQ-VAL-007 — 7-axis change impact assessment. */
export const CHANGE_AXES = [
  'source_policy',
  'prompt',
  'model',
  'schema',
  'retrieval',
  'export',
  'review_workflow',
] as const;
export type ChangeAxis = (typeof CHANGE_AXES)[number];

/** REQ-VAL-008 — impact rating. `high` triggers sign-off block when rerun evidence is missing. */
export const IMPACT_LEVELS = ['low', 'medium', 'high'] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

// ---------------------------------------------------------------------------
// Zod schemas — API request validation (M5) and collector output (M1-M4).
// ---------------------------------------------------------------------------

export const qualificationTypeSchema = z.enum(QUALIFICATION_TYPES);
export const evidenceResultSchema = z.enum(EVIDENCE_RESULTS);
export const changeAxisSchema = z.enum(CHANGE_AXES);
export const impactLevelSchema = z.enum(IMPACT_LEVELS);

/** REQ-VAL-006 — validation_evidence row shape (insert payload). */
export const validationEvidenceInsertSchema = z.object({
  releaseId: z.string().min(1),
  qualificationType: qualificationTypeSchema,
  commitSha: z.string().min(1),
  ciRunId: z.number().int().nonnegative().nullish(),
  testCommand: z.string().min(1),
  artifactPath: z.string().nullish(),
  result: evidenceResultSchema,
  evidenceMetadata: z.record(z.unknown()).default({}),
});

/** REQ-VAL-007/008/009 — change_control row shape. */
export const changeControlInsertSchema = z.object({
  releaseId: z.string().min(1),
  changeAxis: changeAxisSchema,
  impactLevel: impactLevelSchema,
  rerunRequired: z.boolean(),
  residualRisk: z.string().min(1),
  exceptionNote: z.string().nullish(),
  evidenceRef: z.string().uuid().nullish(),
});

/** REQ-VAL-013 — checklist item shape inside validation_signoff.checklist_state. */
export const checklistItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  met: z.boolean(),
});

/** REQ-VAL-012/013 — validation_signoff insert payload (approver-side). */
export const validationSignoffInsertSchema = z.object({
  releaseId: z.string().min(1),
  checklistState: z.object({
    items: z.array(checklistItemSchema),
  }),
  approverId: z.string().uuid(),
  reportArtifactPath: z.string().min(1),
});

export type ValidationEvidenceInsert = z.infer<typeof validationEvidenceInsertSchema>;
export type ChangeControlInsert = z.infer<typeof changeControlInsertSchema>;
export type ValidationSignoffInsert = z.infer<typeof validationSignoffInsertSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
