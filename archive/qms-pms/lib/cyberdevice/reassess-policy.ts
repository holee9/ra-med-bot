// @MX:NOTE [AUTO] Pure change-control re-eval predicate (REQ-011).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-011)

// @MX:LEGACY archived from lib
//
// Split out of risk-linkage.ts so importing this pure predicate does NOT drag
// in the Drizzle db client (which would env-parse on module load). The db-backed
// linkCveImpactToRiskItem lives in risk-linkage.ts; callers that only need the
// predicate import it from here.

import type { CveSeverity } from './types';

/**
 * REQ-011: decide whether a vulnerability change warrants a #54 Change Control
 * + #46 Risk re-evaluation. Deterministic predicate.
 *
 * Triggers:
 *   - a new CVE that matches >=1 product component (matched=true), OR
 *   - severity escalation (previous severity was lower), OR
 *   - KEV list addition (kevFlag true)
 */
export function shouldTriggerReassessment(change: {
  matched: boolean;
  previousSeverity?: CveSeverity;
  newSeverity: CveSeverity;
  kevFlag: boolean;
}): boolean {
  if (change.kevFlag) return true;
  if (change.matched && change.previousSeverity === undefined) return true;
  if (
    change.previousSeverity !== undefined &&
    severityRank(change.newSeverity) > severityRank(change.previousSeverity)
  ) {
    return true;
  }
  return false;
}

const SEVERITY_ORDER: CveSeverity[] = ['none', 'low', 'medium', 'high', 'critical'];
function severityRank(s: CveSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}
