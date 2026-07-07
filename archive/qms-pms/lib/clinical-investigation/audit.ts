// @MX:NOTE [AUTO] CI domain audit helpers — wrap writeAudit with PII-free meta.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-010)

// @MX:LEGACY archived from lib
// @MX:REASON Every clinical-investigation Route Handler records lifecycle events
//           via these helpers. The meta payload is deliberately PII-free (no
//           device serials, no patient identifiers, no free-text narrative from
//           the RA team) — only structured signal (pathway, confidence, counts).

import { type AuditDbHandle, writeAudit } from '@/lib/audit';

type CiAction =
  | 'ci.assessed'
  | 'ci.pathway_determined'
  | 'ci.protocol_updated'
  | 'ci.irb_package_drafted'
  | 'ci.event_recorded'
  | 'ci.results_linked'
  | 'ci.closed'
  | 'ci.close_blocked_signoff_missing';

interface CiAuditParams {
  actorId: string;
  investigationId: string;
  action: CiAction;
  meta?: Record<string, unknown>;
  tx?: AuditDbHandle;
}

function emit(params: CiAuditParams): Promise<void> {
  return writeAudit(
    {
      actor_id: params.actorId,
      action: params.action,
      resource_type: 'clinical_investigation',
      resource_id: params.investigationId,
      meta_json: {
        investigationId: params.investigationId,
        ...(params.meta ?? {}),
      },
    },
    params.tx,
  );
}

export function auditCiAssessed(
  params: CiAuditParams & {
    meta: { necessityStatus: string; confidence: string; citationCount: number };
  },
): Promise<void> {
  return emit({ ...params, action: 'ci.assessed' });
}

export function auditCiPathwayDetermined(
  params: CiAuditParams & { meta: { pathway: string; confidence: string } },
): Promise<void> {
  return emit({ ...params, action: 'ci.pathway_determined' });
}

export function auditCiProtocolUpdated(
  params: CiAuditParams & {
    meta: { endpointCount: number; inclusionCount: number; exclusionCount: number };
  },
): Promise<void> {
  return emit({ ...params, action: 'ci.protocol_updated' });
}

export function auditCiIrbPackageDrafted(
  params: CiAuditParams & {
    meta: { pathway: string; includeConsent: boolean; includeBrochure: boolean };
  },
): Promise<void> {
  return emit({ ...params, action: 'ci.irb_package_drafted' });
}

export function auditCiEventRecorded(
  params: CiAuditParams & { meta: { type: string } },
): Promise<void> {
  return emit({ ...params, action: 'ci.event_recorded' });
}

export function auditCiResultsLinked(
  params: CiAuditParams & { meta: { targetType: string; targetId: string } },
): Promise<void> {
  return emit({ ...params, action: 'ci.results_linked' });
}

export function auditCiClosed(
  params: CiAuditParams & { meta: { expertSignoffId: string } },
): Promise<void> {
  return emit({ ...params, action: 'ci.closed' });
}

export function auditCiCloseBlocked(
  params: CiAuditParams & { meta: { reason: string } },
): Promise<void> {
  return emit({ ...params, action: 'ci.close_blocked_signoff_missing' });
}
