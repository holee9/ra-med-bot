import { z } from 'zod';

export const WorkflowTypeSchema = z.enum([
  'submission_drafter',
  'audit_response',
  'indication_impact',
]);
export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;

export const WorkflowStatusSchema = z.enum([
  'queued',
  'running',
  'paused',
  'pending_review',
  'approved',
  'rejected',
  'failed',
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

// REQ-WF-001: Submission Drafter input
export const SubmissionDrafterInputSchema = z.object({
  product_name: z.string().min(3).max(200),
  device_class: z.enum(['I', 'II', 'III']),
  indications_for_use: z.string().min(20).max(4000),
  target_jurisdiction: z.enum(['US_FDA', 'EU_MDR', 'KR_MFDS']),
  predicate_k_numbers: z
    .array(z.string().regex(/^K\d{6}$/))
    .max(3)
    .optional(),
  project_id: z.string().uuid(),
});
export type SubmissionDrafterInput = z.infer<typeof SubmissionDrafterInputSchema>;

// REQ-WF-021: Audit Response input
export const AuditResponseInputSchema = z.object({
  input_type: z.enum(['fda_483', 'mdsap_deficiency', 'eu_nb_med']),
  input_format: z.enum(['pdf', 'text']),
  input_content: z.string().min(100),
  project_id: z.string().uuid(),
  establishment_fei: z.string().optional(),
});
export type AuditResponseInput = z.infer<typeof AuditResponseInputSchema>;

// REQ-WF-036: Indication Impact input
export const IndicationImpactInputSchema = z.object({
  project_id: z.string().uuid(),
  current_indication: z.string().min(20).max(2000),
  proposed_indication: z.string().min(20).max(2000),
  target_markets: z
    .array(z.enum(['US', 'EU', 'KR', 'JP', 'CN']))
    .min(1)
    .max(5),
});
export type IndicationImpactInput = z.infer<typeof IndicationImpactInputSchema>;

// Workflow trigger response (202 Accepted)
export const WorkflowTriggerResponseSchema = z.object({
  runId: z.string().uuid(),
  streamEventsUrl: z.string(),
  estimatedDurationSeconds: z.number().optional(),
});
export type WorkflowTriggerResponse = z.infer<typeof WorkflowTriggerResponseSchema>;

// Workflow run result (GET /api/ra/workflows/[runId])
export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflow_type: WorkflowTypeSchema,
  status: WorkflowStatusSchema,
  started_at: z.string(),
  completed_at: z.string().nullable(),
  confidence_aggregate: z.number().nullable(),
  review_required: z.boolean(),
  reviewer_user_id: z.string().uuid().nullable(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
