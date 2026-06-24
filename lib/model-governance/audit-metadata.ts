// @MX:NOTE [AUTO] audit-metadata.ts — answer version metadata for 21 CFR Part 11 (REQ-MODELGOV-007).
// @MX:ANCHOR [AUTO] buildAnswerVersionMetadata — attaches version provenance to answer audit rows.
// @MX:REASON REQ-MODELGOV-007 — every production answer must carry the prompt/model version
//           that produced it, for regulatory traceability. fan_in >= 3 expected (consult
//           handler, answer persistence, test fixtures).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-007, AC-01)

import type { ActiveCombination, AnswerVersionMetadata } from './types';

/**
 * REQ-MODELGOV-007 / AC-01: build the version metadata object to attach to an
 * answer's audit row. Callers merge this into the audit `meta_json` field.
 *
 * Returns null when no active combination exists (e.g., pre-approval bootstrap).
 * In that case the caller's runtime-guard (REQ-MODELGOV-008) will already have
 * blocked the call, so this null path is defense-in-depth.
 */
export function buildAnswerVersionMetadata(combination: ActiveCombination): AnswerVersionMetadata {
  return {
    approvedCombinationId: combination.id,
    promptVersion: combination.promptVersion,
    promptContentHash: combination.promptContentHash,
    modelProvider: combination.modelProvider,
    modelId: combination.modelId,
    modelVersion: combination.modelVersion,
  };
}
