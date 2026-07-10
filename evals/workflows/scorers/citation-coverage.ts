/**
 * Citation Coverage Scorer — Workflows (SPEC-REGULA-WORKFLOWS-LLM-002 M5, AC-05)
 *
 * Validates that prose output has citation coverage >= 80%.
 * Citation format: <sup class="cite" data-source="N">N</sup> (per executor CITATION_DIRECTIVE).
 *
 * Coverage = (sentences with >=1 citation marker) / (total prose sentences).
 * Mirrors lib/workflows/_shared/citation-enforcer.ts computeCoverage logic.
 *
 * This is a heuristic scorer — not an LLM judge.
 */

interface ScorerResult {
  pass: boolean;
  score: number; // 0.0 to 1.0
  reason: string;
}

// Match <sup class="cite" data-source="N">N</sup> or simplified <sup ...>cite...</sup>
const CITATION_PATTERN = /<sup[^>]*class="[^"]*cite[^"]*"[^>]*>\s*\d+\s*<\/sup>/gi;

/**
 * Split prose into sentences. Handles common abbreviations minimally.
 * Mirrors citation-enforcer.ts countSentences approach.
 */
function countSentences(text: string): number {
  // Remove HTML tags for sentence counting
  const plain = text.replace(/<[^>]+>/g, ' ');
  const trimmed = plain.trim();
  if (trimmed.length === 0) return 0;
  // Split on sentence-ending punctuation followed by whitespace + capital
  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.length;
}

// @MX:ANCHOR: [AUTO] promptfoo workflows scorer entry point — called for each eval test case
// @MX:REASON: external integration boundary with promptfoo eval harness (AC-05)
export default async function score(
  output: string,
  _context: { vars: Record<string, string>; prompt: string },
): Promise<ScorerResult> {
  const totalSentences = countSentences(output);

  if (totalSentences === 0) {
    return {
      pass: false,
      score: 0,
      reason: 'No prose sentences detected. Output may be empty or non-prose.',
    };
  }

  const matches = output.match(CITATION_PATTERN) ?? [];
  const citationCount = matches.length;

  if (citationCount === 0) {
    return {
      pass: false,
      score: 0,
      reason:
        'No <sup class="cite"> citation markers found. Every factual claim must have a citation.',
    };
  }

  // Coverage = citation density: min(1.0, citationCount / totalSentences).
  // This approximates "fraction of sentences with citations" — if citations
  // >= sentence count, coverage is 100%.
  const coverage = Math.min(1.0, citationCount / totalSentences);
  const threshold = 0.8;

  return {
    pass: coverage >= threshold,
    score: coverage,
    reason: `${citationCount} citation(s) across ${totalSentences} sentence(s) → coverage ${(coverage * 100).toFixed(1)}% (threshold ${threshold * 100}%).`,
  };
}
