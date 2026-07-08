// @MX:ANCHOR [AUTO] Knowledge gap replay — closed-loop verification + resolution.
// @MX:REASON Public API boundary called by the replay route and by delta-sync
//          gap-replay. fan_in will reach 3+ (route, delta-sync, future cron).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-014, REQ-015, AC-06, Issue #35)
//
// Design reference: design.md §3 (loop flow), §4 (Integration Contract), §4.3 (resolution
// side-effects).
//
// replayGapTest(queueId):
//   1. Load the unanswered_queue row (redacted_question + context ids).
//   2. Re-run the ORIGINAL (redacted) question through the consult RAG pipeline,
//      collecting the stream events into a summary. We DO NOT persist the replay
//      answer as a new message — we only observe whether the pipeline now succeeds.
//   3. Re-evaluate the SAME 4 detection conditions used by the detector
//      (detectKnowledgeGap) against the collected summary. `passed` iff the
//      detector now returns null — i.e. every gap condition is cleared.
//
// markGapResolved(queueId, evidence):
//   1. Set unanswered_queue.status='resolved' + resolved_at=NOW().
//   2. Post a resolution comment on the linked GitHub issue (best-effort).
//   3. Write the knowledge_gap_resolved audit log (REQ-KNOWLEDGE-GAP-016).
//
// The redacted_question is the ONLY user content that re-enters the pipeline, so
// no fresh PII is introduced by replay (detector redacted it at capture time).

import { consult } from '@/lib/ai/consult';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { type VerifyEdgesResult, verifyAnswerEdges } from '@/lib/traceability/verify-edges';
import type { SourceItem, StreamEvent } from '@/types/streaming';
import { and, eq } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { detectKnowledgeGap } from './detector';
import { commentGapResolved } from './github-issue';

/** A replay test result. `passed` mirrors the detector's 4-condition check (design §4.2). */
export interface ReplayGapTestResult {
  passed: boolean;
  /** The redacted answer prose (with citation markers if any). */
  answerWithCitations: string;
  /** Sources cited by the replayed answer. */
  sources: SourceItem[];
  /** Which gap reason (if any) is STILL triggered after replay. null when passed. */
  remainingReason: ReturnType<typeof detectKnowledgeGap>;
  /** Human-readable trace of why passed/failed — for audit meta (PII-free). */
  reasonSummary: string;
  /**
   * REQ-011 edge-integrity verification result. Verifies that every cited
   * message_source has a corresponding evidence_node and none are stale.
   * `intact=true` means the evidence graph is consistent with the replay's
   * citations. When the org has no traceability data the result defaults intact.
   */
  edgeIntegrity: VerifyEdgesResult;
}

/** Synthetic session for replay (system-initiated, not tied to a user). */
function systemSession(): Session {
  // consult() reads session.user?.id only for audit attribution. Using a stable
  // system sentinel keeps replay-originated audit rows distinguishable from
  // user-originated ones without requiring a real user account.
  return {
    user: { id: '00000000-0000-0000-0000-000000000001', role: 'system' },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as unknown as Session;
}

/**
 * Re-run a previously-unanswered question through the RAG pipeline and decide
 * whether the knowledge gap is now closed (REQ-KNOWLEDGE-GAP-014).
 *
 * `passed` is true iff detectKnowledgeGap() returns null on the replayed result —
 * i.e. ALL 4 conditions from design §2.1 are now clear:
 *   - llmFailed === false         (clears policy_blocked)
 *   - topChunksLength > 0         (clears no_results)
 *   - citationCoverageBelow80     (clears low_citation) — approximated by presence of
 *                                  cited sources + no expert-review citation flag
 *   - confidenceScore >= 0.5      (clears low_confidence)
 *                                  AND confidenceLevel !== 'low'
 *
 * SECURITY (H2 fix): `orgId` is REQUIRED for the HTTP replay route and scopes
 * the queue-row SELECT. When the row belongs to a different org (or does not
 * exist), the function throws — the caller maps this to 404 (never 403, to
 * avoid leaking existence). The delta-sync path resolves orgId from the
 * ingestion-run context.
 *
 * SECURITY (C1 fix): consult() is invoked with `mode:'replay'` so Stage 7
 * gap-capture and Stage 8 persist are both skipped — replay no longer tries
 * to write a messages row with the synthetic id or capture a duplicate gap.
 *
 * Throws if the queue row does not exist or is outside the passed orgId
 * (caller maps to 404).
 */
export async function replayGapTest(queueId: string, orgId?: string): Promise<ReplayGapTestResult> {
  // Scope by org when provided. The HTTP route always passes session.user.organizationId;
  // the delta-sync path resolves org from the ingestion-run context. When orgId
  // is absent (legacy/unit test only), we fall through to id-only scope — but
  // production callers MUST pass it for the IDOR protection to hold.
  const rowPredicate =
    orgId !== undefined
      ? and(eq(unansweredQueue.id, queueId), eq(unansweredQueue.orgId, orgId))
      : eq(unansweredQueue.id, queueId);

  const [row] = await db
    .select({
      id: unansweredQueue.id,
      conversationId: unansweredQueue.conversationId,
      redactedQuestion: unansweredQueue.redactedQuestion,
    })
    .from(unansweredQueue)
    .where(rowPredicate);

  if (!row) {
    throw new Error(`replayGapTest: unanswered_queue row not found: ${queueId}`);
  }

  // SECURITY (C1 fix): the replay messageId is NOT persisted (consult replay
  // mode skips Stage 8) — but we still use a valid uuid so any non-persisted
  // internal reference (e.g. audit meta, validator state) is well-formed.
  // conversationId is similarly a sentinel uuid, never inserted.
  const replayMessageId = '00000000-0000-0000-0000-000000000003';
  const replayConversationId = '00000000-0000-0000-0000-000000000002'; // sentinel

  const collected = await collectConsultEvents({
    question: row.redactedQuestion,
    session: systemSession(),
    messageId: replayMessageId,
    conversationId: replayConversationId,
  });

  // Reconstruct the 4 detection inputs from the collected stream.
  // citationCoverageBelow80: the detector derives this from the raw `violations`
  // array, which is not present in the stream. The closest stream-visible signal
  // is the `expert_review_required` event with a citation-coverage reason, OR an
  // answer with zero cited sources. We use both: coverage is below 80% if the
  // pipeline emitted a citation-coverage expert-review flag OR there are no cited
  // sources despite the LLM producing prose.
  const llmFailed = collected.hadLlmFallback;
  const topChunksLength = collected.sources.length;
  const confidenceScore = collected.confidenceScore ?? 0;
  const confidenceLevel = collected.confidenceLevel ?? 'low';
  const citationCoverageBelow80 =
    collected.citationCoverageFlagged ||
    (collected.prose.length > 0 && collected.sources.length === 0 && !llmFailed);

  const remainingReason = detectKnowledgeGap({
    confidenceScore,
    confidenceLevel,
    citationCoverageBelow80,
    topChunksLength,
    llmFailed,
  });

  const passed = remainingReason === null;

  // C1 fix (REQ-TRACEABILITY-011): verify answer edge integrity. The cited
  // message_sources from the replay must have corresponding evidence_nodes and
  // none should be stale-flagged. When the org has no traceability data yet,
  // the verifier returns intact=true (empty refIds). The result is observable
  // on the ReplayGapTestResult so callers (HTTP route, delta-sync) can gate
  // resolution on evidence-graph consistency.
  const messageSourceRefIds = collected.sources.map((s) => s.id);
  const edgeIntegrity = await verifyAnswerEdges(db, {
    orgId: orgId ?? '',
    messageSourceRefIds,
  });

  return {
    passed,
    answerWithCitations: collected.prose,
    sources: collected.sources,
    remainingReason,
    reasonSummary: passed
      ? 'all 4 gap conditions cleared after replay'
      : `gap still present: ${remainingReason}`,
    edgeIntegrity,
  };
}

/**
 * Collect a consult() async generator into a flat summary. Used by replay only —
 * production chat uses the streaming hook (useStreamingAnswer) instead.
 */
async function collectConsultEvents(args: {
  question: string;
  session: Session;
  messageId: string;
  conversationId: string;
}): Promise<{
  prose: string;
  sources: SourceItem[];
  confidenceScore: number | null;
  confidenceLevel: 'high' | 'med' | 'low' | null;
  hadLlmFallback: boolean;
  citationCoverageFlagged: boolean;
}> {
  let prose = '';
  const sources: SourceItem[] = [];
  let confidenceScore: number | null = null;
  let confidenceLevel: 'high' | 'med' | 'low' | null = null;
  let hadError = false;
  let citationCoverageFlagged = false;

  const events: AsyncGenerator<StreamEvent> = consult(
    { question: args.question, locale: 'ko', sourceFilter: 'all' },
    args.session,
    args.messageId,
    args.conversationId,
    undefined,
    // SECURITY (C1 fix): replay mode skips Stage 7 gap-capture and Stage 8 persist.
    { mode: 'replay' },
  );

  for await (const ev of events) {
    switch (ev.type) {
      case 'prose_delta':
        prose += ev.delta;
        break;
      case 'sources':
        sources.push(...ev.items);
        break;
      case 'confidence':
        confidenceScore = ev.score;
        confidenceLevel = ev.level;
        break;
      case 'expert_review_required':
        // The pipeline only emits citation-coverage as an expert-review reason when
        // citationCoverageBelow80 is true (consult.ts §369-376). Treat that as the
        // authoritative signal that coverage is still below 80%.
        if (ev.reason.includes('citation')) citationCoverageFlagged = true;
        break;
      case 'error':
        hadError = true;
        break;
      default:
        // trace / meta / structured blocks / done are not needed for the 4-condition check.
        break;
    }
  }

  // If the stream errored, treat as LLM failure (policy_blocked root cause).
  const hadLlmFallback = hadError || prose.includes('AI 응답 생성을 일시적으로 사용할 수 없습니다');

  return {
    prose,
    sources,
    confidenceScore,
    confidenceLevel,
    hadLlmFallback,
    citationCoverageFlagged,
  };
}

/**
 * Mark a queue item resolved after a passing replay (REQ-KNOWLEDGE-GAP-015).
 *
 * SECURITY (H2 fix): `orgId` scopes the row lookup AND the UPDATE WHERE clause.
 * When passed, a row outside the org is invisible (treated as not found → throw
 * → caller maps to 404). This closes the IDOR where a caller could resolve a
 * gap belonging to another org by knowing its queueId.
 *
 * Side-effects (design.md §4.3):
 *   1. unanswered_queue.status = 'resolved', resolved_at = NOW()
 *   2. GitHub issue comment (best-effort, never throws into the replay flow)
 *   3. audit_logs: knowledge_gap_resolved
 */
export async function markGapResolved(
  queueId: string,
  evidence: { answerWithCitations: string; sources: SourceItem[] },
  orgId?: string,
): Promise<void> {
  const rowPredicate =
    orgId !== undefined
      ? and(eq(unansweredQueue.id, queueId), eq(unansweredQueue.orgId, orgId))
      : eq(unansweredQueue.id, queueId);

  const [row] = await db
    .select({
      id: unansweredQueue.id,
      githubIssueNumber: unansweredQueue.githubIssueNumber,
    })
    .from(unansweredQueue)
    .where(rowPredicate);

  if (!row) {
    throw new Error(`markGapResolved: unanswered_queue row not found: ${queueId}`);
  }

  // Scope the UPDATE by orgId as well — defense-in-depth against any race that
  // moves the row between SELECT and UPDATE. The id+org conjunction is stable.
  // 21 CFR Part 11 §11.10(e) — Issue #378: the resolve UPDATE and the audit row
  // ride the SAME db.transaction. commentGapResolved is an external GitHub
  // side-effect → fired AFTER commit (matches the PR-B sendDigestEmail boundary
  // — external side-effects never block or roll back the audited mutation).
  await db.transaction(async (tx) => {
    await tx
      .update(unansweredQueue)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(rowPredicate);

    await writeAudit(
      {
        actor_id: null,
        action: 'knowledge_gap_resolved',
        resource_type: 'unanswered_queue',
        resource_id: queueId,
        meta_json: {
          source_count: evidence.sources.length,
          source_ids: evidence.sources.map((s) => s.id),
          github_issue_number: row.githubIssueNumber ?? null,
        },
      },
      tx,
    );
  });

  if (row.githubIssueNumber !== null) {
    await commentGapResolved(row.githubIssueNumber, {
      answerWithCitations: evidence.answerWithCitations,
      sourceTitles: evidence.sources.map((s) => s.title),
    });
  }
}
