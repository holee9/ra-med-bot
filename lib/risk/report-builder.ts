// @MX:ANCHOR [AUTO] buildRiskReport — ISO 14971 DOCX report builder.
// @MX:REASON Entry point for export BFF route, E2E test, and unit tests. fan_in >= 3.
// @MX:WARN [AUTO] DOCX Packer.toBuffer is CPU-intensive and allocates large Buffers.
// @MX:REASON DOCX generation can be slow for large risk item sets; consider timeout limits.
// @MX:SPEC SPEC-REGULA-RISK-001 (T3.1~T3.4, REQ-RISK-034~036)

import {
  Document,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
  WidthType,
  Packer,
} from 'docx';
import type { RiskLevel } from './risk-evaluation';
import type { ControlTier } from './control-recommendation';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RiskControlPayload {
  id: string;
  tier: ControlTier;
  description: string;
  rationale: string | null;
  isAdopted: boolean;
  residualSeverity?: number;
  residualProbability?: number;
  residualRiskLevel?: RiskLevel;
  alarpJustification?: string | null;
}

export interface RiskItemPayload {
  id: string;
  hazard: string;
  sequenceOfEvents: string;
  hazardousSituation: string;
  harm: string;
  severity: number;
  probability: number;
  riskLevel: RiskLevel;
  lowConfidence: boolean;
  citation: Array<{ source: string; id: string }>;
  controls: RiskControlPayload[];
}

export interface GsprMappingPayload {
  gsprClause: string;
  requirement: string;
  compliance: string;
  evidence: string;
}

export interface RiskRunPayload {
  id: string;
  deviceDescription: string;
  deviceClass: string;
  createdAt: string;
  approvedBy: string | null;
  items: RiskItemPayload[];
  gsprMappings: GsprMappingPayload[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskLevelLabel(level: RiskLevel): string {
  return { acc: 'Acceptable', alarp: 'ALARP', unacc: 'Unacceptable' }[level];
}

function makeHeading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 150 } });
}

function makeText(text: string, bold = false): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold })] });
}

function makeTableCell(text: string, width = 2000): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
    width: { size: width, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

function makeHeaderRow(labels: string[]): TableRow {
  return new TableRow({
    children: labels.map((l) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 18 })] })],
        shading: { fill: '4472C4' },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
      }),
    ),
  });
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildRiskItemsTable(items: RiskItemPayload[]): Table {
  const headerRow = makeHeaderRow(['#', 'Hazard', 'Harm', 'S', 'P', 'Risk Level', 'Controls']);

  const dataRows = items.map((item, idx) => {
    const adoptedControls = item.controls.filter((c) => c.isAdopted);
    return new TableRow({
      children: [
        makeTableCell(`${idx + 1}`, 400),
        makeTableCell(item.hazard, 3000),
        makeTableCell(item.harm, 2500),
        makeTableCell(`${item.severity}`, 400),
        makeTableCell(`${item.probability}`, 400),
        makeTableCell(riskLevelLabel(item.riskLevel), 1400),
        makeTableCell(
          adoptedControls.length > 0
            ? adoptedControls.map((c) => `[${c.tier}] ${c.description}`).join('; ')
            : 'None',
          3000,
        ),
      ],
    });
  });

  return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function buildGsprTable(mappings: GsprMappingPayload[]): Table {
  const headerRow = makeHeaderRow(['GSPR Clause', 'Requirement', 'Compliance', 'Evidence']);

  const dataRows = mappings.map((m) =>
    new TableRow({
      children: [
        makeTableCell(m.gsprClause, 1500),
        makeTableCell(m.requirement, 3000),
        makeTableCell(m.compliance, 1500),
        makeTableCell(m.evidence, 3500),
      ],
    }),
  );

  return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate an ISO 14971 Risk Management Report as a DOCX buffer.
 * Includes: device overview, risk item matrix, GSPR mapping, approval status.
 */
export async function buildRiskReport(run: RiskRunPayload): Promise<Uint8Array> {
  const sections: (Paragraph | Table)[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: 'Risk Management Report',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );
  sections.push(
    new Paragraph({
      text: 'ISO 14971:2019 Medical Device Risk Management',
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
  );

  // Section 1: Device Overview
  sections.push(makeHeading('1. Device Overview', HeadingLevel.HEADING_1));
  sections.push(makeText(`Report ID: ${run.id}`));
  sections.push(makeText(`Device Description: ${run.deviceDescription}`));
  sections.push(makeText(`Device Classification: ${run.deviceClass}`));
  sections.push(makeText(`Report Date: ${run.createdAt}`));
  sections.push(makeText(`Approval Status: ${run.approvedBy ? `Approved by ${run.approvedBy}` : 'Pending RA-Lead Approval'}`));
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Section 2: Risk Analysis Summary
  sections.push(makeHeading('2. Risk Analysis Summary', HeadingLevel.HEADING_1));
  sections.push(makeText(`Total Risk Items Identified: ${run.items.length}`));
  const unacceptable = run.items.filter((i) => i.riskLevel === 'unacc').length;
  const alarp = run.items.filter((i) => i.riskLevel === 'alarp').length;
  const acceptable = run.items.filter((i) => i.riskLevel === 'acc').length;
  sections.push(makeText(`  Unacceptable: ${unacceptable}`));
  sections.push(makeText(`  ALARP: ${alarp}`));
  sections.push(makeText(`  Acceptable: ${acceptable}`));
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Section 3: Risk Item Matrix
  sections.push(makeHeading('3. Risk Item Matrix (ISO 14971 Annex E)', HeadingLevel.HEADING_1));
  if (run.items.length > 0) {
    sections.push(buildRiskItemsTable(run.items));
  } else {
    sections.push(makeText('No risk items identified.'));
  }
  sections.push(new Paragraph({ text: '', spacing: { after: 300 } }));

  // Section 4: EU MDR GSPR Mapping
  sections.push(makeHeading('4. EU MDR Annex I GSPR Mapping', HeadingLevel.HEADING_1));
  if (run.gsprMappings.length > 0) {
    sections.push(buildGsprTable(run.gsprMappings));
  } else {
    sections.push(makeText('No GSPR mappings recorded.'));
  }
  sections.push(new Paragraph({ text: '', spacing: { after: 300 } }));

  // Section 5: Approval
  sections.push(makeHeading('5. RA-Lead Approval', HeadingLevel.HEADING_1));
  sections.push(
    makeText(
      run.approvedBy
        ? `This risk management report has been reviewed and approved by RA-Lead (User ID: ${run.approvedBy}) in accordance with ISO 14971:2019 §10.`
        : 'PENDING: This report awaits RA-Lead approval before distribution.',
      !run.approvedBy,
    ),
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
