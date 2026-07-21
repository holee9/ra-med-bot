// @MX:NOTE [AUTO] GET /api/rlhf/calibration — confidence-calibration detection view.
// @MX:SPEC SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3, REQ-RLHF-005/006/014/015)
// @MX:REASON Surfaces confidence-bucket × observed-feedback aggregates + the
//           detector's candidate list (overconfident / underconfident buckets)
//           for RA-Lead review. Reuses rlhf.feedback RBAC (ra-member+) — no
//           new permission action. RLS is inert project-wide (#239 debt), so
//           org isolation is enforced at the query layer via the
//           messages -> conversations -> projects 3-hop join scoped to the
//           caller's orgId (mirrors heatmap / feedback-aggregate routes).
//
// Charter [지양-2]/[지양-4]: this route is DETECTION + VIEW only. It does NOT
// persist candidates (no write on GET). Candidate persistence happens via a
// POST follow-up that an RA Lead triggers after reviewing the aggregates.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
import { answerFeedback, conversations, messages, projects } from '@/lib/kernel/db/schema';
import {
  type ConfidenceFeedbackSample,
  aggregateConfidenceFeedback,
  detectCalibrationCandidates,
} from '@/lib/rlhf/calibration-detector';
import { eq } from 'drizzle-orm';

/**
 * REQ-RLHF-005/006: return per-bucket confidence × feedback aggregates and
 * the detector's candidate list for the caller's org.
 */
export const GET = withPermission('rlhf.feedback', async (request, _ctx, session) => {
  const url = new URL(request.url);
  const minSampleSize = Number(url.searchParams.get('minSampleSize') ?? '5');
  const maxTolerance = Number(url.searchParams.get('maxTolerance') ?? '0.15');

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  // C-2 IDOR: scope to the caller's org via the 3-hop join so NO cross-org
  // feedback rows are returned. #239 Phase 2: withTenantScope sets the
  // app.current_org_id GUC for RLS enforce; app-level eq(projects.organizationId)
  // is retained as defense-in-depth (RLS inert until service-role bypass dropped).
  const rows = await withTenantScope(orgId, async (dbs) =>
    dbs
      .select({
        confidenceScore: messages.confidenceScore,
        rating: answerFeedback.rating,
      })
      .from(answerFeedback)
      .innerJoin(messages, eq(messages.id, answerFeedback.messageId))
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(projects, eq(projects.id, conversations.projectId))
      .where(eq(projects.organizationId, orgId)),
  );

  // Project to the detector's sample shape. confidence_score is numeric(4,3)
  // so Drizzle returns it as a string; parse to number. null/NaN confidence
  // is passed through — aggregateConfidenceFeedback drops unbucketable samples.
  const samples: ConfidenceFeedbackSample[] = rows.map((r) => {
    const raw = r.confidenceScore;
    const n = raw === null || raw === undefined ? null : Number(raw);
    return {
      confidence: n !== null && Number.isFinite(n) ? n : null,
      rating: r.rating,
    };
  });

  const aggregates = aggregateConfidenceFeedback(samples);
  const candidates = detectCalibrationCandidates(samples, {
    minSampleSize: Number.isFinite(minSampleSize) ? minSampleSize : undefined,
    maxTolerance: Number.isFinite(maxTolerance) ? maxTolerance : undefined,
  });

  return Response.json({
    orgId,
    aggregates,
    candidates,
    sampledAt: new Date().toISOString(),
    thresholds: { minSampleSize, maxTolerance },
  });
});
