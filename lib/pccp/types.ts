// @MX:SPEC SPEC-REGULA-PCCP-001
import { z } from 'zod';

// PCCP lifecycle status (REQ-PCCP-024)
export const PccpStatusSchema = z.enum(['draft', 'submitted', 'cleared', 'superseded']);
export type PccpStatus = z.infer<typeof PccpStatusSchema>;

// 5 component types per PCCP document
export const PccpComponentTypeSchema = z.enum([
  'modification_description',
  'sps',
  'acp',
  'impact_assessment',
  'performance_testing',
]);
export type PccpComponentType = z.infer<typeof PccpComponentTypeSchema>;

// 4 modification categories (FDA AI/ML Final Guidance 2024-04)
export const ModificationTypeSchema = z.enum([
  'performance_improvement',
  'new_intended_use',
  'input_output_change',
  'algorithm_change',
]);
export type ModificationType = z.infer<typeof ModificationTypeSchema>;

// SPS (Software Pre-Specifications) content
export const SpsContentSchema = z.object({
  reference_standard: z.string().min(1),
  target_population: z.string().min(1),
  training_data_characteristics: z.string().min(1),
  performance_metrics: z.array(
    z.object({
      metric_name: z.string(),
      threshold: z.number(),
      unit: z.string().optional(),
    }),
  ),
});
export type SpsContent = z.infer<typeof SpsContentSchema>;

// ACP (Algorithm Change Protocol) content
export const AcpContentSchema = z.object({
  retraining_triggers: z.array(z.string()).min(1),
  evaluation_protocol: z.string().min(1),
  deployment_criteria: z.string().min(1),
  rollback_plan: z.string().optional(),
});
export type AcpContent = z.infer<typeof AcpContentSchema>;

// Substantial equivalence dimension (REQ-PCCP-013)
export const EquivalenceDimensionSchema = z.object({
  dimension: z.enum([
    'intended_use',
    'indications',
    'technological_characteristics',
    'clinical_safety',
    'user_interface',
  ]),
  status: z.enum(['Unchanged', 'Modified', 'New']),
  justification: z.string().optional(),
});
export type EquivalenceDimension = z.infer<typeof EquivalenceDimensionSchema>;

// Full PCCP version record
export const PccpVersionSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  version: z.string(),
  status: PccpStatusSchema,
  active: z.boolean(),
  deviceName: z.string(),
  manufacturer: z.string(),
  indication: z.string().nullable().optional(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PccpVersion = z.infer<typeof PccpVersionSchema>;

// Completeness validation result (REQ-PCCP-016, SLO 100%)
export interface PccpCompletenessResult {
  isComplete: boolean;
  completedComponents: PccpComponentType[];
  missingComponents: PccpComponentType[];
  completionPercentage: number;
}
