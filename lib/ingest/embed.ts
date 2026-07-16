// @MX:ANCHOR [AUTO] Embedding with PII guard — defense-in-depth before embedding.
// @MX:REASON fan_in >= 3: chunkers output flows here, then to document_chunks insert and retriever.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-035)
// @MX:NOTE Phase A: batch embedding centralized in lib/ai/embedding-provider.
//          #318 moved this to on-prem gx10 Ollama (LAN) — no longer an external API,
//          which is why the URL entry was dropped from the PII guard (#517).
import { embedBatchTexts } from '../ai/embedding-provider';

const BATCH_SIZE = 100;

// PII guard patterns — defense-in-depth before embedding.
// @MX:NOTE #517/SPEC-REGULA-CORPUS-SEED-001: the URL pattern was dropped. It
// belonged to the external-API era (data-leak defense when embeddings left the
// network). #318 moved embedding to on-prem gx10 Ollama (LAN 192.168.100.1), so
// a URL is no longer an exfiltration risk — and URLs are pervasive in regulatory
// source docs, so the guard silently rejected ~74% of the corpus (verified: 87/136
// files on ra-project). Real PII (SSN/email/phone/card) stays blocked.
const PII_GUARD_PATTERNS: RegExp[] = [
  /\d{3}-\d{2}-\d{4}/, // SSN
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // email
  /\b(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, // phone
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // credit card
];

function detectPii(text: string): { found: boolean; pattern: string } {
  for (const pattern of PII_GUARD_PATTERNS) {
    if (pattern.test(text)) {
      const name = pattern.source.includes('@')
        ? 'email'
        : pattern.source.includes('\\d{3}-\\d{2}-\\d{4}')
          ? 'SSN'
          : pattern.source.includes('\\+1')
            ? 'phone'
            : pattern.source.includes('\\d{4}')
              ? 'credit_card'
              : 'pattern';
      return { found: true, pattern: name };
    }
  }
  return { found: false, pattern: '' };
}

/**
 * Embed an array of text chunks via gx10 on-prem Ollama qwen3-embedding (#318).
 * Applies PII guard before embedding — throws if SSN/email/phone/card detected.
 * Batches inputs in groups of 100. Delegates retry/backoff to embedBatchTexts.
 */
export async function embedChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // PII guard: scan all inputs before sending
  for (const text of texts) {
    const { found, pattern } = detectPii(text);
    if (found) {
      throw new Error(
        `PII guard triggered: ${pattern} pattern detected in embedding input. Redact text before embedding.`,
      );
    }
  }

  // Process in batches — embedBatchTexts handles retry/backoff per batch.
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatchTexts(batch);
    results.push(...embeddings);
  }

  return results;
}
