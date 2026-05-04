// @MX:ANCHOR [AUTO] detectPii / redactText — HIPAA Safe Harbor regex layer.
// @MX:REASON fan_in >= 3: policy-by-class, ingest pipeline, and redaction-map all use this.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-4)

export interface PiiMatch {
  type: string;
  start: number;
  end: number;
  value: string;
  confidence: number;
}

interface PatternDef {
  type: string;
  pattern: RegExp;
  confidence: number;
}

// HIPAA Safe Harbor 18 identifier patterns — 12 minimum as per spec.
const PII_PATTERNS: PatternDef[] = [
  // 1. SSN: ###-##-####
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, confidence: 0.95 },

  // 2. Email address
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.9,
  },

  // 3. US Phone number (various formats)
  {
    type: 'phone',
    pattern: /\b(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
    confidence: 0.85,
  },

  // 4. Credit card number (16 digits with optional separators)
  {
    type: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    confidence: 0.8,
  },

  // 5. Date of Birth (MM/DD/YYYY or MM-DD-YYYY)
  {
    type: 'dob',
    pattern: /\b(0[1-9]|1[012])[\/\-](0[1-9]|[12][0-9]|3[01])[\/\-](19|20)\d\d\b/g,
    confidence: 0.75,
  },

  // 6. ZIP code (5-digit or ZIP+4)
  { type: 'zip', pattern: /\b\d{5}(-\d{4})?\b/g, confidence: 0.6 },

  // 7. Medical Record Number (MRN: followed by 6-10 digits)
  { type: 'mrn', pattern: /\bMRN[:\s]+\d{6,10}\b/gi, confidence: 0.9 },

  // 8. National Provider Identifier (NPI: followed by 10 digits)
  { type: 'npi', pattern: /\bNPI[:\s]+\d{10}\b/gi, confidence: 0.9 },

  // 9. DEA number (2 letters + 7 digits)
  { type: 'dea', pattern: /\b[A-Z]{2}\d{7}\b/g, confidence: 0.85 },

  // 10. URL
  { type: 'url', pattern: /https?:\/\/[^\s]+/g, confidence: 0.8 },

  // 11. IP address (IPv4)
  {
    type: 'ip_address',
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    confidence: 0.8,
  },

  // 12. US License plate (1-3 letters + 1-4 digits + optional letters)
  {
    type: 'license_plate',
    pattern: /\b[A-Z]{1,3}[\s-]?\d{1,4}[\s-]?[A-Z]{0,3}\b/g,
    confidence: 0.5,
  },
];

/**
 * Detects PII in text using regex patterns.
 * Returns an array of PiiMatch objects with type, position, value, and confidence.
 */
export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const def of PII_PATTERNS) {
    // Reset lastIndex before each use of global regex
    def.pattern.lastIndex = 0;

    let match = def.pattern.exec(text);
    while (match !== null) {
      matches.push({
        type: def.type,
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        confidence: def.confidence,
      });
      match = def.pattern.exec(text);
    }
  }

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Replaces detected PII in text with type-based placeholders.
 * Processes matches in reverse order to preserve string positions.
 */
export function redactText(text: string, matches: PiiMatch[]): string {
  if (matches.length === 0) return text;

  // Process in reverse order to preserve indices
  const sorted = [...matches].sort((a, b) => b.start - a.start);
  let result = text;

  for (const match of sorted) {
    const placeholder = `[REDACTED:${match.type.toUpperCase()}]`;
    result = result.substring(0, match.start) + placeholder + result.substring(match.end);
  }

  return result;
}
