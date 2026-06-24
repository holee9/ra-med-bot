// @MX:NOTE [AUTO] Secure update / patch / end-of-support plan generator (REQ-007).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-007)
//
// Deterministic plan assembly. The output is a JSONB blob stored on
// cyber_evidence_bundle.update_plan and cited in the FDA Premarket
// Cybersecurity Guidance "Secure Update" section.

import type { UpdatePlan } from './types';
import type { UpdatePlanInput } from './types';

export function generateUpdatePlan(input: UpdatePlanInput): UpdatePlan {
  return {
    patchCadenceDays: input.patchCadenceDays,
    endOfSupportDate: input.endOfSupportDate ?? null,
    // Regulatory baseline: every firmware/software update MUST be signed.
    signingRequired: true,
    // 30-day rollback window so a failed update can be reverted safely.
    rollbackWindowDays: 30,
    stages: [
      {
        name: 'identification',
        description:
          'Vulnerability identified via CVE monitoring, customer report, or internal audit.',
      },
      {
        name: 'risk_assessment',
        description:
          'Assess CVSS severity + clinical impact; ISO 14971 risk item updated (REQ-010).',
      },
      {
        name: 'development',
        description:
          'Patch developed against the affected component following IEC 81001-5-1 secure-coding controls.',
      },
      {
        name: 'signing',
        description: 'Signed build produced; signature verified before deployment.',
      },
      {
        name: 'staged_rollout',
        description: `Canary → 25% → 100% rollout over ${input.patchCadenceDays}-day cadence with monitoring.`,
      },
      {
        name: 'documentation',
        description: 'SBOM version bumped; change-control assessment triggered (REQ-011).',
      },
    ],
  };
}
