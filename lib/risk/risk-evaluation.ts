// @MX:ANCHOR [AUTO] evaluateRiskLevel — ISO 14971 Annex E risk matrix classification.
// @MX:REASON Called by residual-risk.ts, BFF evaluate route, and RiskMatrix UI. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-RISK-001 (T1.1~T1.4, REQ-RISK-011~015)

export type RiskLevel = 'acc' | 'alarp' | 'unacc';
export type RiskMatrix = RiskLevel[][];

/**
 * Default 5×5 ISO 14971 Annex E risk matrix.
 * Index [severity-1][probability-1] → risk level.
 * Severity 1 (negligible) → row 0; Severity 5 (catastrophic) → row 4.
 * Probability 1 (incredible) → col 0; Probability 5 (frequent) → col 4.
 */
export const DEFAULT_RISK_MATRIX: RiskMatrix = [
  // S1: negligible
  ['acc', 'acc', 'acc', 'alarp', 'alarp'],
  // S2: marginal
  ['acc', 'acc', 'alarp', 'alarp', 'unacc'],
  // S3: serious
  ['acc', 'alarp', 'alarp', 'unacc', 'unacc'],
  // S4: critical
  ['acc', 'alarp', 'unacc', 'unacc', 'unacc'],
  // S5: catastrophic
  ['alarp', 'unacc', 'unacc', 'unacc', 'unacc'],
];

/**
 * Classify risk level from severity × probability using the given matrix.
 * Severity and probability must be integers 1–5.
 */
export function evaluateRiskLevel(
  severity: number,
  probability: number,
  matrix: RiskMatrix = DEFAULT_RISK_MATRIX,
): RiskLevel {
  // Non-null assertions safe here: callers must pass severity/probability in [1,5].
  // validateScale() guards upstream; direct access without check is intentional for hot-path.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return matrix[severity - 1]![probability - 1]!;
}

/**
 * Validate that a scale value is a valid integer in [1, 5].
 */
export function validateScale(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Returns true when the risk level requires control measures.
 * Per ISO 14971: acc is acceptable without controls; alarp and unacc require controls.
 */
export function requiresControl(level: RiskLevel): boolean {
  return level === 'alarp' || level === 'unacc';
}
