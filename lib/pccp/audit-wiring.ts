// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-021, REQ-PCCP-022, REQ-PCCP-023, REQ-PCCP-015, REQ-PCCP-024)
// Audit wrappers for all PCCP-regulated events (21 CFR Part 11 compliance).

import { type AuditDbHandle, writeAudit } from '@/lib/kernel/audit';
import type { PccpComponentType, PccpStatus } from './types';

export async function auditPccpCreated(
  params: {
    actorId: string;
    pccpVersionId: string;
    deviceId: string;
    deviceName: string;
  },
  // 21 CFR Part 11 §11.10(e) — Issue #378: optional caller tx so the audit
  // rides the same transaction as the pccp_versions INSERT (pccp/route.ts).
  tx?: AuditDbHandle,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.actorId,
      action: 'pccp_created',
      resource_type: 'pccp_version',
      resource_id: params.pccpVersionId,
      meta_json: { deviceId: params.deviceId, deviceName: params.deviceName },
    },
    tx,
  );
}

export async function auditPccpComponentCompleted(params: {
  actorId: string;
  pccpVersionId: string;
  componentType: PccpComponentType;
}): Promise<void> {
  await writeAudit({
    actor_id: params.actorId,
    action: 'pccp_component_completed',
    resource_type: 'pccp_component',
    resource_id: params.pccpVersionId,
    meta_json: { componentType: params.componentType },
  });
}

export async function auditPccpExpertApproved(
  params: {
    actorId: string;
    pccpVersionId: string;
  },
  // 21 CFR Part 11 §11.10(e) — Issue #378: optional caller tx so the approval
  // audit rides the same transaction as transitionPccpStatus (pccp/approve).
  tx?: AuditDbHandle,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.actorId,
      action: 'pccp_expert_approved',
      resource_type: 'pccp_version',
      resource_id: params.pccpVersionId,
      meta_json: {},
    },
    tx,
  );
}

export async function auditPccpAlgorithmChangeTriggered(params: {
  actorId: string;
  pccpVersionId: string;
  triggerReason: string;
}): Promise<void> {
  await writeAudit({
    actor_id: params.actorId,
    action: 'pccp_algorithm_change_triggered',
    resource_type: 'pccp_version',
    resource_id: params.pccpVersionId,
    meta_json: { triggerReason: params.triggerReason },
  });
}

export async function auditPccpStatusChanged(
  params: {
    actorId: string;
    pccpVersionId: string;
    fromStatus: PccpStatus;
    toStatus: PccpStatus;
  },
  // 21 CFR Part 11 §11.10(e) — Issue #378: optional caller tx so the status
  // change audit rides the same transaction as transitionPccpStatus (pccp/approve).
  tx?: AuditDbHandle,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.actorId,
      action: 'pccp_status_changed',
      resource_type: 'pccp_version',
      resource_id: params.pccpVersionId,
      meta_json: { fromStatus: params.fromStatus, toStatus: params.toStatus },
    },
    tx,
  );
}
