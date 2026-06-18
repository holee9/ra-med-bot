// @MX:ANCHOR [AUTO] OpenAI embedding with PII guard — defense-in-depth before embedding.
// @MX:REASON fan_in >= 3: chunkers output flows here, then to document_chunks insert and retriever.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-035)
import OpenAI from 'openai';

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const MODEL = 'text-embedding-3-small';

// PII guard patterns — defense-in-depth before sending to external API
// Enhanced 3-layer guard matching SPEC-REGULA-DOCINGEST-001 REQ-DOC-035
const PII_GUARD_PATTERNS: RegExp[] = [
  /\d{3}-\d{2}-\d{4}/, // SSN
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // email
  /\b(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, // phone
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // credit card
  /https?:\/\/[^\s]+/g, // URL
];

function detectPii(text: string): { found: boolean; pattern: string } {
  for (const pattern of PII_GUARD_PATTERNS) {
    if (pattern.test(text)) {
      const name = pattern.source.includes('@') ? 'email' :
                   pattern.source.includes('\\d{3}-\\d{2}-\\d{4}') ? 'SSN' :
                   pattern.source.includes('https?') ? 'URL' :
                   pattern.source.includes('\\+1') ? 'phone' :
                   pattern.source.includes('\\d{4}') ? 'credit_card' : 'pattern';
      return { found: true, pattern: name };
    }
  }
  return { found: false, pattern: '' };
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? 'no-key-in-test',
    });
  }
  return openaiClient;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: MODEL,
        input: texts,
      });
      return response.data.map((d) => d.embedding);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      }
    }
  }

  throw new Error(`Embedding failed after ${MAX_RETRIES} attempts: ${lastError}`);
}

/**
 * Embed an array of text chunks using OpenAI text-embedding-3-small.
 * Applies PII guard before sending — throws if SSN or email pattern detected.
 * Batches inputs in groups of 100.
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

  // Process in batches
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch);
    results.push(...embeddings);
  }

  return results;
}
