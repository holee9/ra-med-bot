// SPEC-REGULA-IMPACT-001 — map regulatory update to affected document sections.
// @MX:TODO [AUTO] LLM-based section identification stubbed; wire full prompt in Phase 2.
// @MX:PRIORITY medium

import type { AffectedSection } from './types';

interface UpdateInfo {
  region: string;
  impactTypeHint: string | null;
  impactAnalysisText: string | null;
}

// Heuristic mapping: impact type → typical document sections requiring update.
const IMPACT_TYPE_SECTIONS: Record<string, AffectedSection[]> = {
  labeling: [
    {
      document_type: 'IFU',
      section_reference: '§5 Indications for Use',
      rationale: 'Labeling change affects IFU',
    },
    {
      document_type: '510(k)',
      section_reference: 'Section 14: Proposed Labeling',
      rationale: 'Labeling change affects 510(k) labeling section',
    },
  ],
  software: [
    {
      document_type: 'SaMD Documentation',
      section_reference: '§3 Software Description',
      rationale: 'Software regulation impacts SaMD docs',
    },
    {
      document_type: 'Risk Management File',
      section_reference: 'Hazard Analysis',
      rationale: 'Software change may introduce new hazards',
    },
  ],
  clinical: [
    {
      document_type: 'Clinical Evaluation Report',
      section_reference: '§6 Clinical Evidence',
      rationale: 'Clinical data requirement change',
    },
    {
      document_type: '510(k)',
      section_reference: 'Section 12: Clinical Investigations',
      rationale: 'Clinical requirement impacts submission',
    },
  ],
  cybersecurity: [
    {
      document_type: 'Cybersecurity Documentation',
      section_reference: 'Threat Model',
      rationale: 'Cybersecurity guidance update',
    },
    {
      document_type: 'SaMD Documentation',
      section_reference: '§7 Security Controls',
      rationale: 'Cybersecurity impacts SaMD security section',
    },
  ],
  qms: [
    {
      document_type: 'Quality Management System',
      section_reference: 'Design Controls',
      rationale: 'QMS regulation change',
    },
    {
      document_type: 'Design History File',
      section_reference: 'Design Verification',
      rationale: 'QMS change may affect DHF',
    },
  ],
};

/**
 * Returns affected sections for a regulatory update given the device class.
 * Uses heuristic mapping; LLM enrichment is deferred to Phase 2.
 */
export async function mapSections(
  update: UpdateInfo,
  deviceClass: string | null,
): Promise<AffectedSection[]> {
  if (!update.impactTypeHint) return [];

  const hint = update.impactTypeHint.toLowerCase();
  for (const [key, sections] of Object.entries(IMPACT_TYPE_SECTIONS)) {
    if (hint.includes(key)) {
      // Class III devices get extra scrutiny — mark clinical section regardless
      if (deviceClass?.toUpperCase().includes('III') && key !== 'clinical') {
        const extra: AffectedSection = {
          document_type: 'PMA',
          section_reference: '§3 Device Description',
          rationale: 'Class III device — PMA section review recommended',
        };
        return [...sections, extra];
      }
      return sections;
    }
  }

  return [];
}
