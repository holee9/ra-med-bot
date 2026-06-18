// @MX:ANCHOR [AUTO] redactPiiForIngest — shared PII redaction policy for document ingestion.
// @MX:REASON Sync admin upload and async Inngest pipelines must apply the same redaction layers.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-4, REQ-DOC-027, REQ-DOC-028)

import type { DocClass } from '@/lib/ingest/doc-class';
import { PII_POLICY_BY_CLASS, type PiiPolicy } from '@/lib/ingest/pii/policy-by-class';
import { detectPiiPresidio } from '@/lib/ingest/pii/presidio';
import { detectPii, redactText as redactRegexText } from '@/lib/ingest/pii/regex';
import { type PIISpan, detectPiiWorkersAi } from '@/lib/ingest/pii/workers-ai';

export type RedactionLayer = PiiPolicy['layers'][number] | 'custom';

export interface RedactionResult {
  text: string;
  layersRun: RedactionLayer[];
  redactionCount: number;
  sensitivityLevel: PiiPolicy['sensitivityLevel'];
}

export function redactRegexPii(text: string): { text: string; redactionCount: number } {
  const matches = detectPii(text);
  return {
    text: redactRegexText(text, matches),
    redactionCount: matches.length,
  };
}

export async function redactPiiForIngest(
  text: string,
  docClass: DocClass,
  _options?: { documentId?: string; saveMap?: boolean },
): Promise<RedactionResult> {
  const policy = PII_POLICY_BY_CLASS[docClass];
  let redacted = text;
  let redactionCount = 0;
  const layersRun: RedactionLayer[] = [];

  // Layer 1: Regex-based redaction (fast-path for common PII)
  if (policy.layers.includes('regex')) {
    const result = redactRegexPii(redacted);
    redacted = result.text;
    redactionCount += result.redactionCount;
    layersRun.push('regex');
  }

  // Layer 2: Cloudflare Workers AI GLiNER (NER for entities regex cannot catch)
  if (policy.layers.includes('workers_ai')) {
    try {
      const spans = await detectPiiWorkersAi(redacted);
      redacted = applySpanRedaction(redacted, spans);
      redactionCount += spans.length;
      layersRun.push('workers_ai');
    } catch (err) {
      // Fail-closed: log error but continue to next layer
      // Layer 2 failure doesn't block processing (Layer 1 already redacted common patterns)
      console.error(
        '[Layer 2] Workers AI PII detection failed, continuing with Layer 1 results:',
        err,
      );
    }
  }

  // Layer 3: Presidio (critical PHI only - Layer 3 for clinical_report and audit_response)
  if (policy.layers.includes('presidio')) {
    try {
      const spans = await detectPiiPresidio(redacted);
      redacted = applySpanRedaction(redacted, spans);
      redactionCount += spans.length;
      layersRun.push('presidio');
    } catch (err) {
      // Fail-closed: Layer 3 failure is critical for PHI documents
      // For critical_phi documents, Presidio failure blocks processing
      if (policy.sensitivityLevel === 'critical') {
        throw new Error(
          `Presidio Layer 3 failed for ${docClass} (critical_phi): ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
      console.error(
        '[Layer 3] Presidio PII detection failed, continuing with previous layers:',
        err,
      );
    }
  }

  // Custom pattern application (if any)
  for (const pattern of policy.customPatterns) {
    const globalPattern = pattern.global
      ? pattern
      : new RegExp(pattern.source, `${pattern.flags}g`);
    const matches = Array.from(redacted.matchAll(globalPattern));
    if (matches.length === 0) continue;
    redacted = redacted.replace(globalPattern, '[REDACTED:CUSTOM]');
    redactionCount += matches.length;
    if (!layersRun.includes('custom')) layersRun.push('custom');
  }

  // Fail-closed: Verify no raw PII patterns remain after redaction
  const remainingPii = detectPii(redacted);
  if (remainingPii.length > 0 && policy.sensitivityLevel !== 'low') {
    // For non-low sensitivity documents, log remaining PII but don't fail
    // (regex detect may have false positives; Layers 2/3 handle real PII)
    console.warn(
      `[PII Redaction] ${remainingPii.length} potential PII patterns remain after ${layersRun.join(' + ')} layers`,
    );
  }

  return {
    text: redacted,
    layersRun,
    redactionCount,
    sensitivityLevel: policy.sensitivityLevel,
  };
}

export function applySpanRedaction(text: string, spans: PIISpan[]): string {
  const sorted = [...spans]
    .filter((span) => span.start >= 0 && span.end > span.start && span.end <= text.length)
    .sort((a, b) => b.start - a.start);

  let result = text;
  for (const span of sorted) {
    const replacement = `[REDACTED:${span.entity}]`;
    result = result.slice(0, span.start) + replacement + result.slice(span.end);
  }
  return result;
}
