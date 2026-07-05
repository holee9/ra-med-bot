// SPEC-V3-IMPACT-001 M3: Layer 1 retestMatrix lookup engine.
// AC-IMP-05: retestMatrix 결정론 룰 조회.
// AC-IMP-09: 신호등 계산.

import { RETEST_MATRIX } from './retest-matrix-data';
import type { RetestMatrixCell } from './retest-matrix-data';

/**
 * Lookup retestMatrix cell by changeType and market.
 * @throws Error if cell is missing (runtime validation)
 */
export function lookupRetestMatrix(changeType: string, market: string): RetestMatrixCell {
  const cellKey = `${changeType}-${market}`;
  const cell = RETEST_MATRIX.cells[cellKey];

  if (!cell) {
    throw new Error(
      `retestMatrix 셀 누락: ${cellKey} (changeType=${changeType}, market=${market})`,
    );
  }

  return cell;
}

/**
 * Calculate traffic light signal from retestMatrix results and LLM confidence.
 * @param matrixResults - Array of cell results from Layer 1
 * @param llmConfidence - LLM confidence score (0-100) from Layer 2
 * @returns 'green' | 'yellow' | 'red'
 */
export function calculateSignal(
  matrixResults: RetestMatrixCell[],
  llmConfidence: number,
): 'green' | 'yellow' | 'red' {
  // Rule 1: If any market is 'required' → Red
  const hasRequired = matrixResults.some((r) => r.level === 'required');
  if (hasRequired) {
    return 'red';
  }

  // Rule 2: If LLM confidence < 70 → Red
  if (llmConfidence < 70) {
    return 'red';
  }

  // Rule 3: If all markets are 'not-required' → Green
  const allNotRequired = matrixResults.every((r) => r.level === 'not-required');
  if (allNotRequired) {
    return 'green';
  }

  // Rule 4: If any market is 'conditional' OR confidence < 90 → Yellow
  const hasConditional = matrixResults.some((r) => r.level === 'conditional');
  if (hasConditional || llmConfidence < 90) {
    return 'yellow';
  }

  // Fallback (should not reach with valid inputs)
  return 'green';
}
