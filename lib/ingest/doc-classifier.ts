// @MX:NOTE [AUTO] Heuristic document classifier — filename + first-page keyword matching.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-005)
// Confidence values are intentionally conservative — human review resolves low-confidence results.
import { DocClass } from './doc-class';

export interface ClassifyInput {
  filename: string;
  firstPageText?: string;
}

export interface ClassifyResult {
  suggestedClass: DocClass;
  confidence: number;
}

// Filename pattern rules: [regex, docClass, confidence]
const FILENAME_RULES: [RegExp, DocClass, number][] = [
  [/510k|K\d{5,6}|clearance/i, DocClass.submission_success, 0.8],
  [/SOP|procedure/i, DocClass.internal_sop, 0.8],
  [/certificate|cert|ISO|CE[-_]mark/i, DocClass.issued_certificate, 0.75],
  [/audit.?response|483|CAPA/i, DocClass.audit_response, 0.75],
  [/CER|clinical/i, DocClass.clinical_report, 0.7],
  [/PSUR|PMS|surveillance/i, DocClass.surveillance_report, 0.7],
  [/checklist|template/i, DocClass.checklist_template, 0.7],
];

// First-page text keyword signals: [keywords[], docClass, confidenceBoost]
const TEXT_SIGNALS: [string[], DocClass, number][] = [
  [
    ['510(k)', 'premarket notification', 'substantial equivalence'],
    DocClass.submission_success,
    0.6,
  ],
  [['clinical evaluation', 'clinical investigation', 'MEDDEV'], DocClass.clinical_report, 0.55],
  [['standard operating procedure', 'work instruction'], DocClass.internal_sop, 0.55],
  [['ISO 13485', 'CE mark', 'certificate of conformity'], DocClass.issued_certificate, 0.5],
  [['post-market surveillance', 'PSUR', 'PMCF'], DocClass.surveillance_report, 0.55],
  [['observation', 'corrective action', 'CAPA', '483'], DocClass.audit_response, 0.6],
];

/**
 * Classify a document based on its filename and optional first-page text.
 * Returns a suggested DocClass and a confidence score in [0, 1].
 */
export function classifyDocument(input: ClassifyInput): ClassifyResult {
  const { filename, firstPageText } = input;

  // Check filename rules first
  for (const [pattern, docClass, confidence] of FILENAME_RULES) {
    if (pattern.test(filename)) {
      return { suggestedClass: docClass, confidence };
    }
  }

  // Fall back to first-page text signals if filename gives no match
  if (firstPageText) {
    const lowerText = firstPageText.toLowerCase();
    let bestClass: DocClass = DocClass.internal_sop;
    let bestScore = 0;

    for (const [keywords, docClass, boost] of TEXT_SIGNALS) {
      const matchCount = keywords.filter((kw) => lowerText.includes(kw.toLowerCase())).length;
      if (matchCount > 0) {
        const score = boost * (matchCount / keywords.length);
        if (score > bestScore) {
          bestScore = score;
          bestClass = docClass;
        }
      }
    }

    if (bestScore > 0) {
      return { suggestedClass: bestClass, confidence: Math.min(bestScore, 1) };
    }
  }

  // Default fallback
  return { suggestedClass: DocClass.internal_sop, confidence: 0.3 };
}
