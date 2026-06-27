// @MX:NOTE [AUTO] calibration-proposal.ts — persist calibration candidates.
// @MX:SPEC SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3, REQ-RLHF-005/006/015)
// @MX:REASON Writes a calibration_candidates row (status=pending) AND emits
//           the rlhf.calibration_proposed audit IN THE SAME TRANSACTION.
//           withTenantScope wraps a single db.transaction, so the candidate
//           insert + audit insert ride one tx boundary — a failure between
//           them rolls back both (21 CFR Part 11 §11.10(e) atomicity).
//
// Charter [지양-2] / [지양-4]: the ONLY status this function sets is 'pending'.
// Transitions to reviewed / applied_via_governance happen through RA-Lead
// governance review + the #71 MODEL-GOVERNANCE change-control approve path,
// never here. The detector output is a proposal, not an applied change.

import { type AuditDbHandle, writeAudit } from '@/lib/audit';
import { withTenantScope } from '@/lib/db/client';
import { calibrationCandidates } from '@/lib/db/schema';
import type { CalibrationCandidateInput } from './calibration-detector';

/**
 * Input for persisting a single candidate. Produced by
 * detectCalibrationCandidates (pure) and passed here by the API route or cron.
 */
export interface PersistCandidateInput extends CalibrationCandidateInput {
  orgId: string;
  /** User who triggered the detection run (null for system / cron). */
  proposedBy: string | null;
  /** Optional secondary dimension (default 'all' via the column default). */
  sourceType?: string;
}

/** The persisted candidate row shape returned to the caller. */
export interface PersistedCandidate {
  id: string;
  orgId: string;
  confidenceBucket: string;
  sourceType: string;
  observedUpRatio: string | null;
  sampleSize: number;
  verdict: string;
  status: string;
}

/**
 * REQ-RLHF-015 / Charter [지양-2]/[지양-4]: persist ONE calibration candidate
 * as status=pending + emit rlhf.calibration_proposed audit in the same tx.
 *
 * The function is intentionally single-candidate so the caller controls the
 * batch boundary (the API route loops over detectCalibrationCandidates output).
 * Each candidate gets its own transaction so a failure on row N does not roll
 * back rows 1..N-1.
 *
 * @MX:WARN [AUTO] audit MUST share the tx — do NOT move writeAudit outside
 *   withTenantScope. 21 CFR Part 11 §11.10(e): candidate + audit are atomic.
 *   @MX:REASON previous RLHF defect class in this repo had audit-outside-tx;
 *     the integration test in tests/integration/rlhf-calibration.test.ts
 *     asserts the tx-failure path writes NO candidate AND NO audit.
 *
 * @MX:ANCHOR [AUTO] proposeCalibrationCandidate — proposal write entry point.
 * @MX:REASON fan_in expected to reach 3 (API route, future digest cron,
 *           governance review fixture).
 */
export async function proposeCalibrationCandidate(
  input: PersistCandidateInput,
): Promise<PersistedCandidate> {
  return withTenantScope(input.orgId, async (tx) => {
    const [row] = await tx
      .insert(calibrationCandidates)
      .values({
        orgId: input.orgId,
        confidenceBucket: input.confidenceBucket,
        sourceType: input.sourceType ?? 'all',
        observedUpRatio: input.observedUpRatio.toString(),
        sampleSize: input.sampleSize,
        verdict: input.verdict,
        // status defaults to 'pending' via the column default — explicit here
        // for clarity + defense against a future default change.
        status: 'pending',
        proposedBy: input.proposedBy,
      })
      .returning({
        id: calibrationCandidates.id,
        orgId: calibrationCandidates.orgId,
        confidenceBucket: calibrationCandidates.confidenceBucket,
        sourceType: calibrationCandidates.sourceType,
        observedUpRatio: calibrationCandidates.observedUpRatio,
        sampleSize: calibrationCandidates.sampleSize,
        verdict: calibrationCandidates.verdict,
        status: calibrationCandidates.status,
      });

    if (!row) throw new Error('calibration_candidates insert returned no rows');

    // 21 CFR Part 11: audit rides the SAME tx. PII-free meta — only the
    // detection verdict + bucket + ratio + sample size. No question/answer text.
    await writeAudit(
      {
        actor_id: input.proposedBy,
        action: 'rlhf.calibration_proposed',
        resource_type: 'calibration_candidate',
        resource_id: row.id,
        meta_json: {
          org_id: input.orgId,
          confidence_bucket: input.confidenceBucket,
          source_type: input.sourceType ?? 'all',
          observed_up_ratio: input.observedUpRatio,
          sample_size: input.sampleSize,
          verdict: input.verdict,
          bucket_midpoint: input.bucketMidpoint,
        },
      },
      tx as unknown as AuditDbHandle,
    );

    return row;
  });
}

/**
 * Bulk helper: persist all candidates from a detector run. Each candidate is
 * persisted in its own transaction (see proposeCalibrationCandidate) so a
 * failure on one does not block the others. Returns the successful persists.
 */
export async function proposeCalibrationCandidates(
  orgId: string,
  proposedBy: string | null,
  candidates: readonly CalibrationCandidateInput[],
  sourceType?: string,
): Promise<PersistedCandidate[]> {
  const out: PersistedCandidate[] = [];
  for (const c of candidates) {
    try {
      const row = await proposeCalibrationCandidate({
        ...c,
        orgId,
        proposedBy,
        sourceType,
      });
      out.push(row);
    } catch {
      // Per-candidate isolation: a failure on one candidate does not abort the
      // batch. The audit for failed candidates is absent by design (the tx
      // rolled back). Caller can observe the gap via the returned row count.
    }
  }
  return out;
}
