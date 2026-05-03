/**
 * Hallucination Scorer
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-004
 *
 * Detects obvious hallucination markers using simple heuristics:
 * - Made-up regulation numbers (e.g., CFR Part 9999, regulation 12345-FAKE)
 * - Years far in the future (beyond current year + 5)
 * - Placeholder text patterns
 *
 * This is a heuristic scorer — not an LLM judge.
 */

interface ScorerResult {
  pass: boolean;
  score: number; // 0.0 to 1.0
  reason: string;
}

// CFR Part numbers above 1000 are not real
const FAKE_CFR_PATTERN = /\bCFR\s+Part\s+([1-9]\d{3,})\b/i;

// Year patterns far in the future (current year is 2026)
const FUTURE_YEAR_PATTERN = /\b(20[3-9]\d|2[1-9]\d{2}|[3-9]\d{3})\b/g;

// Obvious placeholder patterns
const PLACEHOLDER_PATTERN = /\b(FAKE|PLACEHOLDER|TODO|LOREM|IPSUM|EXAMPLE_REG)\b/i;

// @MX:ANCHOR: [AUTO] promptfoo scorer entry point — called for each eval test case
// @MX:REASON: external integration boundary with promptfoo eval harness
export default async function score(
  output: string,
  _context: { vars: Record<string, string>; prompt: string },
): Promise<ScorerResult> {
  const issues: string[] = [];

  // Check for fake CFR part numbers
  const fakeCfr = FAKE_CFR_PATTERN.exec(output);
  if (fakeCfr) {
    issues.push(`Suspicious CFR Part number: ${fakeCfr[0]}`);
  }

  // Check for years far in the future
  const futureYears = output.match(FUTURE_YEAR_PATTERN) ?? [];
  if (futureYears.length > 0) {
    issues.push(`Suspicious future year(s): ${futureYears.join(', ')}`);
  }

  // Check for placeholder patterns
  if (PLACEHOLDER_PATTERN.test(output)) {
    issues.push('Placeholder text detected in output');
  }

  if (issues.length > 0) {
    return {
      pass: false,
      score: Math.max(0, 1 - issues.length * 0.5),
      reason: `Potential hallucination detected: ${issues.join('; ')}.`,
    };
  }

  return {
    pass: true,
    score: 1.0,
    reason: 'No obvious hallucination markers detected.',
  };
}
