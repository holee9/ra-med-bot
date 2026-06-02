// @MX:NOTE [AUTO] Type definitions and Zod schemas for the predicate-device module.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-001)
//
// Shared contracts consumed by the openFDA client, cascade search, cache, and
// comparison-builder tasks. Runtime validation uses Zod where external data
// (openFDA responses, search params, rate-limit config) crosses a boundary.

import { z } from 'zod';

/**
 * A 510(k) device record as returned by the openFDA `device/510k` endpoint.
 * Only the fields relevant to predicate analysis are modelled.
 */
export const OpenFDADeviceSchema = z.object({
  k_number: z.string(),
  applicant_name: z.string(),
  device_name: z.string(),
  decision_date: z.string(),
  decision: z.string(),
  product_code: z.string(),
  statement_or_summary: z.string(),
  device_description: z.string(),
});

export type OpenFDADevice = z.infer<typeof OpenFDADeviceSchema>;

/** A predicate candidate is an openFDA device plus an optional rerank score. */
export interface PredicateCandidate extends OpenFDADevice {
  rerank_score?: number;
}

/** Which cascade tier produced a given result set. */
export type CascadeSearchStrategy = 'device_name' | 'product_code' | 'panel';

/** Result of a cascade predicate search across one or more strategies. */
export interface CascadeSearchResult {
  candidates: PredicateCandidate[];
  total: number;
  search_strategy: CascadeSearchStrategy;
  cached: boolean;
  /**
   * True when openFDA coverage may be incomplete — set when any result predates
   * 2004-01-01 or when fewer than 10 total results were found. The UI displays a
   * pre-2004 coverage notice based on this flag (REQ-PRE-007).
   */
  has_coverage_gap: boolean;
}

/** The five substantial-equivalence comparison dimensions. */
export type ComparisonDimension =
  | 'intended_use'
  | 'indications'
  | 'tech_characteristics'
  | 'materials'
  | 'performance';

/** One row of the substantial-equivalence comparison table. */
export interface ComparisonCell {
  dimension: ComparisonDimension;
  subject_text: string;
  predicate_texts: string[];
  llm_suggestions?: string[];
  approved: boolean[];
}

/** A complete subject-vs-predicate comparison document. */
export interface PredicateComparison {
  subject_device_name: string;
  selected_predicates: PredicateCandidate[];
  cells: ComparisonCell[];
  created_at: Date;
}

/** Rate-limit configuration for the openFDA client. */
export const RateLimitConfigSchema = z.object({
  requests_per_minute: z.number().int().positive(),
  api_key: z.string().optional(),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/** Search parameters accepted by the openFDA client. */
export const OpenFDASearchParamsSchema = z.object({
  device_name: z.string().optional(),
  product_code: z.string().optional(),
  panel: z.string().optional(),
  applicant: z.string().optional(),
  skip: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
});

export type OpenFDASearchParams = z.infer<typeof OpenFDASearchParamsSchema>;
