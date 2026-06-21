// @MX:NOTE [AUTO] Knowledge gap replay hook — #35 Knowledge Gap Ops integration.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-012, REQ-DELTA-013)
//
// When a delta-sync ingests a document that resolves a known knowledge gap,
// the failed eval scenario should be re-run. If the replay passes, the gap is
// closed and audit_logs is updated.
//
// Implementation status: STUB. #35 Knowledge Gap Ops is not yet implemented.
// This module exposes the trigger interface so delta-sync can call it when #35
// lands. Follow-up: wire to actual gap resolution logic in #35.

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
  /** Placeholder — #35 will return replay pass/fail per gap. */
  replayOutcome?: 'pending' | 'passed' | 'failed';
}

/**
 * Decide whether to trigger a knowledge-gap replay after a delta-sync.
 * Returns true only when at least one gap was matched (REQ-DELTA-012).
 *
 * NOTE: The actual replay execution (failed eval re-run + gap closure) is
 * deferred to #35. This function only decides whether the trigger fires.
 */
export function shouldTriggerGapReplay(input: GapReplayInput): boolean {
  return (input.matchedGapIds?.length ?? 0) > 0;
}

/**
 * Trigger gap replay for each matched gap.
 * Stub — logs the trigger and returns a pending result per gap.
 * When #35 ships, this will enqueue replay jobs and update audit_logs.
 */
export async function triggerGapReplay(input: GapReplayInput): Promise<GapReplayResult> {
  const gapIds = input.matchedGapIds ?? [];
  if (gapIds.length === 0) {
    return { triggered: false, gapIds: [] };
  }

  // STUB: when #35 lands, enqueue:
  //   1. Re-run failed eval scenarios for each gap
  //   2. On pass: mark gap resolved + writeAudit('corpus.sync_completed')
  //   3. On fail: leave gap open, log retry in corpus_sync_runs
  return {
    triggered: true,
    gapIds,
    replayOutcome: 'pending',
  };
}
