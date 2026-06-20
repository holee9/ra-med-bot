// @MX:NOTE [AUTO] Residual risk evaluation per ISO 14971 §7.6 / §8.
// @MX:SPEC SPEC-REGULA-RISK-001 (T1.5, REQ-RISK-016~020)

import { type RiskLevel, evaluateRiskLevel, validateScale } from './risk-evaluation';

export interface ResidualRiskResult {
  level: RiskLevel;
  requiresFurtherAction: boolean;
  isValid: boolean;
}

/**
 * Evaluate residual risk after control measures have been applied.
 *
 * @param severity         Post-control severity (1–5)
 * @param probability      Post-control probability (1–5)
 * @param alarpJustification Required when residual level is 'alarp'
 */
export function evaluateResidualRisk(
  severity: number,
  probability: number,
  alarpJustification?: string,
): ResidualRiskResult {
  if (!validateScale(severity)) {
    throw new RangeError(`Invalid residual severity: ${severity}. Must be integer 1–5.`);
  }
  if (!validateScale(probability)) {
    throw new RangeError(`Invalid residual probability: ${probability}. Must be integer 1–5.`);
  }

  const level = evaluateRiskLevel(severity, probability);

  // 'unacc' residual risk always requires further action (cannot accept).
  if (level === 'unacc') {
    return { level, requiresFurtherAction: true, isValid: true };
  }

  // 'alarp' residual risk requires explicit ALARP justification before acceptance.
  if (level === 'alarp') {
    const hasJustification = typeof alarpJustification === 'string' && alarpJustification.trim().length > 0;
    return {
      level,
      requiresFurtherAction: false,
      isValid: hasJustification,
    };
  }

  // 'acc' — acceptable residual risk
  return { level, requiresFurtherAction: false, isValid: true };
}
