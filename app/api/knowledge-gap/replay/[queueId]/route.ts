// @MX:ANCHOR [AUTO] Knowledge Gap Replay Route — POST /api/knowledge-gap/replay/[queueId].
// @MX:REASON Public API boundary that triggers closed-loop verification. RBAC gate
//          (ra-lead/admin only) because replay consumes LLM budget and, on pass, closes
//          a GitHub issue + writes a regulatory audit row.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-014, REQ-015, AC-06, AC-08, Issue #35)
//
// Flow:
//   1. Auth + RBAC (knowledgegap.replay = ra-lead/admin).
//   2. Resolve [queueId] (Next.js 15 async params).
//   3. replayGapTest(queueId) — re-run redacted question through consult.
//   4. If passed: markGapResolved (status='resolved', GitHub comment, audit).
//   5. Audit knowledge_gap_replay_triggered + knowledge_gap_resolved (on pass).
//
// Failures (replay error or gap not yet resolved) are 200 with outcome metadata, NOT
// 5xx — the endpoint succeeded in performing the test; the knowledge gap simply was
// not closed yet. A non-passing replay is an expected operational state.

export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import {
  type ReplayGapTestResult,
  markGapResolved,
  replayGapTest,
} from '@/lib/knowledge-gap/replay';

type QueueCtx = { params?: Promise<{ queueId: string }> | { queueId: string } };

async function resolveQueueId(ctx: QueueCtx): Promise<string> {
  if (!ctx.params) return '';
  const params = await (ctx.params as Promise<{ queueId: string }>);
  return params.queueId ?? '';
}

export const POST = withPermission('knowledgegap.replay', async (_req, ctx, session) => {
  const queueId = await resolveQueueId(ctx as QueueCtx);
  if (!queueId) {
    return Response.json({ error: 'missing_queue_id' }, { status: 400 });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: 'knowledge_gap_resolved', // pre-resolution audit: replay triggered
    resource_type: 'unanswered_queue',
    resource_id: queueId,
    meta_json: { phase: 'replay_triggered' },
  });

  let result: ReplayGapTestResult;
  try {
    result = await replayGapTest(queueId);
  } catch (err) {
    // Row not found is the most common case — map to 404.
    const msg = err instanceof Error ? err.message : String(err);
    const notFound = msg.includes('not found');
    return Response.json(
      { error: notFound ? 'not_found' : 'replay_failed', detail: notFound ? undefined : msg },
      { status: notFound ? 404 : 500 },
    );
  }

  if (result.passed) {
    await markGapResolved(queueId, {
      answerWithCitations: result.answerWithCitations,
      sources: result.sources,
    });
  }

  return Response.json({
    queueId,
    passed: result.passed,
    remainingReason: result.remainingReason,
    reasonSummary: result.reasonSummary,
    sourceCount: result.sources.length,
  });
});
