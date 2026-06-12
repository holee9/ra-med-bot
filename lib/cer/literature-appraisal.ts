// @MX:NOTE SIGN 50 evidence level + GRADE quality appraisal (deterministic).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-007)
//
// Heuristic appraisal driven by title/abstract keywords. Deliberately NOT
// LLM-based: appraisal results feed a regulated CER and must be reproducible
// and auditable for the same input.

import type { PubMedArticle } from './pubmed-client';

export type Sign50Level =
  | '1++' // High quality meta-analysis / systematic review of RCTs
  | '1+' // Well conducted meta-analysis / systematic review / RCTs with low risk of bias
  | '1-' // Meta-analysis / systematic review / RCTs with high risk of bias
  | '2++' // High quality systematic reviews of case-control or cohort studies
  | '2+' // Well conducted case-control or cohort studies
  | '2-' // Case-control or cohort studies with high risk of bias
  | '3' // Non-analytic studies (case reports, case series)
  | '4'; // Expert opinion

export type GradeQuality = 'high' | 'moderate' | 'low' | 'very_low';

export interface AppraisalResult {
  sign50Level: Sign50Level;
  gradeQuality: GradeQuality;
  justification: string;
}

interface AppraisalRule {
  keywords: string[];
  sign50Level: Sign50Level;
  gradeQuality: GradeQuality;
  label: string;
}

// Rules are evaluated in order; the first matching rule wins. Higher-evidence
// designs are listed first so a systematic review of RCTs outranks an RCT.
const APPRAISAL_RULES: readonly AppraisalRule[] = [
  {
    keywords: ['meta-analysis', 'meta analysis', 'systematic review'],
    sign50Level: '1++',
    gradeQuality: 'high',
    label: 'meta-analysis / systematic review',
  },
  {
    keywords: ['randomized', 'randomised', 'rct', 'randomized controlled trial'],
    sign50Level: '1+',
    gradeQuality: 'moderate',
    label: 'randomized controlled trial',
  },
  {
    keywords: ['cohort', 'case-control', 'case control'],
    sign50Level: '2+',
    gradeQuality: 'moderate',
    label: 'cohort / case-control study',
  },
  {
    keywords: ['case report', 'case series'],
    sign50Level: '3',
    gradeQuality: 'low',
    label: 'case report / case series',
  },
];

const FALLBACK: AppraisalResult = {
  sign50Level: '4',
  gradeQuality: 'very_low',
  justification:
    'No recognized study-design keywords found in title or abstract; classified as expert opinion / non-analytic (SIGN 50 level 4, GRADE very low).',
};

/**
 * Appraise a single article's evidence level using a deterministic keyword
 * heuristic over its title and abstract. Always returns a result; unmatched
 * articles fall back to SIGN 50 level 4 / GRADE very low.
 */
export function appraiseEvidence(article: PubMedArticle): AppraisalResult {
  const haystack = `${article.title} ${article.abstract}`.toLowerCase();

  for (const rule of APPRAISAL_RULES) {
    const hit = rule.keywords.find((kw) => haystack.includes(kw));
    if (hit) {
      return {
        sign50Level: rule.sign50Level,
        gradeQuality: rule.gradeQuality,
        justification: `Matched "${hit}" indicating a ${rule.label} (SIGN 50 ${rule.sign50Level}, GRADE ${rule.gradeQuality}).`,
      };
    }
  }

  return { ...FALLBACK };
}
