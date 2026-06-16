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
): Promise<RedactionResult> {
  const policy = PII_POLICY_BY_CLASS[docClass];
  let redacted = text;
  let redactionCount = 0;
  const layersRun: RedactionLayer[] = [];

  for (const layer of policy.layers) {
    if (layer === 'regex') {
      const result = redactRegexPii(redacted);
      redacted = result.text;
      redactionCount += result.redactionCount;
      layersRun.push('regex');
    }

    if (layer === 'workers_ai') {
      const spans = await detectPiiWorkersAi(redacted);
      redacted = applySpanRedaction(redacted, spans);
      redactionCount += spans.length;
      layersRun.push('workers_ai');
    }

    if (layer === 'presidio') {
      const spans = await detectPiiPresidio(redacted);
      redacted = applySpanRedaction(redacted, spans);
      redactionCount += spans.length;
      layersRun.push('presidio');
    }
  }

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
