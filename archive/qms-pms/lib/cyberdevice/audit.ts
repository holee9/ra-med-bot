// @MX:NOTE [AUTO] Cybersecurity-specific audit helpers wrapping writeAudit().
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-013/014)

// @MX:LEGACY archived from lib
//
// 21 CFR Part 11: every regulated cybersecurity action is recorded through the
// central append-only audit pipeline. meta_json is PII-free — only IDs,
// component counts, CVE ids, and severity labels are stored.
//
// H2 atomicity (Part 11): every wrapper accepts an optional `tx` handle so the
// audit insert rides the same transaction boundary as the mutation. Callers
// MUST wrap mutation + audit in db.transaction and pass `tx` here.

import { type AuditDbHandle, writeAudit } from '../audit';

type AuditTx = AuditDbHandle | undefined;

/** REQ-001: threat model generated from architecture input. */
export async function auditThreatModeled(
  params: { userId: string; threatModelId: string; projectId: string; threatCount: number },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.threat_modeled',
      resource_type: 'threatModel',
      resource_id: params.threatModelId,
      meta_json: { projectId: params.projectId, threatCount: params.threatCount },
    },
    tx,
  );
}

/** REQ-003: SBOM imported. */
export async function auditSbomImported(
  params: {
    userId: string;
    sbomId: string;
    projectId: string;
    format: 'spdx' | 'cyclonedx';
    version: string;
    componentCount: number;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.sbom_imported',
      resource_type: 'sbom',
      resource_id: params.sbomId,
      meta_json: {
        projectId: params.projectId,
        format: params.format,
        version: params.version,
        componentCount: params.componentCount,
      },
    },
    tx,
  );
}

/** REQ-003: SBOM format validation result recorded. */
export async function auditSbomValidated(
  params: {
    userId: string;
    sbomId: string;
    projectId: string;
    validated: boolean;
    componentCount: number;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.sbom_validated',
      resource_type: 'sbom',
      resource_id: params.sbomId,
      meta_json: {
        projectId: params.projectId,
        validated: params.validated,
        componentCount: params.componentCount,
      },
    },
    tx,
  );
}

/** REQ-004: two SBOM versions diffed. */
export async function auditSbomDiffed(
  params: {
    userId: string;
    projectId: string;
    versionA: string;
    versionB: string;
    added: number;
    removed: number;
    updated: number;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.sbom_diffed',
      resource_type: 'sbom',
      resource_id: `${params.versionA}..${params.versionB}`,
      meta_json: {
        projectId: params.projectId,
        versionA: params.versionA,
        versionB: params.versionB,
        added: params.added,
        removed: params.removed,
        updated: params.updated,
      },
    },
    tx,
  );
}

/** REQ-005/006: CVE/KEV impact analysis performed. */
export async function auditCveAnalyzed(
  params: {
    userId: string;
    projectId: string;
    sbomId: string;
    cveCount: number;
    affectedComponentCount: number;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.cve_analyzed',
      resource_type: 'cveImpact',
      resource_id: params.sbomId,
      meta_json: {
        projectId: params.projectId,
        sbomId: params.sbomId,
        cveCount: params.cveCount,
        affectedComponentCount: params.affectedComponentCount,
      },
    },
    tx,
  );
}

/** REQ-007: secure update / patch / end-of-support plan generated. */
export async function auditUpdatePlanCreated(
  params: {
    userId: string;
    projectId: string;
    bundleId: string;
    patchCadenceDays: number;
    endOfSupportDate: string | null;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.update_plan_created',
      resource_type: 'cyberEvidenceBundle',
      resource_id: params.bundleId,
      meta_json: {
        projectId: params.projectId,
        patchCadenceDays: params.patchCadenceDays,
        endOfSupportDate: params.endOfSupportDate,
      },
    },
    tx,
  );
}

/** REQ-009/012/014: cybersecurity evidence bundle assembled. */
export async function auditEvidenceBundled(
  params: {
    userId: string;
    bundleId: string;
    projectId: string;
    threatModelId: string;
    sbomId: string;
    linkedSubmissionId?: string;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.evidence_bundled',
      resource_type: 'cyberEvidenceBundle',
      resource_id: params.bundleId,
      meta_json: {
        projectId: params.projectId,
        threatModelId: params.threatModelId,
        sbomId: params.sbomId,
        linkedSubmissionId: params.linkedSubmissionId ?? null,
      },
    },
    tx,
  );
}

/** REQ-010: residual cyber risk linked to ISO 14971 risk item. */
export async function auditRiskLinked(
  params: {
    userId: string;
    cveImpactId: string;
    riskItemId: string;
    projectId: string;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.risk_linked',
      resource_type: 'cveImpact',
      resource_id: params.cveImpactId,
      meta_json: {
        riskItemId: params.riskItemId,
        projectId: params.projectId,
      },
    },
    tx,
  );
}

/** REQ-013: entitlement-less access blocked. */
export async function auditCyberAccessDenied(
  params: { userId: string; projectId: string; reason: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.access_denied',
      resource_type: 'cyberdevice',
      resource_id: params.projectId,
      meta_json: { reason: params.reason, projectId: params.projectId },
    },
    tx,
  );
}

/**
 * REQ-011 (H-2 fix): durable reassessment signal. When a CVE triggers a
 * change-control + risk re-evaluation predicate (matched, severity escalation,
 * or KEV addition), this audit row makes the signal 21 CFR Part 11 traceable.
 * Written inside the cve-analysis transaction so it rides the same atomicity
 * boundary as the cve_impact insert. Full change-control workflow enqueue
 * (#54 wiring) remains @MX:TODO; this audit row is the minimum durable trace.
 */
export async function auditReassessTriggered(
  params: {
    userId: string;
    projectId: string;
    cveImpactId: string;
    cveId: string;
    severity: string;
    kevFlag: boolean;
    reason: string;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'cyber.reassess_triggered',
      resource_type: 'cveImpact',
      resource_id: params.cveImpactId,
      meta_json: {
        projectId: params.projectId,
        cveId: params.cveId,
        severity: params.severity,
        kevFlag: params.kevFlag,
        reason: params.reason,
      },
    },
    tx,
  );
}
