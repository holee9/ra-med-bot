// @MX:NOTE [AUTO] Change assessment PDF export — SPEC-REGULA-CHANGE-CONTROL-001 (REQ-007).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-007, REQ-010)
//
// Renders the canonical JSON report shape (the single source of truth returned
// by POST /api/change-control/[assessmentId]/export when format=pdf-json) into a
// real PDF byte stream via @react-pdf/renderer. Mirrors the PCCP exporter pattern
// (lib/pccp/exporters/pdf.tsx, PR #221): lazy import so React initialization does
// not leak into unit tests, optional DRAFT watermark for non-final assessments,
// and a provenance footer carrying the REQ-010 version metadata (model/prompt/
// template) — omitting provenance would violate the 21 CFR Part 11 record
// integrity requirement that the PCCP exporter also enforces.

import type { AssessmentStatus } from '../types';

/**
 * Verdict row as produced by the export route (DB row with citations attached).
 * Mirrors the canonical JSON shape `{ assessment, verdicts, riskLinks, ... }`
 * which is the single source of truth. The renderer is tolerant of optional
 * fields so it can consume the raw DB rows directly without a reshape layer.
 */
export interface VerdictRow {
  jurisdiction: string;
  verdict: string;
  rationale: string;
  confidence: string;
  /** Attached citations (REQ-006). Tolerant of both canonical and DB row shapes. */
  citations: ReadonlyArray<{
    id?: string;
    source?: string;
    sourceLabel?: string | null;
    section?: string;
    excerpt?: string;
  }>;
  /**
   * True when REQ-006 citation enforcement rejected the verdict. The canonical
   * JurisdictionVerdict type always carries this; the raw DB row does not, so
   * the route sets it when assembling the JSON shape. The renderer treats it as
   * optional to stay compatible with both sources.
   */
  citationRejected?: boolean;
}

/** DB row shape for change_assessments (subset consumed by the renderer). */
export interface ChangeAssessmentRecord {
  id: string;
  projectId: string;
  changeType: string;
  description: string;
  impactScope: string;
  status: string;
  modelVersion: string;
  promptVersion: string;
  templateVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Risk link row shape returned by fetchLinkedRiskItems. */
export interface RiskLinkRecord {
  id: string;
  hazard: string;
  harm: string;
  riskLevel: string;
}

export interface ChangePdfExportOptions {
  /** Render a diagonal DRAFT watermark across the page (non-final assessments). */
  includeDraftWatermark: boolean;
}

/** Human-readable labels for the 6 change classification types. */
const CHANGE_TYPE_LABELS: Record<string, string> = {
  design: 'Design Change',
  material: 'Material Change',
  manufacturing_process: 'Manufacturing Process Change',
  software: 'Software Change',
  labeling: 'Labeling Change',
  intended_use: 'Intended Use Change',
};

/** Human-readable labels for the 4 verdict outcomes. */
const VERDICT_LABELS: Record<string, string> = {
  new_submission_required: 'New Submission Required',
  change_notification: 'Change Notification',
  internal_record_only: 'Internal Record Only',
  not_applicable: 'Not Applicable',
};

/** Human-readable labels for the 5 jurisdictions. */
const JURISDICTION_LABELS: Record<string, string> = {
  FDA: 'FDA (United States)',
  EU_MDR: 'EU MDR',
  MFDS: 'MFDS (South Korea)',
  NMPA: 'NMPA (China)',
  PMDA: 'PMDA (Japan)',
};

function labelChangeType(t: string): string {
  return CHANGE_TYPE_LABELS[t] ?? t;
}

function labelJurisdiction(j: string): string {
  return JURISDICTION_LABELS[j] ?? j;
}

function labelVerdict(v: string): string {
  return VERDICT_LABELS[v] ?? v;
}

function labelConfidence(c: string): string {
  return c === 'verified' ? 'verified' : 'unverified';
}

/**
 * Generates a PDF buffer for a change-control assessment report. Renders FROM the
 * canonical JSON shape — assessment, per-jurisdiction verdicts with retrieved
 * citations, and risk links — plus a REQ-010 provenance footer.
 *
 * Uses @react-pdf/renderer (already a project dependency) with lazy import to
 * avoid React initialization side-effects in unit tests (same rationale as PCCP).
 */
export async function exportChangeAssessmentToPdf(
  assessment: ChangeAssessmentRecord,
  verdicts: VerdictRow[],
  riskLinks: RiskLinkRecord[],
  options: ChangePdfExportOptions,
): Promise<Buffer> {
  const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer');

  const styles = StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingBottom: 50,
      paddingHorizontal: 48,
      fontSize: 11,
      fontFamily: 'Helvetica',
      lineHeight: 1.5,
    },
    title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    subtitle: { fontSize: 11, color: 'rgb(74, 85, 104)', marginBottom: 16 },
    sectionHeading: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      marginTop: 16,
      marginBottom: 6,
      borderBottom: '1 solid rgb(203, 213, 224)',
      paddingBottom: 2,
    },
    kvKey: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
    kvValue: { fontSize: 10, marginBottom: 4 },
    jurisdictionHeading: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      marginTop: 10,
      marginBottom: 4,
    },
    verdictLine: { fontSize: 10, marginBottom: 2 },
    rationaleText: { fontSize: 10, marginBottom: 4, color: 'rgb(74, 85, 104)' },
    citationBlock: {
      marginBottom: 4,
      marginLeft: 12,
      borderLeft: '1 solid rgb(203, 213, 224)',
      paddingLeft: 6,
    },
    citationSource: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
    citationExcerpt: { fontSize: 9, color: 'rgb(74, 85, 104)' },
    watermark: {
      fontSize: 60,
      fontFamily: 'Helvetica-Bold',
      color: 'rgba(220, 38, 38, 0.12)',
      textAlign: 'center',
      marginTop: 200,
      transform: 'rotate(-30deg)',
    },
    provenanceFooter: {
      position: 'absolute',
      bottom: 24,
      left: 48,
      right: 48,
      textAlign: 'center',
      fontSize: 8,
      color: 'rgb(113, 128, 150)',
      borderTop: '1 solid rgb(226, 232, 240)',
      paddingTop: 4,
    },
  });

  const verdictSections = verdicts.map((v, idx) => {
    const conf = labelConfidence(v.confidence);
    return (
      <View key={`${v.jurisdiction}-${idx}`}>
        <Text style={styles.jurisdictionHeading}>{labelJurisdiction(v.jurisdiction)}</Text>
        <Text style={styles.verdictLine}>
          Verdict: {labelVerdict(v.verdict)}
          {' · '}Confidence: {conf}
          {v.citationRejected ? ' · Citation REJECTED (REQ-006)' : ''}
        </Text>
        <Text style={styles.rationaleText}>Rationale: {v.rationale}</Text>
        {v.citations.length > 0 ? (
          v.citations.map((c, ci) => {
            const sourceLabel = c.source ?? c.sourceLabel ?? '(unsourced)';
            const citeKey = c.id ?? `${idx}-${sourceLabel}-${ci}`;
            return (
              <View key={`cite-${citeKey}`} style={styles.citationBlock}>
                <Text style={styles.citationSource}>
                  {sourceLabel}
                  {c.section ? ` § ${c.section}` : ''}
                </Text>
                {c.excerpt ? <Text style={styles.citationExcerpt}>{c.excerpt}</Text> : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.citationExcerpt}>(no retrieved citations)</Text>
        )}
      </View>
    );
  });

  const riskLinkRows =
    riskLinks.length === 0 ? (
      <Text style={styles.kvValue}>(no linked risk items)</Text>
    ) : (
      riskLinks.map((r) => (
        <View key={`risk-${r.id}`} style={{ marginBottom: 2 }}>
          <Text style={styles.kvKey}>
            {r.riskLevel} — {r.hazard} → {r.harm}
          </Text>
        </View>
      ))
    );

  const doc = (
    <Document
      title={`Change Assessment — ${labelChangeType(assessment.changeType)} (${assessment.id})`}
      author="Regula — Medical Device RA Assistant"
      subject="Change Control Assessment Report"
      creator="Regula — Medical Device RA Assistant"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Change Control Assessment</Text>
        <Text style={styles.subtitle}>
          {labelChangeType(assessment.changeType)} · Status: {assessment.status} · Project:{' '}
          {assessment.projectId}
        </Text>

        <Text style={styles.sectionHeading}>Change Description</Text>
        <Text style={styles.kvKey}>Type</Text>
        <Text style={styles.kvValue}>{labelChangeType(assessment.changeType)}</Text>
        <Text style={styles.kvKey}>Description</Text>
        <Text style={styles.kvValue}>{assessment.description}</Text>
        <Text style={styles.kvKey}>Impact Scope</Text>
        <Text style={styles.kvValue}>{assessment.impactScope}</Text>

        <Text style={styles.sectionHeading}>Jurisdiction Verdicts</Text>
        {verdictSections}

        <Text style={styles.sectionHeading}>Linked Risk Items (REQ-008)</Text>
        {riskLinkRows}

        {/* REQ-010: provenance — model/prompt/template version metadata. */}
        <Text style={styles.sectionHeading}>Provenance</Text>
        <Text style={styles.kvKey}>Model Version</Text>
        <Text style={styles.kvValue}>{assessment.modelVersion}</Text>
        <Text style={styles.kvKey}>Prompt Version</Text>
        <Text style={styles.kvValue}>{assessment.promptVersion}</Text>
        <Text style={styles.kvKey}>Template Version</Text>
        <Text style={styles.kvValue}>{assessment.templateVersion}</Text>

        {options.includeDraftWatermark ? <Text style={styles.watermark}>DRAFT</Text> : null}
        <Text style={styles.provenanceFooter} fixed>
          Generated by Regula · Confidential — Change Assessment {assessment.id} · Model{' '}
          {assessment.modelVersion} · Prompt {assessment.promptVersion}
        </Text>
      </Page>
    </Document>
  );

  const instance = pdf(doc);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuffer));
}

/**
 * Derive a safe PDF filename for a change assessment. `id` is a server-generated
 * UUID. `changeType` is an UNCONSTRAINED text column (changeAssessments.change_type
 * is `text`, not an enum) and is application-validated upstream, but there is no
 * DB-level guarantee. The regex below + sanitizeFilename are therefore the ONLY
 * barrier against Content-Disposition header injection (CRLF / response-splitting /
 * path traversal) — do NOT remove either layer. id is inherently safe (UUID).
 */
export function getChangePdfFilename(
  assessment: Pick<ChangeAssessmentRecord, 'id' | 'changeType'>,
): string {
  // Strip every char outside [A-Za-z0-9_-] → CR/LF/null/quotes/separators gone,
  // then sanitizeFilename (traceability convention) re-strips + caps length.
  const safe = `${assessment.changeType}_${assessment.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ChangeAssessment_${safe}.pdf`;
}

// Re-export status type for the route's watermark computation.
export type { AssessmentStatus };
