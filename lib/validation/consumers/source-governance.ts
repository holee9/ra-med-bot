// @MX:NOTE [AUTO] Consumer wrapper for source-governance dashboard snapshot (REQ-SOURCE-GOV-012).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { getGovernanceDashboard } from '@/lib/source-governance/dashboard';
import type { GovernanceDashboard } from '@/lib/source-governance/dashboard';

// Re-export GovernanceDashboard type for barrel export consistency.
export type { GovernanceDashboard };

/**
 * Capture a snapshot of the governance dashboard for an organization.
 *
 * Thin wrapper around getGovernanceDashboard (transparent pass-through).
 * The consumer layer exists to provide a consistent import path for validation
 * workflows that aggregate metrics across multiple domains.
 *
 * @param params.orgId - Organization to scope (required)
 * @returns Governance dashboard with counts, review-due sources, and stale citation artifacts
 */
export async function snapshotSourceGovernance(params: {
  orgId: string;
}): Promise<GovernanceDashboard> {
  // Transparent pass-through — no transformation, direct delegation.
  return getGovernanceDashboard(params);
}
