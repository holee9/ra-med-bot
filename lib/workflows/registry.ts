// @MX:NOTE [AUTO] WORKFLOW_REGISTRY — single source of truth for all workflow definitions.
// Used by workflows list page and WorkflowCard component.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

export interface WorkflowEntry {
  id: string;
  title: string;
  description: string;
  stepCount: number;
  href: string;
}

export const WORKFLOW_REGISTRY: WorkflowEntry[] = [
  {
    id: 'submission-drafter',
    title: 'Submission Drafter',
    description: 'Generate 510(k) submission documents',
    stepCount: 6,
    href: '/workflows/submission-drafter',
  },
  {
    id: 'audit-response',
    title: 'Audit Response',
    description: 'Draft responses to FDA audit findings',
    stepCount: 6,
    href: '/workflows/audit-response',
  },
  {
    id: 'indication-impact',
    title: 'Indication Impact',
    description: 'Analyze impact of indication changes',
    stepCount: 6,
    href: '/workflows/indication-impact',
  },
  {
    id: 'cer',
    title: 'Clinical Evaluation Report',
    description: 'EU MDR Annex XIV CER builder with MEDDEV 2.7/1 Rev4 methodology',
    stepCount: 10,
    href: '/workflows/cer',
  },
  // SPEC-REGULA-PCCP-001 (REQ-PCCP-025): PCCP workflow entry
  {
    id: 'pccp',
    title: 'PCCP Builder',
    description: 'Predetermined Change Control Plan (FDA AI/ML Final Guidance 2024)',
    stepCount: 4,
    href: '/workflows/pccp',
  },
  // SPEC-REGULA-SAMD-001: SaMD pathway builder entry
  {
    id: 'samd',
    title: 'SaMD Pathway Builder',
    description: 'AI/ML SaMD regulatory pathway — IMDRF N12, FDA AI/ML Guidance, EU AI Act',
    stepCount: 5,
    href: '/workflows/samd',
  },
];
