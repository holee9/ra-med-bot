// SPEC-V3-IMPACT-001 M9: Audit logging for impact wizard operations.
// @MX:NOTE [AUTO] Audit logger wraps writeAudit with impact-specific helpers.
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-12, AC-IMP-13)

import { writeAudit } from '@/lib/kernel/audit';
import type { Database } from '@/lib/kernel/db/client';

export interface ImpactCheckContext {
  actorId: string;
  orgId: string;
  productId: string;
  changeType: string;
  markets: string[];
  signal: 'green' | 'yellow' | 'red';
}

export interface TicketCreateContext {
  actorId: string;
  ticketId: string;
  orgId: string;
  signal: 'green' | 'yellow' | 'red';
}

export interface CriticalDetectedContext {
  actorId: string;
  assessmentId: string;
  projectId: string;
  signal: 'red';
}

/**
 * Logs impact check completion (wizard execution).
 * Called after Layer 1-4 analysis completes.
 */
export async function logImpactCheck(tx: Database, context: ImpactCheckContext): Promise<void> {
  await writeAudit(
    {
      actor_id: context.actorId,
      action: 'impact.check',
      resource_type: 'impact_assessment',
      resource_id: context.productId,
      meta_json: {
        org_id: context.orgId,
        change_type: context.changeType,
        markets: context.markets.join(','),
        signal: context.signal,
      },
    },
    tx,
  );
}

/**
 * Logs ticket creation for manual review.
 * Called when LLM confidence < 80% (Layer 3).
 */
export async function logTicketCreate(tx: Database, context: TicketCreateContext): Promise<void> {
  await writeAudit(
    {
      actor_id: context.actorId,
      action: 'impact.ticket.create',
      resource_type: 'inbox_ticket',
      resource_id: context.ticketId,
      meta_json: {
        org_id: context.orgId,
        signal: context.signal,
      },
    },
    tx,
  );
}

/**
 * Logs critical signal detection.
 * Called when signal calculation returns 'red'.
 */
export async function logCriticalDetected(
  tx: Database,
  context: CriticalDetectedContext,
): Promise<void> {
  await writeAudit(
    {
      actor_id: context.actorId,
      action: 'impact.critical_detected',
      resource_type: 'impact_assessment',
      resource_id: context.assessmentId,
      meta_json: {
        project_id: context.projectId,
        signal: context.signal,
      },
    },
    tx,
  );
}
