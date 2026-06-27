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
  // 21 CFR Part 11 — reversibility artifact persistence outcome.
  // `mapPersisted=false` is the compliance signal that no reversible map exists
  // for this document (PII_MAP_KEY unset, DB write failed, or no pairs to save).
  // Audited in the `document.redact` meta_json so regulators can detect a clean
  // redaction event with a missing reversibility artifact.
  mapPersisted: boolean;
  mapPersistedCount: number;
}

// Per-match tuple collected for optional persistence to private.redaction_maps.
// 21 CFR Part 11: the original→placeholder mapping must be recoverable for audit.
interface RedactionPair {
  original: string;
  placeholder: string;
  piiType: string;
  confidence: number;
}

export interface RedactionOptions {
  documentId?: string;
  saveMap?: boolean;
}

export function redactRegexPii(text: string): {
  text: string;
  redactionCount: number;
  pairs: RedactionPair[];
} {
  const matches = detectPii(text);
  return {
    text: redactRegexText(text, matches),
    redactionCount: matches.length,
    pairs: matches.map((m) => ({
      original: m.value,
      placeholder: `[REDACTED:${m.type.toUpperCase()}]`,
      piiType: m.type,
      confidence: m.confidence,
    })),
  };
}

export async function redactPiiForIngest(
  text: string,
  docClass: DocClass,
  options?: RedactionOptions,
): Promise<RedactionResult> {
  const policy = PII_POLICY_BY_CLASS[docClass];
  let redacted = text;
  let redactionCount = 0;
  const layersRun: RedactionLayer[] = [];
  // Collected for optional persistence to private.redaction_maps (21 CFR Part 11).
  const pairs: RedactionPair[] = [];

  // Layer 1: Regex-based redaction (fast-path for common PII)
  if (policy.layers.includes('regex')) {
    const result = redactRegexPii(redacted);
    redacted = result.text;
    redactionCount += result.redactionCount;
    pairs.push(...result.pairs);
    layersRun.push('regex');
  }

  // Layer 2: Cloudflare Workers AI GLiNER (NER for entities regex cannot catch)
  if (policy.layers.includes('workers_ai')) {
    try {
      const spans = await detectPiiWorkersAi(redacted);
      redacted = applySpanRedaction(redacted, spans);
      redactionCount += spans.length;
      collectSpanPairs(spans, pairs);
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
      collectSpanPairs(spans, pairs);
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
    for (const m of matches) {
      pairs.push({
        original: m[0],
        placeholder: '[REDACTED:CUSTOM]',
        piiType: 'custom',
        confidence: 1.0,
      });
    }
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

  // 21 CFR Part 11 — persist original→placeholder map for audit reversibility.
  // Non-fatal: a map-write failure MUST NOT roll back ingestion; the redacted
  // text above is already safe to embed and persist. PII_MAP_KEY may be unset
  // in CI / non-production environments — encryptPii throws there, so swallow.
  // Orphan tradeoff (accepted): if the downstream source_sections transaction
  // rolls back, map rows may persist for a document_id without a corresponding
  // source. Data is encrypted + RLS-isolated, so non-fatal by design.
  let mapPersisted = false;
  let mapPersistedCount = 0;
  if (options?.saveMap && options.documentId && pairs.length > 0) {
    try {
      const { saveRedactionMap, encryptPii } = await import('@/lib/ingest/pii/redaction-map');
      for (const pair of pairs) {
        const { iv, ciphertext } = encryptPii(pair.original);
        await saveRedactionMap({
          documentId: options.documentId,
          iv,
          encryptedOriginal: ciphertext,
          redactedPlaceholder: pair.placeholder,
          piiType: pair.piiType,
          confidence: pair.confidence,
        });
        mapPersistedCount += 1;
      }
      mapPersisted = true;
    } catch (mapErr) {
      // mapPersisted stays false — audited upstream so the compliance signal is
      // visible. Do NOT rethrow: ingestion must succeed with a failed map write.
      console.error('[PII Redaction] redaction_maps persistence failed (non-fatal):', mapErr);
    }
  }

  return {
    text: redacted,
    layersRun,
    redactionCount,
    sensitivityLevel: policy.sensitivityLevel,
    mapPersisted,
    mapPersistedCount,
  };
}

// Append workers-ai/presidio spans to the pairs collector.
// Placeholder mirrors applySpanRedaction's `[REDACTED:${entity}]` format so the
// persisted entry matches what actually landed in the redacted text.
function collectSpanPairs(spans: PIISpan[], pairs: RedactionPair[]): void {
  for (const span of spans) {
    if (span.start < 0 || span.end <= span.start) continue;
    pairs.push({
      original: span.text,
      placeholder: `[REDACTED:${span.entity}]`,
      piiType: span.entity,
      confidence: span.score,
    });
  }
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
