// @MX:NOTE [AUTO] Pure complaint → adverse-event mapping + reportability assessment.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-002)
//
// Separated from reportability.ts so the pure mapping + assessment logic can
// be unit-tested without triggering lib/db/client env validation. The DB
// persistence (persistComplaintReportability) remains in reportability.ts.

import { assessReportability } from '@/lib/vigilance/reportability-engine';
import type { AdverseEventInput } from '@/lib/vigilance/reportability-engine';
import type { ComplaintIntake, ComplaintReportabilityResult } from './types';

/**
 * Map a ComplaintIntake to the vigilance engine's AdverseEventInput shape.
 * REQ-002: the vigilance engine (#61) owns the decision rules; we only adapt
 * the data shape so the same deterministic FDA/EU rules apply to complaints.
 */
export function mapComplaintToAdverseEvent(intake: ComplaintIntake): AdverseEventInput {
  return {
    eventDescription: intake.eventDescription,
    patientOutcome: intake.patientOutcome,
    deviceCategory: intake.deviceCategory,
    eventDate: intake.eventDate,
    awarenessDate: intake.awarenessDate,
    isManufacturerAware: intake.isManufacturerAware,
  };
}

/**
 * Run the vigilance decision engine on a stored complaint and return the
 * reportability result. Pure function — does NOT persist. Callers persist +
 * audit in a transaction.
 *
 * REQ-002 reuse contract: assessReportability (lib/vigilance/reportability-engine.ts)
 * is the single source of truth for FDA MDR (21 CFR 803) + EU MDV (Art. 87) rules.
 */
export function assessComplaintReportability(
  intake: ComplaintIntake,
): ComplaintReportabilityResult {
  const decision = assessReportability(mapComplaintToAdverseEvent(intake));

  const reportable = decision.fdaMdrRequired || decision.euMdvRequired || decision.fscaRequired;

  return {
    reportabilityStatus: reportable ? 'reportable' : 'not_reportable',
    fdaMdrRequired: decision.fdaMdrRequired,
    fdaMdrDeadlineDays: decision.fdaMdrDeadlineDays,
    euMdvRequired: decision.euMdvRequired,
    euMdvDeadlineDays: decision.euMdvDeadlineDays,
    fscaRequired: decision.fscaRequired,
    rationale: decision.rationale,
  };
}
