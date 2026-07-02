// @MX:NOTE [AUTO] REQ-003 change-type classification.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-003, AC-02)
//
// The form on the frontend already submits a changeType, but we also provide
// a re-classification helper so a free-form description can be mapped to one
// of the 6 types when the caller wants to verify or auto-suggest. This mirrors
// the CLASSIFY prompt+parse pattern (lib/classify/prompt.ts) but is intentionally
// lightweight: change-type classification is a simpler 6-way bucketing than
// full device classification, so a deterministic keyword heuristic is the
// MVP path. An LLM-backed path can be layered in later without changing the
// engine contract (ChangeClassifier is injectable).

import type { ChangeType } from './types';

/** Keyword signatures per REQ-003 change type. */
const KEYWORD_SIGNATURES: ReadonlyArray<{ type: ChangeType; keywords: ReadonlyArray<string> }> = [
  {
    type: 'design',
    keywords: [
      'design',
      'specification',
      'performance',
      'dimension',
      'form factor',
      '설계',
      '사양',
    ],
  },
  {
    type: 'material',
    keywords: ['material', 'substrate', 'polymer', 'alloy', 'coating', '소재', '재질'],
  },
  {
    type: 'manufacturing_process',
    keywords: [
      'manufacturing',
      'process',
      'sterilization',
      'assembly',
      'molding',
      '제조',
      '공정',
      '멸균',
    ],
  },
  {
    type: 'software',
    keywords: ['software', 'firmware', 'algorithm', 'version', 'update', '소프트웨어', '펌웨어'],
  },
  {
    type: 'labeling',
    keywords: ['label', 'labeling', 'ifu', 'instructions for use', 'packaging', '라벨', '표시사항'],
  },
  {
    type: 'intended_use',
    keywords: [
      'intended use',
      'indication',
      'patient population',
      'clinical application',
      '용도',
      '적응증',
    ],
  },
];

/**
 * Injectable classifier signature. The default is the keyword heuristic below;
 * tests / future LLM-backed callers pass their own.
 */
export type ChangeClassifier = (description: string) => ChangeType;

/**
 * Classify a free-form change description into one of the 6 REQ-003 types.
 * Falls back to 'design' (the most common change type) when no keyword matches
 * — the operator reviews and corrects via the form.
 */
export const classifyChangeType: ChangeClassifier = (description: string): ChangeType => {
  const lower = description.toLowerCase();
  let best: { type: ChangeType; hits: number } | null = null;
  for (const sig of KEYWORD_SIGNATURES) {
    let hits = 0;
    for (const kw of sig.keywords) {
      if (lower.includes(kw.toLowerCase())) hits++;
    }
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { type: sig.type, hits };
    }
  }
  return best?.type ?? 'design';
};

/** REQ-003 guard: validate that a changeType is one of the 6 allowed values. */
export function isValidChangeType(value: string): value is ChangeType {
  return [
    'design',
    'material',
    'manufacturing_process',
    'software',
    'labeling',
    'intended_use',
  ].includes(value as ChangeType);
}
