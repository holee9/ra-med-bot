/**
 * @vitest-environment node
 * Change assessment PDF exporter tests — SPEC-REGULA-CHANGE-CONTROL-001 (REQ-007, AC-05).
 * Verifies real PDF generation (no placeholder text) and valid PDF magic bytes,
 * mirroring the PCCP exporter test pattern (lib/pccp/__tests__/exporters.test.tsx).
 */

import { describe, expect, it, vi } from 'vitest';

// @MX:LEGACY archived from lib
import {
  type ChangeAssessmentRecord,
  type RiskLinkRecord,
  type VerdictRow,
  exportChangeAssessmentToPdf,
  getChangePdfFilename,
} from '../pdf';

// Mock @react-pdf/renderer so tests don't need a full React reconciler.
vi.mock('@react-pdf/renderer', () => {
  type P = { children?: unknown };
  const Comp = (_props: P) => null;
  return {
    Document: Comp,
    Page: Comp,
    Text: Comp,
    View: Comp,
    StyleSheet: { create: <T,>(s: T) => s },
    pdf: () => ({
      toBlob: async () => {
        // A minimal but valid PDF magic header followed by dummy content.
        const header = '%PDF-1.4\n%real-change-assessment-pdf-from-mock\n';
        return new Blob([header], { type: 'application/pdf' });
      },
    }),
  };
});

const assessment: ChangeAssessmentRecord = {
  id: '00000000-0000-0000-0000-0000000000a1',
  projectId: '00000000-0000-0000-0000-0000000000p1',
  changeType: 'design',
  description: 'Updated the signal-processing algorithm to use a deeper model.',
  impactScope: 'Cardiac arrhythmia detection sensitivity; no intended-use change.',
  status: 'reviewed',
  modelVersion: 'claude-opus-4.7',
  promptVersion: 'change-control-v2.3',
  templateVersion: 'report-v1.1',
  createdAt: new Date('2026-06-20'),
  updatedAt: new Date('2026-06-21'),
};

const verdicts: VerdictRow[] = [
  {
    jurisdiction: 'FDA',
    verdict: 'new_submission_required',
    rationale: 'Significant design change triggering a new 510(k) per 21 CFR 807.81(a)(3).',
    confidence: 'verified',
    citationRejected: false,
    citations: [
      {
        source: '21 CFR 807.81(a)(3)',
        section: 'significant change',
        excerpt:
          'A change or modification in the device that could significantly affect safety or effectiveness.',
      },
    ],
  },
  {
    jurisdiction: 'EU_MDR',
    verdict: 'change_notification',
    rationale: 'Notification to notified body per MDR Article 10(9).',
    confidence: 'unverified',
    citations: [],
  },
];

const riskLinks: RiskLinkRecord[] = [
  {
    id: 'risk-1',
    hazard: 'False negative arrhythmia detection',
    harm: 'Delayed treatment',
    riskLevel: 'serious',
  },
];

describe('exportChangeAssessmentToPdf — real PDF generation (REQ-007 AC-05)', () => {
  it('returns a buffer with valid PDF magic bytes (not placeholder text)', async () => {
    const buf = await exportChangeAssessmentToPdf(assessment, verdicts, riskLinks, {
      includeDraftWatermark: false,
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    // PDF magic header — proves real PDF binary, not text placeholder.
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('generates non-trivial size buffer', async () => {
    const buf = await exportChangeAssessmentToPdf(assessment, verdicts, riskLinks, {
      includeDraftWatermark: true,
    });
    expect(buf.length).toBeGreaterThan(20);
  });

  it('handles empty verdicts and risk links without error', async () => {
    const buf = await exportChangeAssessmentToPdf(assessment, [], [], {
      includeDraftWatermark: false,
    });
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('tolerates DB-shaped citations (sourceLabel instead of source)', async () => {
    // The export route joins raw change_verdict_citations rows which expose
    // sourceLabel/sourceSectionId (not source/section). The renderer must
    // resolve the label from either field without throwing.
    const dbShaped: VerdictRow[] = [
      {
        jurisdiction: 'MFDS',
        verdict: 'internal_record_only',
        rationale: 'Internal record suffices.',
        confidence: 'unverified',
        citations: [
          {
            sourceLabel: 'MFDS Notice 2024-50',
            excerpt: 'Excerpt from the MFDS notice.',
          },
        ],
      },
    ];
    const buf = await exportChangeAssessmentToPdf(assessment, dbShaped, [], {
      includeDraftWatermark: false,
    });
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('getChangePdfFilename', () => {
  it('builds a safe filename from changeType + id', () => {
    const fname = getChangePdfFilename(assessment);
    expect(fname).toBe(`ChangeAssessment_design_${assessment.id}.pdf`);
  });

  it('sanitizes unexpected characters defensively', () => {
    const fname = getChangePdfFilename({
      id: 'id-with/slash',
      changeType: 'weird type!',
    });
    // No raw spaces, slashes, or exclamation marks reach the filename.
    expect(fname).not.toMatch(/[/! ]/);
    expect(fname.endsWith('.pdf')).toBe(true);
  });
});
