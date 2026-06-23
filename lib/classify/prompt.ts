// @MX:NOTE [AUTO] Prompt builder + response parser for LLM-assisted classification.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-005~013, REQ-CLASSIFY-017)
//
// MVP uses a uniform LLM-assisted path for all 5 jurisdictions with per-jurisdiction
// RAG rule-hints passed in the prompt. Deterministic engines + FDA Product Code DB
// are deferred to follow-up issue #236.

import type { Jurisdiction, JurisdictionResult, WizardAnswers } from './types';

/**
 * Build the LLM prompt for one jurisdiction. `ruleHints` are retrieved regulatory
 * snippets (RAG) that ground the model in the correct rule set.
 */
export function buildClassificationPrompt(
  jurisdiction: Jurisdiction,
  answers: WizardAnswers,
  ruleHints: string,
): string {
  return `You are a medical device regulatory affairs expert classifying a device under ${jurisdiction}.

Device Description: ${answers.deviceDescription}
Device Type: ${answers.deviceType}
Body Contact: ${answers.contactType}
Contains Software: ${answers.hasSoftware ? 'yes' : 'no'}
Contains AI/ML: ${answers.hasAiMl ? 'yes' : 'no'}
Sterile: ${answers.isSterile ? 'yes' : 'no'}

Reference rules (use these as the primary basis):
${ruleHints || '(no rule hints retrieved — reason from general knowledge of the regulation)'}

Task: Classify this device under ${jurisdiction}. Base the class on the reference rules
and cite the specific rule numbers / regulation sections you applied.

Return a JSON object with EXACTLY this shape:
{
  "class": "<headline class or grade for ${jurisdiction}>",
  "path": "<regulatory pathway, e.g. 510(k) / notified_body / 등가심사>",
  "ruleNumbers": ["<rule or regulation identifiers applied>"],
  "citations": [{"source": "<document>", "id": "<section/rule>"}],
  "rationale": "<2-3 sentences tying device characteristics to the class>",
  "nextSteps": ["<suggested follow-up workflow entry points>"]
}

Return ONLY the JSON object. No prose, no markdown fences.`;
}

/**
 * Parse the LLM JSON response into a JurisdictionResult. Throws on malformed JSON
 * or missing required fields so the caller can audit `device_classified` failure.
 */
export function parseJurisdictionResult(raw: string): JurisdictionResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new SyntaxError(
      `Invalid JSON from ${jurisdictionFromPrompt(raw)} classification response: ${raw.slice(0, 120)}`,
    );
  }

  const klass = typeof parsed.class === 'string' ? parsed.class : '';
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';
  if (!klass || !rationale) {
    throw new TypeError('Classification response missing required "class" or "rationale"');
  }

  return {
    class: klass,
    path: typeof parsed.path === 'string' ? parsed.path : undefined,
    ruleNumbers: Array.isArray(parsed.ruleNumbers)
      ? (parsed.ruleNumbers as unknown[]).filter((r): r is string => typeof r === 'string')
      : undefined,
    citations: Array.isArray(parsed.citations)
      ? (parsed.citations as unknown[])
          .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
          .map((c) => ({
            source: typeof c.source === 'string' ? c.source : '',
            id: typeof c.id === 'string' ? c.id : '',
          }))
          .filter((c) => c.source || c.id)
      : [],
    rationale,
    nextSteps: Array.isArray(parsed.nextSteps)
      ? (parsed.nextSteps as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
  };
}

/** Best-effort extraction of jurisdiction name from a malformed blob (for errors only). */
function jurisdictionFromPrompt(raw: string): string {
  const match = raw.match(/\b(FDA|EU_MDR|MFDS|NMPA|PMDA)\b/);
  return match ? (match[1] as string) : 'unknown';
}
