// @MX:NOTE [AUTO] Knowledge gap replay hook — SPEC-REGULA-KNOWLEDGE-GAP-001 (#35) implementation.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-012, REQ-DELTA-013)
//          SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-014, REQ-KNOWLEDGE-GAP-015)
//
// When a delta-sync ingests a document that resolves a known knowledge gap,
// the previously-failed consult scenario is re-run. If the replay now passes
// (all 4 detection conditions cleared), the gap is closed and the audit trail
// records the resolution.
//
// Implementation status: COMPLETE (#35 Phase 3). The exported interface is
// unchanged from the original stub; only the body of triggerGapReplay() was
// filled in to call replayGapTest() + markGapResolved().

import { markGapResolved, replayGapTest } from '@/lib/knowledge-gap/replay';
import { logger } from '@/lib/observability/logger';

export interface GapReplayInput {
  crawlerName: string;
  /** Gap IDs that this newly-ingested document may resolve. */
  matchedGapIds?: string[];
  /** Ingestion run that produced the candidate resolution. */
  ingestionRunId?: string;
}

export interface GapReplayResult {
  triggered: boolean;
  gapIds: string[];
  /** Aggregate outcome across all replayed gaps. */
  replayOutcome?: 'pending' | 'passed' | 'failed';
}

/**
 * Decide whether to trigger a knowledge-gap replay after a delta-sync.
 * Returns true only when at least one gap was matched (REQ-DELTA-012).
 */
export function shouldTriggerGapReplay(input: GapReplayInput): boolean {
  return (input.matchedGapIds?.length ?? 0) > 0;
}

/**
 * Trigger gap replay for each matched gap (REQ-KNOWLEDGE-GAP-014).
 *
 * For every gap id, re-run the original (redacted) question through the RAG
 * pipeline. On pass: mark the gap resolved (status='resolved', GitHub comment,
 * audit_logs entry — REQ-KNOWLEDGE-GAP-015). On fail: leave the gap open so the
 * next ingestion can retry.
 *
 * `replayOutcome` is the aggregate: 'passed' only if every gap passed, 'failed'
 * if any gap failed or errored. Individual errors are logged but non-fatal so a
 * single broken gap does not block resolution of the others.
 */
export async function triggerGapReplay(input: GapReplayInput): Promise<GapReplayResult> {
  const gapIds = input.matchedGapIds ?? [];
  if (gapIds.length === 0) {
    return { triggered: false, gapIds: [] };
  }

  let allPassed = true;

  await Promise.all(
    gapIds.map(async (gapId) => {
      try {
        const result = await replayGapTest(gapId);
        if (result.passed) {
          await markGapResolved(gapId, {
            answerWithCitations: result.answerWithCitations,
            sources: result.sources,
          });
        } else {
          allPassed = false;
          logger.info('[gap-replay] gap not yet resolved', {
            gapId,
            reason: result.reasonSummary,
            crawler: input.crawlerName,
            ingestionRunId: input.ingestionRunId,
          });
        }
      } catch (err) {
        allPassed = false;
        // Non-fatal: one bad gap must not block sibling resolutions.
        logger.error('[gap-replay] replay failed for gap', {
          gapId,
          crawler: input.crawlerName,
          ingestionRunId: input.ingestionRunId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  return {
    triggered: true,
    gapIds,
    replayOutcome: allPassed ? 'passed' : 'failed',
  };
}
