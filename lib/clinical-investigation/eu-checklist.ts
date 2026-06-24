// @MX:NOTE [AUTO] euMdrChecklist — REQ-CLININV-003 EU MDR Article 62 / Annex XV checklist.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-003, AC-02)
// @MX:REASON Deterministic checklist (no LLM) — the regulatory requirements are
//           fixed text in EU MDR. Every item carries its regulatory basis citation
//           so the output is audit-defensible. Callers persist the checklist JSONB
//           and surface it to the RA team via the dashboard (AC-05).

import { enforceCitations } from './citation-enforcement';
import type { RegulatoryCitation } from './types';

export interface ChecklistItem {
  id: string;
  title: string;
  ref: string; // e.g. "EU MDR Article 62(2)"
  completed: boolean;
}

export interface EuChecklistResult {
  items: ChecklistItem[];
  citations: RegulatoryCitation[];
}

const CITATIONS: RegulatoryCitation[] = [
  { source: 'EU MDR', id: 'Article 62', url: 'https://eur-lex.europa.eu/eli/reg/2017/745' },
  { source: 'EU MDR', id: 'Annex XV', url: 'https://eur-lex.europa.eu/eli/reg/2017/745' },
  { source: 'EU MDR', id: 'Article 70' },
  { source: 'EU MDR', id: 'Article 71' },
  { source: 'EU MDR', id: 'Article 72' },
  { source: 'ISO', id: '14155' },
  { source: 'Declaration of Helsinki', id: 'latest revision' },
];

/**
 * REQ-CLININV-003 — EU MDR Article 62 / Annex XV clinical-investigation checklist.
 *
 * Returns the canonical checklist a sponsor must complete before initiating an
 * EU MDR clinical investigation. Items are derived from Article 62(2) and
 * Annex XV Chapter II; the caller (UI/RA team) marks each item completed as
 * evidence is gathered.
 *
 * Citations are re-grounded via enforceCitations against the RAG-retrieved source
 * list to ensure regulatory text fidelity (REQ-010).
 */
export function buildEuMdrChecklist(
  retrievedSources: ReadonlyArray<{ citation: string; title?: string }> = [],
): EuChecklistResult {
  const items: ChecklistItem[] = [
    {
      id: 'art62_2_a',
      title: 'Investigation plan (Annex XV, CIP) drafted and signed',
      ref: 'EU MDR Article 62(2)(a)',
      completed: false,
    },
    {
      id: 'art62_2_b',
      title: 'Investigator brochure (IB) prepared with device summary and risk analysis',
      ref: 'EU MDR Article 62(2)(b)',
      completed: false,
    },
    {
      id: 'art62_2_c',
      title: 'Evidence of conformity with relevant GSPRs that can be demonstrated pre-clinically',
      ref: 'EU MDR Article 62(2)(c)',
      completed: false,
    },
    {
      id: 'art62_2_d',
      title: 'Risk analysis and risk-management report aligned with ISO 14971',
      ref: 'EU MDR Article 62(2)(d)',
      completed: false,
    },
    {
      id: 'art62_2_e',
      title: 'Device instructions for use (IFU) and labelling draft',
      ref: 'EU MDR Article 62(2)(e)',
      completed: false,
    },
    {
      id: 'art62_2_f',
      title: 'Clinical investigation report format (Annex XV) understood',
      ref: 'EU MDR Article 62(2)(f) + Annex XV',
      completed: false,
    },
    {
      id: 'art62_4',
      title: 'Ethics committee (EC) opinion obtained in each Member State',
      ref: 'EU MDR Article 62(4)',
      completed: false,
    },
    {
      id: 'art62_5',
      title: 'Single-submission via EUDAMED (Article 70 notification)',
      ref: 'EU MDR Article 62(5) + Article 70',
      completed: false,
    },
    {
      id: 'art71',
      title: 'Conditions for start met (Article 71 tacit authorization period)',
      ref: 'EU MDR Article 71',
      completed: false,
    },
    {
      id: 'art72',
      title: 'Subject informed consent procedure defined (Helsinki + ISO 14155)',
      ref: 'EU MDR Article 72 + ISO 14155',
      completed: false,
    },
  ];

  const enforced = enforceCitations(CITATIONS, retrievedSources);

  return { items, citations: enforced.citations };
}
