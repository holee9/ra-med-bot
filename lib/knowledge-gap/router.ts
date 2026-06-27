// @MX:ANCHOR [AUTO] Deterministic 4-way classifier — routes a gap to its owning project.
// @MX:REASON fan_in will reach 3+ (detector capture, replay re-classify, manual API route).
//          Pure function — unit-testable without DB or network. DETERMINISTIC ONLY.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC2/AC3 (Issue #157)
//
// Design principle (docs/운영_SOP.md §3.1-3.2):
//   Regula is an internal 6-8 person tool. NO LLM classifier — latency, cost,
//   and unrequested nondeterminism outweigh marginal accuracy gains. Rules are
//   keyword + gap_classification_enum based, fully auditable.
//
// Routing map (docs/운영_SOP.md §3.1-3.2):
//   ra-project       — regulation knowledge gap (FDA/EU MDR/MFDS/NMPA/PMDA coverage hole)
//   md-process       — internal policy/process gap (SOP, work instruction, DHF process)
//   gitea-wiki       — wiki content gap (ra-llm-wiki documentation)
//   hybrid-ra-saas   — backend/API bug (hybrid runtime, BFF integration)
//   queue            — unclassified or target unconfigured (degrade safely)

import type { OwningTarget } from './owning-repos';

/** Context the classifier consumes — never the raw original question (PII hazard). */
export interface ClassifyContext {
  /** PII-free question (already redacted by detector.redactQuestion). */
  redactedQuestion: string;
  /** Machine gap reason from detector (low_confidence|low_citation|no_results|policy_blocked). */
  reason: string;
  /**
   * Optional pre-classification from RA-lead (schema.gapClassificationEnum).
   * 'bug' → hybrid-ra-saas; 'external_regulation_needed' → ra-project;
   * 'md_process_gap' → md-process; 'ra_project_gap' → ra-project.
   * When set, this takes precedence over keyword heuristics.
   */
  classification?:
    | 'ra_project_gap'
    | 'md_process_gap'
    | 'external_regulation_needed'
    | 'bug'
    | null;
}

/**
 * Deterministic classification of a gap to its owning target.
 *
 * Precedence (deterministic, auditable):
 *   1. RA-lead classification enum (explicit human decision) — highest signal
 *   2. Keyword/regex on redactedQuestion — deterministic fallback
 *   3. Default 'queue' — safe degradation; no silent misrouting
 *
 * The keyword lists are intentionally short and high-precision. False positives
 * are WORSE than false negatives here: a misrouted issue adds latency to the
 * wrong team. Queue fallback lets a human triage during business hours.
 */
export function classifyOwningTarget(ctx: ClassifyContext): OwningTarget {
  // §1. Explicit RA-lead classification wins.
  if (ctx.classification) {
    if (ctx.classification === 'bug') return 'hybrid-ra-saas';
    if (ctx.classification === 'md_process_gap') return 'md-process';
    if (ctx.classification === 'external_regulation_needed') return 'ra-project';
    if (ctx.classification === 'ra_project_gap') return 'ra-project';
  }

  const q = ctx.redactedQuestion.toLowerCase();

  // §2. Hybrid/API bug signals (most specific — hybrid runtime / BFF / API).
  if (
    /\b(api|backend|hybrid|bff|runtime|endpoint|http\s?5\d\d|gateway|hybrid-ra)\b/.test(q) ||
    /\b(time ?out|503|502|connection)\b/.test(q)
  ) {
    return 'hybrid-ra-saas';
  }

  // §3. Wiki/content gap signals (ra-llm-wiki documentation).
  if (/\b(wiki|문서|도큐|document|가이드|guide|ra-llm-wiki)\b/.test(q)) {
    return 'gitea-wiki';
  }

  // §4. Internal process/policy signals (SOP, work instruction, DHF).
  if (/\b(sop|process|절차|프로세스|policy|dhf|work\s?instruction|내부\s?규정)\b/.test(q)) {
    return 'md-process';
  }

  // §5. Regulation knowledge signals (default for ra-project — FDA/MDR/etc.).
  if (/\b(fda|510\(k\)|mdr|mfds|nmpa|pmda|ivd|규제|regulation|法规|fda 인증|인허가)\b/.test(q)) {
    return 'ra-project';
  }

  // §6. Safe default — human triage.
  return 'queue';
}
