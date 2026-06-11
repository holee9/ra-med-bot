// @MX:NOTE Minimal server-side PDF exporter for the assembled CER document.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-028, REQ-CER-029)
//
// Phase 1 implementation: emits a self-contained, valid single-page-stream PDF
// built from raw PDF primitives — no React/Puppeteer dependency. This keeps the
// exportToPDF(cer) signature stable for the download API route while full
// rich-layout rendering (Puppeteer/Playwright) is deferred to Phase 2.

import type { CerDocument } from '../cer-assembler';
import { formatVancouver } from '../citation-formatter';

const PAGE_WIDTH = 612; // US Letter, 72 dpi
const PAGE_HEIGHT = 792;
const MARGIN_X = 56;
const TOP_Y = 740;
const LINE_HEIGHT = 14;
const BODY_FONT_SIZE = 10;
const HEADING_FONT_SIZE = 13;
const MAX_LINE_CHARS = 95; // conservative wrap width for Helvetica 10pt

/**
 * Render a CerDocument to a PDF Buffer. The layout is intentionally simple:
 * a title, header metadata, each stage as a heading + wrapped body text, an
 * optional equivalence section, and a Vancouver-formatted references list.
 * Content that overflows a single page is truncated with a continuation note
 * (full multi-page pagination lands in Phase 2).
 */
export async function exportToPDF(cer: CerDocument): Promise<Buffer> {
  const lines = buildLines(cer);
  const pdf = renderSinglePagePdf(lines);
  return Buffer.from(pdf, 'binary');
}

interface PdfLine {
  text: string;
  heading: boolean;
}

function buildLines(cer: CerDocument): PdfLine[] {
  const lines: PdfLine[] = [];

  lines.push({ text: `Clinical Evaluation Report - ${cer.deviceName}`, heading: true });
  lines.push({ text: `Manufacturer: ${cer.manufacturer}`, heading: false });
  lines.push({ text: `Date: ${cer.createdAt.toISOString().slice(0, 10)}`, heading: false });
  lines.push({ text: '', heading: false });

  for (const stage of cer.stages) {
    lines.push({ text: `${stage.stageId}. ${stage.title}`, heading: true });
    const content = stage.content.trim() || '(Section not yet completed.)';
    for (const wrapped of wrapText(content)) {
      lines.push({ text: wrapped, heading: false });
    }
    lines.push({ text: '', heading: false });
  }

  if (cer.equivalenceAssessment) {
    const eq = cer.equivalenceAssessment;
    lines.push({ text: 'Equivalence Assessment (Article 61(4))', heading: true });
    lines.push({
      text: `Subject: ${eq.deviceName} | Equivalent: ${eq.equivalentDevice}`,
      heading: false,
    });
    for (const wrapped of wrapText(eq.summaryText)) {
      lines.push({ text: wrapped, heading: false });
    }
    for (const dim of eq.dimensions) {
      lines.push({
        text: `- ${dim.dimension}: ${dim.satisfied ? 'satisfied' : 'not satisfied'}`,
        heading: false,
      });
    }
    lines.push({ text: '', heading: false });
  }

  lines.push({ text: 'Literature References', heading: true });
  if (cer.literatureReferences.length === 0) {
    lines.push({ text: 'No literature references included.', heading: false });
  } else {
    cer.literatureReferences.forEach((article, index) => {
      const citation = `${index + 1}. ${formatVancouver(article)}`;
      for (const wrapped of wrapText(citation)) {
        lines.push({ text: wrapped, heading: false });
      }
    });
  }

  return lines;
}

/** Greedy word-wrap to a fixed character width. */
function wrapText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= MAX_LINE_CHARS) {
      current += ` ${word}`;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current) {
    out.push(current);
  }
  return out.length > 0 ? out : [''];
}

/**
 * Build a minimal, valid PDF with a single content stream. Lines are drawn
 * top-to-bottom; once the bottom margin is reached, remaining lines are
 * dropped and a truncation note is appended.
 */
function renderSinglePagePdf(lines: PdfLine[]): string {
  const maxLines = Math.floor((TOP_Y - 56) / LINE_HEIGHT);
  const visible = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  const ops: string[] = [
    'BT',
    `/F1 ${BODY_FONT_SIZE} Tf`,
    `${MARGIN_X} ${TOP_Y} Td`,
    `${LINE_HEIGHT} TL`,
  ];

  visible.forEach((line, index) => {
    const size = line.heading ? HEADING_FONT_SIZE : BODY_FONT_SIZE;
    ops.push(`/F1 ${size} Tf`);
    if (index > 0) {
      ops.push('T*');
    }
    ops.push(`(${escapePdfText(line.text)}) Tj`);
  });

  if (truncated) {
    ops.push('T*');
    ops.push('(... content truncated; full multi-page export pending.) Tj');
  }

  ops.push('ET');
  const content = ops.join('\n');

  return assemblePdf(content);
}

/** Escape characters that are syntactically meaningful inside a PDF string. */
function escapePdfText(text: string): string {
  // Drop non-ASCII to stay within the base Helvetica encoding, then escape
  // the PDF string delimiters.
  return text
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Assemble the object table, xref, and trailer around a content stream. */
function assemblePdf(content: string): string {
  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
  );
  objects.push(
    `<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream`,
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [];
  let cursor = header.length;

  objects.forEach((obj, index) => {
    offsets.push(cursor);
    const objStr = `${index + 1} 0 obj\n${obj}\nendobj\n`;
    body += objStr;
    cursor += Buffer.byteLength(objStr, 'binary');
  });

  const xrefStart = header.length + Buffer.byteLength(body, 'binary');
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return header + body + xref + trailer;
}
