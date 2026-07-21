/**
 * SPEC-V3-AUDIT-CHAIN-001 M3: Periodic Verification Cron.
 *
 * Daily forward-chain verification of audit_logs for 21 CFR Part 11 §11.10(e)
 * tamper-evidence. verifyAuditChain() queries the full table and walks the
 * chain (Option A) — a partial 24h window cannot resolve the boundary row's
 * expected previous_hash without prior-chain context, so full-chain verify is
 * the correct mode for compliance.
 *
 * AC-7: violations trigger a system-actor 'audit_chain.violation_detected' audit event.
 * AC-8: empty table / no violations → graceful return; cron never throws.
 *
 * Mirrors lib/inngest/standards/standards-revision-daily.ts (lazy imports, system actor).
 *
 * @MX:ANCHOR [AUTO] auditChainVerifyDailyFn — 21 CFR Part 11 periodic chain verification.
 * @MX:REASON Cron-scheduled verification. fan_in = Inngest trigger + optional manual event.
 *            Tamper-evidence invariant: detects chain breaks from concurrent/buggy code.
 * @MX:SPEC SPEC-V3-AUDIT-CHAIN-001 (REQ-AC-009, REQ-AC-010, AC-7, AC-8, NFR-AC-002)
 */

import { INNGEST_EVENTS, inngest } from '../client';

/** Cron schedule: every day at 09:00 UTC (matches standards-revision-daily cadence). */
export const AUDIT_CHAIN_VERIFY_CRON = '0 9 * * *';

export const auditChainVerifyDailyFn = inngest.createFunction(
  {
    id: 'audit-chain-verify-daily',
    name: 'Audit Chain Verifier',
    triggers: [
      { cron: AUDIT_CHAIN_VERIFY_CRON },
      { event: INNGEST_EVENTS.AUDIT_CHAIN_VERIFY_TRIGGER },
    ],
  },
  async ({ step, logger }) => {
    // Lazy imports keep the cron module import-light (L-003 pattern) and avoid
    // eagerly loading lib/kernel/db/client → lib/env at function-registration time.
    const { verifyAuditChain } = await import('../../kernel/audit/verify-chain');
    const { writeAudit } = await import('@/lib/kernel/audit');

    try {
      const result = await step.run('verify-chain', () => verifyAuditChain());

      if (result.violations.length > 0) {
        // AC-7: record a single system-actor alert event summarizing the violations.
        await step.run('alert-violation', () =>
          writeAudit({
            actor_id: null, // system actor (no session)
            action: 'audit_chain.violation_detected',
            resource_type: 'audit_logs',
            resource_id: 'system',
            meta_json: {
              count: result.violations.length,
              checked: result.checked,
              sample: result.violations.slice(0, 10).map((v) => ({
                rowId: v.rowId,
                chainSeq: v.chainSeq,
                reason: v.reason,
              })),
            },
          }),
        );
        logger.error(
          `[audit-chain-verify-daily] ${result.violations.length} violation(s) across ${result.checked} rows`,
        );
      } else {
        logger.info(
          `[audit-chain-verify-daily] chain OK — ${result.checked} row(s) verified, no violations`,
        );
      }

      return {
        ok: result.ok,
        violationsCount: result.violations.length,
        checkedCount: result.checked,
      };
    } catch (error) {
      // AC-8: graceful degradation — never throw out of the cron. Log only; do NOT
      // write an audit row (there is no enum value for "verify-failed" and a
      // broken verification must not itself corrupt the chain it guards).
      logger.error(
        `[audit-chain-verify-daily] verification errored: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { ok: false, violationsCount: 0, checkedCount: 0, error: String(error) };
    }
  },
);
