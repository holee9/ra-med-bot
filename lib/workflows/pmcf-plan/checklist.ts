// @MX:ANCHOR [AUTO] PMCF_CHECKLIST — EU MDR Annex XIV Part B requirements.
// @MX:REASON Regulatory template (REQ-PMS-003, AC-03). fan_in >= 3: pmcf-plan
//           executor, UI builder, compliance route.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-003, AC-03)

/**
 * EU MDR Annex XIV Part B — PMCF plan core requirements. Each entry maps to a
 * clause in Part B. The checklist must be 100% included in every PMCF plan
 * (AC-03 — verified by unit test on checklist length).
 */
export interface ChecklistItem {
  id: string;
  clause: string;
  title: string;
  description: string;
}

export const PMCF_CHECKLIST: readonly ChecklistItem[] = [
  {
    id: 'pmcf_objectives',
    clause: 'Annex XIV Part B §1',
    title: 'PMCF Objectives',
    description:
      'Clearly define the clinical objectives the PMCF aims to address (safety, performance, benefit-risk).',
  },
  {
    id: 'pmcf_methods',
    clause: 'Annex XIV Part B §2',
    title: 'PMCF Methods',
    description:
      'Describe the methods used (literature review, feedback, surveys, clinical follow-up, retrospective study).',
  },
  {
    id: 'pmcf_reference_state',
    clause: 'Annex XIV Part B §3',
    title: 'Reference State of the Art',
    description:
      'State the current state of the art and how the device compares (benchmark where applicable).',
  },
  {
    id: 'pmcf_rationale',
    clause: 'Annex XIV Part B §4',
    title: 'PMCF Rationale',
    description:
      'Justify why the chosen PMCF methods are appropriate for the residual risks and clinical benefits.',
  },
  {
    id: 'pmcf_evaluation_activities',
    clause: 'Annex XIV Part B §5',
    title: 'Evaluation Activities',
    description:
      'Detail the specific clinical evaluation activities (e.g., registry data, PMCF studies, user surveys).',
  },
  {
    id: 'pmcf_statistical_plan',
    clause: 'Annex XIV Part B §6',
    title: 'Statistical Analysis Plan',
    description:
      'Define the statistical methods for analyzing collected PMCF data and determining significance.',
  },
  {
    id: 'pmcf_timeline_milestones',
    clause: 'Annex XIV Part B §7',
    title: 'Timeline and Milestones',
    description:
      'Specify PMCF activity timelines, data collection intervals, and reporting milestones.',
  },
  {
    id: 'pmcf_deviation_handling',
    clause: 'Annex XIV Part B §8',
    title: 'Deviation Handling',
    description:
      'Define how deviations from the PMCF plan will be assessed, documented, and reported.',
  },
];

/** Returns the PMCF checklist item by id, or undefined. */
export function findChecklistItem(id: string): ChecklistItem | undefined {
  return PMCF_CHECKLIST.find((c) => c.id === id);
}
