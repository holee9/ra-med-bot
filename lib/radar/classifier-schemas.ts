// REQ-RADAR-004..009: Zod schemas for 3-tier classifier structured output
// @MX:SPEC SPEC-REGULA-RADAR-001

import { z } from 'zod';

/** Tier 1: Binary relevance check */
export const Tier1Schema = z.object({
  relevant: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type Tier1Result = z.infer<typeof Tier1Schema>;

/** Tier 2: Device class × product category */
export const Tier2Schema = z.object({
  device_class: z.enum(['I', 'II', 'III', 'unknown']).optional(),
  product_categories: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

export type Tier2Result = z.infer<typeof Tier2Schema>;

/** Tier 3: Impact type classification */
export const ImpactTypeEnum = z.enum([
  'guidance',
  'recall',
  'legislation',
  'enforcement_action',
  'informational',
]);

export const Tier3Schema = z.object({
  impact_type: ImpactTypeEnum,
  confidence: z.number().min(0).max(1),
});

export type Tier3Result = z.infer<typeof Tier3Schema>;
export type ImpactType = z.infer<typeof ImpactTypeEnum>;
