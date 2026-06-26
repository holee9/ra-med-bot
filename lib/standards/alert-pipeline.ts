// @MX:NOTE [AUTO] Standards alert emitter — local emit (Notifications Hub wiring deferred).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-011/017/018)
//
// Emits a standards alert by inserting a standards_updates row (with alert_tier)
// and writing the 'standards.alert.emitted' audit row — both inside the same
// withTenantScope transaction for 21 CFR Part 11 atomicity.
//
// @MX:TODO #62-A — emitStandardsAlert has ZERO callers today. It is reserved
//   for #62-A: when live crawlers (iso/iec/cen/astm) populate detectRevisions()
//   with real data, standards-revision-daily will call emitStandardsAlert per
//   detected revision. The cron currently detects + audits but does NOT emit
//   alerts until #62-A lands (Charter scope discipline — honest deferral).
// @MX:TODO #62-D — Wire alerts to Notifications Hub (#52) when ready. Today
//   the emit is local-only (DB row + audit). The Notifications Hub consumer
//   wiring is a follow-up so the pipeline is not blocked on #52.
// @MX:TODO #62-E — Standards alert card in Regulatory Radar dashboard.

import { writeAudit } from '@/lib/audit';
import { withTenantScope } from '@/lib/db/client';
import { standardsUpdates } from '@/lib/db/schema';
import type { AlertTier } from './transition-calculator';

export interface StandardsAlertInput {
  orgId: string;
  actorId: string | null;
  standardId: string;
  revisionLabel: string;
  alertTier: AlertTier;
  ojPublicationDate?: Date | null;
  dateOfWithdrawal?: Date | null;
  impactSummary?: string | null;
  source?: string;
}

export interface EmittedAlert {
  updateId: string;
  standardId: string;
  alertTier: AlertTier;
}

/**
 * Emit a standards alert: insert standards_updates + audit in one tx.
 *
 * The withTenantScope callback tx is threaded into writeAudit so the alert
 * insert rides the same transaction as the audit row (21 CFR Part 11 atomicity
 * — H2 pattern, mirrors lib/project-memory/manager.ts).
 */
export async function emitStandardsAlert(input: StandardsAlertInput): Promise<EmittedAlert> {
  return withTenantScope(input.orgId, async (tx) => {
    const [inserted] = await tx
      .insert(standardsUpdates)
      .values({
        orgId: input.orgId,
        standardId: input.standardId,
        revisionLabel: input.revisionLabel,
        alertTier: input.alertTier,
        ojPublicationDate: input.ojPublicationDate
          ? input.ojPublicationDate.toISOString().slice(0, 10)
          : null,
        dateOfWithdrawal: input.dateOfWithdrawal
          ? input.dateOfWithdrawal.toISOString().slice(0, 10)
          : null,
        impactSummary: input.impactSummary ?? null,
        source: input.source ?? 'cron',
      })
      .returning({ id: standardsUpdates.id });

    if (!inserted) {
      throw new Error('standards_updates insert returned no row');
    }

    await writeAudit(
      {
        actor_id: input.actorId,
        action: 'standards.alert.emitted',
        resource_type: 'standards_update',
        resource_id: inserted.id,
        meta_json: {
          standardId: input.standardId,
          alertTier: input.alertTier,
          revisionLabel: input.revisionLabel,
          source: input.source ?? 'cron',
        },
      },
      tx,
    );

    return {
      updateId: inserted.id,
      standardId: input.standardId,
      alertTier: input.alertTier,
    };
  });
}
