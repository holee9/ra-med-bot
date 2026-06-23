// @MX:ANCHOR [AUTO] PMS_REPORT_SECTIONS — MDCG 2022-21 PMS report section structure.
// @MX:REASON Regulatory template (REQ-PMS-002, AC-02). fan_in >= 3: executor,
//           UI panel, compliance route.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002, AC-02)

/**
 * MDCG 2022-21_guidance on PMS plan — the canonical section structure for a
 * Periodic Safety Update Report (PSUR) / PMS report under EU MDR Article 85.
 */
export const PMS_REPORT_SECTIONS = [
  'executive_summary',
  'device_description',
  'intended_use',
  'pms_plan_summary',
  'complaint_data',
  'vigilance_data',
  'susar_trend_reporting',
  'pmcf_findings',
  'risk_benefit_reassessment',
  'corrective_actions',
  'conclusions',
] as const;

export type PmsReportSection = (typeof PMS_REPORT_SECTIONS)[number];

/** Returns true if the string is a valid PMS report section. */
export function isValidPmsSection(section: string): section is PmsReportSection {
  return (PMS_REPORT_SECTIONS as readonly string[]).includes(section);
}

/** SUSAR / trend reporting section template (REQ-PMS-005). */
export const SUSAR_TREND_TEMPLATE = {
  heading: 'SUSAR and Trend Reporting (EU MDR Article 83-86)',
  requiredFields: [
    'susar_count',
    'susar_narrative_ref',
    'trend_category',
    'trend_statistical_method',
    'reportability_assessment',
    'competent_authority_notified',
  ],
} as const;

/** Build an empty section map (all sections present, content empty). */
export function buildEmptySectionMap(): Record<PmsReportSection, string> {
  const map = {} as Record<PmsReportSection, string>;
  for (const s of PMS_REPORT_SECTIONS) {
    map[s] = '';
  }
  return map;
}
