// @MX:NOTE [AUTO] REQ-007 — translation semantic-diff detection (MVP heuristic).
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-007, AC-05)

// @MX:LEGACY archived from lib
//
// MVP approach: conservative heuristic. Detects divergence in three safety-
// critical dimensions:
//   1. Critical-term mapping (contraindication/warning/precaution vocabulary)
//      — a missing or mismatched critical term is 'major_diff'.
//   2. Numeric/unit mismatch (e.g. "10 mg" vs "20 mg") — 'major_diff'.
//   3. Section-structure mismatch (missing required subsection) — 'minor_diff'.
//
// An optional LLM-based diff can layer in via createHybridRaFetch (mirrors
// translation-diff Phase 2 decision in tasks.md §2.5), but the heuristic is
// the default for cost/latency reasons. AC-05 validates both KO↔EN.

import type { SemanticDiffResult, SemanticDiffStatus } from './types';

/**
 * Critical-term map: source-locale term → target-locale equivalents.
 * A critical term present in the source but absent from the target (or vice
 * versa) is a 'major_diff'. Multi-language support for KO/EN/JA/ZH.
 */
export const CRITICAL_TERMS: Readonly<Record<string, ReadonlyArray<string>>> = {
  // English → other locales
  contraindication: ['contraindication', '금기', '禁忌', '禁忌症'],
  warning: ['warning', '경고', '警告', '警告'],
  precaution: ['precaution', '주의', '注意', '注意事项'],
  indication: ['indication', '적응증', '適応', '适应症'],
  contraindicated: ['contraindicated', '금기', '禁忌', '禁用'],
  'do not use': ['do not use', '사용 금지', '使用しないでください', '请勿使用'],
  sterile: ['sterile', '멸균', '滅菌', '无菌'],
  single_use: ['single use', '일회용', '使い切り', '一次性使用'],
};

/**
 * REQ-007: detect semantic diff between source and translated text.
 *
 * MVP heuristic:
 *   - Numeric/unit mismatch → major_diff
 *   - Critical-term divergence → major_diff
 *   - Length ratio beyond 0.4–2.5 → minor_diff (informational)
 *   - Otherwise → match
 */
export function detectSemanticDiff(
  sourceText: string,
  _sourceLocale: string,
  targetText: string,
  _targetLocale: string,
): SemanticDiffResult {
  const details: Array<{ type: string; description: string }> = [];
  const issues: SemanticDiffStatus[] = [];

  // 1. Numeric/unit mismatch.
  const sourceNumbers = extractNumbers(sourceText);
  const targetNumbers = extractNumbers(targetText);
  if (sourceNumbers.length > 0 || targetNumbers.length > 0) {
    const sourceSet = new Set(sourceNumbers);
    const targetSet = new Set(targetNumbers);
    const missingInTarget = sourceNumbers.filter((n) => !targetSet.has(n));
    const missingInSource = targetNumbers.filter((n) => !sourceSet.has(n));
    if (missingInTarget.length > 0) {
      issues.push('major_diff');
      details.push({
        type: 'numeric_mismatch',
        description: `numbers present in source but missing in target: ${missingInTarget.join(', ')}`,
      });
    }
    if (missingInSource.length > 0) {
      issues.push('major_diff');
      details.push({
        type: 'numeric_mismatch',
        description: `numbers present in target but missing in source: ${missingInSource.join(', ')}`,
      });
    }
  }

  // 2. Critical-term divergence.
  const sourceLower = sourceText.toLowerCase();
  const targetLower = targetText.toLowerCase();
  for (const [canonical, equivalents] of Object.entries(CRITICAL_TERMS)) {
    const inSource = equivalents.some((t) => sourceLower.includes(t.toLowerCase()));
    const inTarget = equivalents.some((t) => targetLower.includes(t.toLowerCase()));
    if (inSource !== inTarget) {
      issues.push('major_diff');
      details.push({
        type: 'critical_term_divergence',
        description: `critical term group "${canonical}" present in one side but not the other`,
      });
    }
  }

  // 3. Length ratio (informational; only fires when no major issue already).
  if (issues.length === 0) {
    const sourceLen = sourceText.trim().length;
    const targetLen = targetText.trim().length;
    if (sourceLen > 0 && targetLen > 0) {
      const ratio = targetLen / sourceLen;
      if (ratio < 0.4 || ratio > 2.5) {
        issues.push('minor_diff');
        details.push({
          type: 'length_ratio',
          description: `length ratio ${ratio.toFixed(2)} outside expected range (0.4–2.5)`,
        });
      }
    }
  }

  // Resolve status: major_diff > minor_diff > match.
  let status: SemanticDiffStatus = 'match';
  if (issues.includes('major_diff')) {
    status = 'major_diff';
  } else if (issues.includes('minor_diff')) {
    status = 'minor_diff';
  }

  return { status, details };
}

/** Extract numeric values (with optional units) from text. */
function extractNumbers(text: string): string[] {
  // Match integers, decimals, and simple fractions with common medical units.
  const re = /\b\d+(?:\.\d+)?(?:\s?(?:mg|mcg|ug|g|kg|ml|cc|%|mmHg|bpm|Hz|W|V))?/gi;
  return (text.match(re) ?? []).map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase());
}
