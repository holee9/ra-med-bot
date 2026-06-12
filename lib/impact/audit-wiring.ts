// SPEC-REGULA-IMPACT-001 — audit logging helpers for impact analysis events.

import { writeAudit } from '@/lib/audit';
import type { ImpactLevel } from './types';

export async function auditAssessmentCreated(params: {
  actor_id: string;
  assessment_id: string;
  project_id: string;
  regulatory_update_id: string;
  impact_level: ImpactLevel;
}): Promise<void> {
  await writeAudit({
    actor_id: params.actor_id,
    action: 'impact.assessment_created',
    resource_type: 'impact_assessment',
    resource_id: params.assessment_id,
    meta_json: {
      project_id: params.project_id,
      regulatory_update_id: params.regulatory_update_id,
      impact_level: params.impact_level,
    },
  });
}

export async function auditCriticalDetected(params: {
  actor_id: string;
  assessment_id: string;
  project_id: string;
  regulatory_update_id: string;
}): Promise<void> {
  await writeAudit({
    actor_id: params.actor_id,
    action: 'impact.critical_detected',
    resource_type: 'impact_assessment',
    resource_id: params.assessment_id,
    meta_json: {
      project_id: params.project_id,
      regulatory_update_id: params.regulatory_update_id,
    },
  });
}

export async function auditActionItemCreated(params: {
  actor_id: string;
  action_item_id: string;
  assessment_id: string;
  project_id: string;
}): Promise<void> {
  await writeAudit({
    actor_id: params.actor_id,
    action: 'impact.action_item_created',
    resource_type: 'impact_action_item',
    resource_id: params.action_item_id,
    meta_json: {
      assessment_id: params.assessment_id,
      project_id: params.project_id,
    },
  });
}
