// @MX:NOTE [AUTO] Standards revision detection daily cron (Issue #62).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-009/020, AC-04 structural)
// @MX:REASON Mirrors lib/inngest/digest/knowledge-gap-daily-digest.ts so the
//           Inngest serve endpoint discovers + triggers this function at 09:00
//           UTC daily. detectRevisions never throws on source failure — the
//           dedicated 'audit-detection' step records the
//           'standards.revision.detected' audit row, so the Inngest step stays
//           green.

import { INNGEST_EVENTS, inngest } from '../client';

/** Cron schedule: every day at 09:00 UTC. */
export const STANDARDS_REVISION_CRON = '0 9 * * *';

/**
 * Daily standards revision detection function. Registered with Inngest so the
 * dev/prod server triggers it on schedule. Optional manual trigger via the
 * standards/revision.trigger event lets operators replay detection.
 *
 * Graceful degradation (Charter [지양-3]): when no live crawler is configured
 * the function is a structural no-op — it records the attempt and returns.
 *
 * Audit trail (M-3 fix): the cron has no session/org context (system actor),
 * so it writes a single system-level 'standards.revision.detected' audit row
 * per run with triggeredBy='cron'. This mirrors the manual route
 * (app/api/standards/cron/detect/route.ts) which writes the same action with
 * triggeredBy='manual'. The knowledge-gap cron convention is to audit inside
 * the dispatched function (dispatchDailyDigest writes on success+failure);
 * detectRevisions is a pure detection stub that does NOT audit internally, so
 * the audit write belongs in this cron as a dedicated step.
 *
 * @MX:TODO #62-A/#62-B/#62-C — live crawlers will populate detectRevisions().
 * @MX:TODO #62-A — alert emission (emitStandardsAlert) is NOT wired here yet;
 *   the cron detects + audits but does not emit alerts until #62-A lands.
 */
export const standardsRevisionDailyFn = inngest.createFunction(
  {
    id: 'standards-revision-daily',
    name: 'Standards Revision Detector',
    triggers: [
      { cron: STANDARDS_REVISION_CRON },
      { event: INNGEST_EVENTS.STANDARDS_REVISION_TRIGGER },
    ],
  },
  async ({ step, logger }) => {
    // Lazy import — keeps the cron module import-light (L-003 pattern) and
    // avoids eagerly loading lib/audit → lib/kernel/db/client → lib/env at module
    // registration time (env validation requires DATABASE_URL etc. which are
    // absent in the Inngest function-registration test environment).
    const { detectRevisions, resolveDetectionContext } = await import(
      '../../standards/revision-detector'
    );
    const { writeAudit } = await import('@/lib/kernel/audit');

    const detectionCtx = resolveDetectionContext();
    const detected = await step.run('detect-revisions', () => detectRevisions(detectionCtx));

    // M-3: record the detection attempt so the timeline is observable from
    // the audit trail (the manual route already does this with triggeredBy='manual').
    // System actor — cron has no session. Non-PII meta only.
    await step.run('audit-detection', () =>
      writeAudit({
        actor_id: null,
        action: 'standards.revision.detected',
        resource_type: 'standards_catalog',
        resource_id: 'cron-daily',
        meta_json: {
          source: detectionCtx.hasActiveSource ? 'live' : 'noop',
          detectedCount: detected.length,
          triggeredBy: 'cron',
        },
      }),
    );

    logger.info(
      `[standards-revision-daily] detected ${detected.length} revisions (activeSource=${detectionCtx.hasActiveSource})`,
    );

    return {
      detectedCount: detected.length,
      hasActiveSource: detectionCtx.hasActiveSource,
      degraded: !detectionCtx.hasActiveSource,
    };
  },
);
