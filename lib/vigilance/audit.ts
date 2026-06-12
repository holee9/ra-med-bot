// @MX:NOTE [AUTO] Vigilance-specific audit helpers wrapping the central writeAudit().
// @MX:SPEC SPEC-REGULA-VIGILANCE-001
//
// 21 CFR Part 11: every regulated vigilance action is recorded through the central
// append-only audit pipeline. meta_json is PII-free — only IDs, booleans, and
// report type labels are stored.

import { writeAudit } from '../audit';

/** REQ-VIG-021: a new adverse event was created. */
export async function auditVigilanceEventCreated(params: {
  userId: string;
  adverseEventId: string;
  deviceName: string;
}): Promise<void> {
  await writeAudit({
    actor_id: params.userId,
    action: 'vigilance_event_created',
    resource_type: 'adverse_event',
    resource_id: params.adverseEventId,
    meta_json: { deviceName: params.deviceName },
  });
}

/** REQ-VIG-022: reportability was assessed for an adverse event. */
export async function auditReportabilityAssessed(params: {
  userId: string;
  adverseEventId: string;
  fdaRequired: boolean;
  euRequired: boolean;
}): Promise<void> {
  await writeAudit({
    actor_id: params.userId,
    action: 'vigilance_reportability_assessed',
    resource_type: 'adverse_event',
    resource_id: params.adverseEventId,
    meta_json: {
      fdaRequired: params.fdaRequired,
      euRequired: params.euRequired,
    },
  });
}

/** REQ-VIG-023: a vigilance report draft was generated. */
export async function auditReportDrafted(params: {
  userId: string;
  reportId: string;
  reportType: string;
}): Promise<void> {
  await writeAudit({
    actor_id: params.userId,
    action: 'vigilance_report_drafted',
    resource_type: 'vigilance_report',
    resource_id: params.reportId,
    meta_json: { reportType: params.reportType },
  });
}

/** REQ-VIG-024: a vigilance report was exported. */
export async function auditReportExported(params: {
  userId: string;
  reportId: string;
  reportType: string;
}): Promise<void> {
  await writeAudit({
    actor_id: params.userId,
    action: 'vigilance_report_exported',
    resource_type: 'vigilance_report',
    resource_id: params.reportId,
    meta_json: { reportType: params.reportType },
  });
}
