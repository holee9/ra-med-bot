// @MX:NOTE [AUTO] buildProtocolDraft — REQ-CLININV-005 protocol builder.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-005, AC-06)

// @MX:LEGACY archived from lib
// @MX:REASON Deterministic normalizer over caller-provided synopsis/endpoint/
//           inclusion-exclusion criteria. No LLM call in tier1 — the RA team edits
//           the prose directly; this module validates shape and returns a typed
//           ProtocolDraft the route persists to ci_protocols.

import type { ProtocolDraft, ProtocolInput } from './types';

/**
 * REQ-CLININV-005 — normalize and return a protocol draft.
 *
 * The caller-supplied fields are validated upstream by the Zod schema
 * (protocolInputSchema in types.ts). This builder trims whitespace and enforces
 * non-empty constraints so the persisted row is always coherent.
 */
export function buildProtocolDraft(input: ProtocolInput): ProtocolDraft {
  return {
    synopsis: input.synopsis.trim(),
    endpoints: input.endpoints.map((e) => ({
      name: e.name.trim(),
      ...(e.description ? { description: e.description.trim() } : {}),
    })),
    inclusionCriteria: input.inclusionCriteria.map((c) => c.trim()).filter(Boolean),
    exclusionCriteria: input.exclusionCriteria.map((c) => c.trim()).filter(Boolean),
  };
}
