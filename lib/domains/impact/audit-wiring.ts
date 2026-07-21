// SPEC-REGULA-IMPACT-001 — audit logging helpers for impact analysis events.
// @MX:NOTE [AUTO] Issue #366 — these helpers now forward an optional `tx` so the
// @MX:SPEC audit INSERT rides the same transaction as the mutation it records
// (21 CFR Part 11 §11.10(e)). Callers that wrap mutation + audit in one
// `db.transaction` (see analyzer.ts) pass the `tx` here so a transient failure
// between the two rolls back both — the audit row can never be orphaned.

import { type AuditDbHandle, writeAudit } from '@/lib/kernel/audit';
import type { ImpactLevel } from './types';

export async function auditAssessmentCreated(
  params: {
    actor_id: string;
    assessment_id: string;
    project_id: string;
    regulatory_update_id: string;
    impact_level: ImpactLevel;
  },
  tx?: AuditDbHandle,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.actor_id,
      action: 'impact.assessment_created',
      resource_type: 'impact_assessment',
      resource_id: params.assessment_id,
      meta_json: {
        project_id: params.project_id,
        regulatory_update_id: params.regulatory_update_id,
        impact_level: params.impact_level,
      },
    },
    tx,
  );
}

export async function auditCriticalDetected(
  params: {
    actor_id: string;
    assessment_id: string;
    project_id: string;
    regulatory_update_id: string;
  },
  tx?: AuditDbHandle,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.actor_id,
      action: 'impact.critical_detected',
      resource_type: 'impact_assessment',
      resource_id: params.assessment_id,
      meta_json: {
        project_id: params.project_id,
        regulatory_update_id: params.regulatory_update_id,
      },
    },
    tx,
  );
}

export async function auditActionItemCreated(
  params: {
    actor_id: string;
    action_item_id: string;
    assessment_id: string;
    project_id: string;
  },
  tx?: AuditDbHandle,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.actor_id,
      action: 'impact.action_item_created',
      resource_type: 'impact_action_item',
      resource_id: params.action_item_id,
      meta_json: {
        assessment_id: params.assessment_id,
        project_id: params.project_id,
      },
    },
    tx,
  );
}
