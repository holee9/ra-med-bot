/**
 * Citation Coverage Scorer
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-004
 *
 * Validates that the model output contains bracket-style citations
 * such as [1], [2], [FDA-001], [MDR-2017/745], etc.
 *
 * This is a heuristic scorer — not an LLM judge.
 */

interface ScorerResult {
  pass: boolean;
  score: number; // 0.0 to 1.0
  reason: string;
}

// Match citations like [1], [23], [FDA-001], [MDR-2017], [SOURCE], etc.
const CITATION_PATTERN = /\[[A-Za-z0-9][A-Za-z0-9\-_/]*\]/g;

// @MX:ANCHOR: [AUTO] promptfoo scorer entry point — called for each eval test case
// @MX:REASON: external integration boundary with promptfoo eval harness
export default async function score(
  output: string,
  _context: { vars: Record<string, string>; prompt: string },
): Promise<ScorerResult> {
  const matches = output.match(CITATION_PATTERN) ?? [];
  const citationCount = matches.length;

  if (citationCount === 0) {
    return {
      pass: false,
      score: 0,
      reason:
        'No citations found. Output must include at least one bracket citation like [1] or [FDA-001].',
    };
  }

  // Score scales with citation count, capped at 1.0 after 3+ citations
  const score = Math.min(1.0, citationCount / 3);

  return {
    pass: true,
    score,
    reason: `Found ${citationCount} citation(s): ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? '...' : ''}.`,
  };
}
