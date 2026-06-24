// @MX:NOTE [AUTO] Pure trend signature computation (REQ-007).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-007)
//
// Separated from trend-detector.ts so the deterministic signature logic can be
// unit-tested without triggering lib/db/client env validation. The DB-backed
// detection (countComplaintsByTrendSignature, detectAndLinkTrend) remains in
// trend-detector.ts.

import type { ComplaintIntake } from './types';

/** Minimum repeat count to flag a trend. REQ-007: ≥3 occurrences = trend. */
export const TREND_THRESHOLD = 3;

/**
 * Compute the trend signature for a complaint. Deterministic so identical
 * (deviceName, deviceModel, patientOutcome) tuples cluster together.
 */
export function computeTrendSignature(intake: ComplaintIntake): string {
  const raw = `${intake.deviceName}|${intake.deviceModel ?? ''}|${intake.patientOutcome}`;
  // Simple FNV-1a hash → base36 string. Deterministic, no crypto needed.
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
