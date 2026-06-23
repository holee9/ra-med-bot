// @MX:ANCHOR [AUTO] checkArticle83to86 — EU MDR Article 83-86 PMS compliance checker.
// @MX:REASON Patient-safety critical gate (REQ-PMS-007): every PMS document must
//           pass this check before export. fan_in >= 3 (pms-report executor,
//           compliance API route, UI panel).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-007, AC-06)

/**
 * Input shape for the Article 83-86 compliance check. The caller (PMS executor
 * or API route) gathers these flags from the PMS document body + project state.
 */
export interface ComplianceInput {
  /** EU MDR device class: 'I', 'Is', 'Im', 'IIa', 'IIb', 'III'. */
  deviceClass: string;
  /** Whether a PMS plan document exists for the device. */
  hasPmsPlan: boolean;
  /** Whether a PMS report (PMSR) has been generated. */
  hasPmsReport: boolean;
  /** Whether vigilance/complaint data has been collected. */
  hasVigilanceData: boolean;
  /** Whether a PMCF plan exists (Annex XIV Part B — IIa+ only). */
  hasPmcfPlan: boolean;
  /** Whether a PMCF evaluation report exists. */
  hasPmcfEvaluation: boolean;
  /** Number of complaints recorded in the period. */
  complaintCount: number;
  /** Number of SUSAR (suspected serious adverse drug reactions) cases. */
  susarCount: number;
}

export type ArticleStatus = 'satisfied' | 'partial' | 'missing' | 'not_applicable';

export interface ArticleResult {
  article: string;
  status: ArticleStatus;
  detail: string;
}

export type OverallCompliance = 'compliant' | 'partial' | 'non_compliant';

export interface ComplianceResult {
  overall: OverallCompliance;
  articles: ArticleResult[];
}

/** Returns true if the device class requires PMCF (Annex XIV Part B: IIa+). */
function requiresPmcf(deviceClass: string): boolean {
  const cls = deviceClass.toUpperCase();
  return cls === 'IIA' || cls === 'IIB' || cls === 'III';
}

/**
 * Evaluate EU MDR Article 83-86 compliance from the PMS document state.
 *
 * - Article 83 (PMS system): requires a PMS plan.
 * - Article 84 (PMS plan update): requires vigilance data + complaint feed.
 * - Article 85 (PMS report): requires a generated PMSR for IIa+ devices.
 * - Article 86 (PMCF): requires PMCF plan + evaluation for IIa+; N/A for Class I.
 *
 * Overall status: non_compliant if any article is missing; partial if any is
 * partial; compliant only when all applicable articles are satisfied.
 */
export function checkArticle83to86(input: ComplianceInput): ComplianceResult {
  const articles: ArticleResult[] = [];

  // Article 83 — PMS system / plan.
  articles.push(
    input.hasPmsPlan
      ? { article: 'Article 83', status: 'satisfied', detail: 'PMS plan documented.' }
      : {
          article: 'Article 83',
          status: 'missing',
          detail: 'PMS plan is required (EU MDR Article 83). No plan document found.',
        },
  );

  // Article 84 — PMS plan update cycle (fed by complaint/vigilance data).
  const art84Status: ArticleStatus = !input.hasVigilanceData
    ? 'missing'
    : input.complaintCount === 0
      ? 'partial'
      : 'satisfied';
  articles.push({
    article: 'Article 84',
    status: art84Status,
    detail:
      art84Status === 'missing'
        ? 'No vigilance/complaint data collected — PMS plan cannot be updated.'
        : art84Status === 'partial'
          ? 'Vigilance data present but zero complaints recorded — plan update is partial.'
          : 'Vigilance data and complaints feed the PMS plan update cycle.',
  });

  // Article 85 — PMS report (PMSR). Required for all classes, but the depth
  // scales with device class.
  articles.push(
    input.hasPmsReport
      ? { article: 'Article 85', status: 'satisfied', detail: 'PMS report generated.' }
      : {
          article: 'Article 85',
          status: 'missing',
          detail: 'PMS report (PMSR) has not been generated yet.',
        },
  );

  // Article 86 — PMCF plan + evaluation. IIa+ only; Class I is exempt.
  if (!requiresPmdf(input.deviceClass)) {
    articles.push({
      article: 'Article 86',
      status: 'not_applicable',
      detail: `PMCF not required for Class ${input.deviceClass} (Annex XIV Part B applies to IIa+).`,
    });
  } else if (!input.hasPmcfPlan) {
    articles.push({
      article: 'Article 86',
      status: 'missing',
      detail: 'PMCF plan required for IIa+ devices — no plan found.',
    });
  } else if (!input.hasPmcfEvaluation) {
    articles.push({
      article: 'Article 86',
      status: 'partial',
      detail: 'PMCF plan exists but evaluation report not yet drafted.',
    });
  } else {
    articles.push({
      article: 'Article 86',
      status: 'satisfied',
      detail: 'PMCF plan and evaluation report complete.',
    });
  }

  // Overall: non_compliant if any SUSAR exists without vigilance reporting,
  // or if any article is missing. Partial if any article is partial.
  const hasMissing = articles.some((a) => a.status === 'missing');
  const hasPartial = articles.some((a) => a.status === 'partial');
  const susarViolation = input.susarCount > 0 && !input.hasVigilanceData;

  let overall: OverallCompliance;
  if (hasMissing || susarViolation) {
    overall = 'non_compliant';
  } else if (hasPartial) {
    overall = 'partial';
  } else {
    overall = 'compliant';
  }

  return { overall, articles };
}

// @MX:NOTE [AUTO] Internal helper kept outside the hot path for readability.
function requiresPmdf(deviceClass: string): boolean {
  return requiresPmcf(deviceClass);
}
