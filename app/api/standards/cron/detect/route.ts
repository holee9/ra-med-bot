// @MX:NOTE [AUTO] POST /api/standards/cron/detect — manual trigger for revision detection (Issue #62).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-009/020, AC-04 structural)
// @MX:REASON The primary trigger is the Inngest daily cron
//   (lib/inngest/standards/standards-revision-daily.ts). This route exists so
//   operators can replay detection manually (e.g. after wiring a new crawler
//   in #62-A). standards.manage (ra-lead) — cron trigger is a write-adjacent
//   operation that may emit alerts.

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
import { detectRevisions, resolveDetectionContext } from '@/lib/standards/revision-detector';

// POST /api/standards/cron/detect — run revision detection synchronously.
export const POST = withPermission('standards.manage', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  const detectionCtx = resolveDetectionContext();
  // Graceful-degradation: returns [] when no source configured. The audit row
  // still records the attempt so the detection timeline is observable.
  const raw = await detectRevisions(detectionCtx);

  await withTenantScope(orgId, async (tx) => {
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'standards.revision.detected',
        resource_type: 'standards_catalog',
        // Org-scoped detection event; no single standard when detection is a no-op.
        resource_id: orgId,
        meta_json: {
          source: detectionCtx.hasActiveSource ? 'live' : 'noop',
          detectedCount: raw.length,
          triggeredBy: 'manual',
        },
      },
      tx,
    );
  });

  return Response.json({
    detectedCount: raw.length,
    hasActiveSource: detectionCtx.hasActiveSource,
    degraded: !detectionCtx.hasActiveSource,
    note: detectionCtx.hasActiveSource
      ? 'Live source configured.'
      : 'No live crawler configured; detection is a no-op until #62-A/#62-B/#62-C land.',
  });
});
