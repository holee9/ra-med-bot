// @MX:NOTE DOCX exporter for the assembled CER document (docx npm package).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-027, REQ-CER-029)

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { CerDocument } from '../cer-assembler';
import { formatVancouver } from '../citation-formatter';

/**
 * Render a CerDocument to a Word (.docx) Buffer suitable for download in an
 * API route. Produces a title, manufacturer/date header, one H1 section per
 * MEDDEV stage, an optional equivalence section, and a Vancouver-formatted
 * literature references section.
 */
export async function exportToDOCX(cer: CerDocument): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`Clinical Evaluation Report — ${cer.deviceName}`)],
    }),
  );

  // Manufacturer + date header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Manufacturer: ${cer.manufacturer}`, bold: true })],
    }),
  );
  children.push(
    new Paragraph({
      children: [new TextRun(`Date: ${formatDate(cer.createdAt)}`)],
    }),
  );

  // Stage sections (H1 heading + content paragraphs)
  for (const stage of cer.stages) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(`${stage.stageId}. ${stage.title}`)],
      }),
    );
    children.push(...renderContent(stage.content));
  }

  // Equivalence assessment section (optional)
  if (cer.equivalenceAssessment) {
    children.push(...renderEquivalence(cer.equivalenceAssessment));
  }

  // Literature references (Vancouver formatted)
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Literature References')],
    }),
  );
  if (cer.literatureReferences.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('No literature references included.')] }));
  } else {
    cer.literatureReferences.forEach((article, index) => {
      children.push(
        new Paragraph({
          children: [new TextRun(`${index + 1}. ${formatVancouver(article)}`)],
        }),
      );
    });
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function renderContent(content: string): Paragraph[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [
      new Paragraph({
        children: [new TextRun({ text: '(Section not yet completed.)', italics: true })],
      }),
    ];
  }
  // Split on blank lines into discrete paragraphs.
  return trimmed
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => new Paragraph({ children: [new TextRun(para)] }));
}

function renderEquivalence(assessment: CerDocument['equivalenceAssessment']): Paragraph[] {
  if (!assessment) {
    return [];
  }
  const paras: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Equivalence Assessment (Article 61(4))')],
    }),
    new Paragraph({
      children: [
        new TextRun(
          `Subject device: ${assessment.deviceName} — Equivalent device: ${assessment.equivalentDevice}`,
        ),
      ],
    }),
    new Paragraph({ children: [new TextRun(assessment.summaryText)] }),
  ];

  for (const dim of assessment.dimensions) {
    paras.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun(
            `${capitalize(dim.dimension)} — ${dim.satisfied ? 'Satisfied' : 'Not satisfied'}`,
          ),
        ],
      }),
    );
    if (dim.claimText) {
      paras.push(new Paragraph({ children: [new TextRun(`Claim: ${dim.claimText}`)] }));
    }
    paras.push(new Paragraph({ children: [new TextRun(dim.justification)] }));
  }

  return paras;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
