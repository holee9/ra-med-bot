// @MX:TODO [AUTO] REQ-009 — #65 eSubmit forward hook (STUB).
// @MX:REASON #65 eSubmit package generation is not yet implemented. Per L-004,
//           only the interface + a no-op stub are provided here. When #65
//           lands, replace the stub body with a real call to
//           lib/esubmit/validators.ts validateSubmissionPackage, adding the
//           labeling sections to the submission bundle.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-009, AC-07)
// @MX:PRIORITY P2 — activate after #65 merges.

/**
 * REQ-009: forward an approved labeling document to the eSubmit pipeline.
 *
 * STUB BEHAVIOR (current): no-op + structured log. The function signature is
 * stable so the approve route can wire it now; the real integration is a
 * follow-up tracked in #65.
 *
 * Future contract (when #65 is implemented):
 *   - Validate the labeling sections via validateSubmissionPackage.
 *   - Append the labeling document to the eSubmission bundle.
 *   - Return the updated package ID / validation result.
 */
export interface ESubmitBridgeResult {
  /** True when the eSubmit package was updated; false for the stub. */
  forwarded: boolean;
  /** Stub reason or future package ID. */
  detail: string;
}

export async function forwardLabelingToESubmit(params: {
  documentId: string;
  projectId: string;
  orgId: string;
}): Promise<ESubmitBridgeResult> {
  // STUB: structured log only. The real implementation will live in #65.
  // We intentionally do NOT throw — the approve route must still succeed when
  // eSubmit is not yet wired (REQ-009 is a forward hook, not a gate).
  console.warn('[esubmit-bridge] REQ-009 stub invoked — #65 eSubmit not yet implemented', {
    documentId: params.documentId,
    projectId: params.projectId,
  });

  return {
    forwarded: false,
    detail: 'esubmit_not_implemented_stub_invoked',
  };
}
