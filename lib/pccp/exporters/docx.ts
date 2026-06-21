// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-018)
// PCCP DOCX export — real document generation via the `docx` library.
// Emits a title, metadata header, one H1 section per component (with
// content_jsonb flattened to key-value paragraphs), and an optional DRAFT note.

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { PccpComponentRecord, PccpComponentType, PccpVersion } from '../types';

export interface PccpDocxExportOptions {
  includeDraftWatermark: boolean;
}

/** Human-readable labels for each PCCP component type. */
const COMPONENT_LABELS: Record<PccpComponentType, string> = {
  modification_description: 'Modification Description',
  sps: 'Software Pre-Specifications (SPS)',
  acp: 'Algorithm Change Protocol (ACP)',
  impact_assessment: 'Impact Assessment',
  performance_testing: 'Performance Testing',
};

/** Flatten content_jsonb to [key, value] pairs (single-level recursion). */
function flattenContent(
  content: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(content)) {
    const label = prefix ? `${prefix} · ${k}` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      const items = v.map((item) =>
        typeof item === 'object' && item !== null
          ? Object.entries(item as Record<string, unknown>)
              .map(([ik, iv]) => `${ik}: ${iv}`)
              .join(', ')
          : String(item),
      );
      out.push({ key: label, value: items.join('; ') });
    } else if (typeof v === 'object') {
      out.push(...flattenContent(v as Record<string, unknown>, label));
    } else {
      out.push({ key: label, value: String(v) });
    }
  }
  return out;
}

/**
 * Generates a DOCX buffer for the given PCCP version and its components.
 */
export async function exportPccpToDocx(
  version: PccpVersion,
  components: PccpComponentRecord[],
  options: PccpDocxExportOptions,
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`${version.deviceName} — Predetermined Change Control Plan`)],
    }),
  );

  // Metadata header
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Version: ', bold: true }),
        new TextRun(version.version),
        new TextRun({ text: '   |   Manufacturer: ', bold: true }),
        new TextRun(version.manufacturer),
        new TextRun({ text: '   |   Status: ', bold: true }),
        new TextRun(version.status),
      ],
    }),
  );
  if (version.indication) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Indication: ', bold: true }),
          new TextRun(version.indication),
        ],
      }),
    );
  }
  if (options.includeDraftWatermark) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '— DRAFT —', bold: true, color: 'C0C0C0', size: 28 })],
      }),
    );
  }

  // Component sections
  for (const comp of components) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(COMPONENT_LABELS[comp.componentType])],
      }),
    );
    const entries = flattenContent(comp.contentJsonb);
    if (entries.length === 0) {
      children.push(new Paragraph({ children: [new TextRun('(no content)')] }));
      continue;
    }
    for (const e of entries) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${e.key}: `, bold: true }), new TextRun(e.value)],
        }),
      );
    }
  }

  const doc = new Document({
    creator: 'Regula — Medical Device RA Assistant',
    title: `PCCP — ${version.deviceName} v${version.version}`,
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

export function getDocxFilename(version: PccpVersion): string {
  const safe = version.deviceName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `PCCP_${safe}_v${version.version}.docx`;
}
