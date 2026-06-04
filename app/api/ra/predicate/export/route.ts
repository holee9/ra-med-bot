// @MX:NOTE [AUTO] POST /api/ra/predicate/export — render a saved predicate
//   comparison to a downloadable PDF or DOCX file.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-014, REQ-PRE-015)
//
// REQ-PRE-015: the comparison table is exportable as PDF (510(k) submission)
// and DOCX (editable internal review). REQ-PRE-014: both formats MUST carry the
// substantial-equivalence disclaimer on the first page so the output is never
// mistaken for an automated SE determination.

// REQ-PRE-029: nodejs runtime required — both the department lookup (pg driver)
// and PDF rendering (@react-pdf/renderer) are incompatible with the Workers/edge
// runtime.
export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { canExportComparisons } from '@/lib/auth/predicate-permissions';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users, workflowRuns } from '@/lib/db/schema';
import type { ComparisonDimension, PredicateComparison } from '@/lib/predicate/types';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import {
  AlignmentType,
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { eq } from 'drizzle-orm';
import React from 'react';
import { z } from 'zod';

/**
 * REQ-PRE-014: the exact disclaimer wording. Rendered as the first block of
 * every export so it always appears on the first page.
 */
const DISCLAIMER =
  'This tool assists with predicate identification only. Substantial equivalence ' +
  'determination requires RA professional review and cannot be automated.';

/** Human-readable labels for the five comparison dimensions. */
const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  intended_use: 'Intended Use',
  indications: 'Indications for Use',
  tech_characteristics: 'Technological Characteristics',
  materials: 'Materials',
  performance: 'Performance',
};

const ExportSchema = z.object({
  workflow_run_id: z.string().min(1),
  format: z.enum(['pdf', 'docx']),
});

type SavedComparison = PredicateComparison & {
  selected_predicate_knumbers?: string[];
};

/** Fetch the caller's department; null when unset or the user row is missing. */
async function getDepartment(userId: string): Promise<string | null> {
  const rows = await db
    .select({ department: users.department })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.department ?? null;
}

// allow-hex: react-pdf StyleSheet cannot use CSS variables or Tailwind tokens
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica' },
  disclaimer: {
    backgroundColor: '#FEF2F2', // allow-hex
    color: '#991B1B', // allow-hex
    borderColor: '#991B1B', // allow-hex
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
    fontSize: 9,
  },
  disclaimerHeading: { fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  predicateLine: { marginBottom: 4 },
  cell: { marginBottom: 12, borderBottomWidth: 1, borderColor: '#E5E7EB', paddingBottom: 8 }, // allow-hex
  dimension: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  label: { fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: '#6B7280' }, // allow-hex
});

// @MX:NOTE [AUTO] PDF document tree built with React.createElement (no JSX) so
//   the route stays a .ts file consistent with the sibling Route Handlers.
function buildPdfDocument(comparison: SavedComparison): React.ReactElement {
  const e = React.createElement;
  const kNumbers = comparison.selected_predicate_knumbers ?? [];

  const predicateLines = comparison.selected_predicates.map((p, i) =>
    e(
      Text,
      { key: `pred-${i}`, style: styles.predicateLine },
      `${p.k_number || kNumbers[i] || `Predicate ${i + 1}`}${p.device_name ? ` — ${p.device_name}` : ''}`,
    ),
  );

  const cellViews = comparison.cells.map((cell, i) =>
    e(
      View,
      { key: `cell-${i}`, style: styles.cell, wrap: false },
      e(Text, { style: styles.dimension }, DIMENSION_LABELS[cell.dimension] ?? cell.dimension),
      e(Text, {}, e(Text, { style: styles.label }, 'Subject: '), cell.subject_text),
      ...cell.predicate_texts.map((t, j) =>
        e(Text, { key: `pt-${j}` }, e(Text, { style: styles.label }, `Predicate ${j + 1}: `), t),
      ),
    ),
  );

  return e(
    Document,
    {},
    e(
      Page,
      { size: 'A4', style: styles.page },
      e(
        View,
        { style: styles.disclaimer },
        e(Text, { style: styles.disclaimerHeading }, 'Regulatory Disclaimer'),
        e(Text, {}, DISCLAIMER),
      ),
      e(
        Text,
        { style: styles.title },
        `Predicate Device Comparison — ${comparison.subject_device_name}`,
      ),
      ...predicateLines,
      e(View, { style: { marginTop: 12 } }, ...cellViews),
      e(
        Text,
        { style: styles.footer, fixed: true },
        'Generated by Regula — For RA professional review only',
      ),
    ),
  );
}

/** Render the comparison to a PDF buffer (REQ-PRE-014, REQ-PRE-015). */
async function renderPdf(comparison: SavedComparison): Promise<Buffer> {
  return renderToBuffer(buildPdfDocument(comparison));
}

/** Render the comparison to a DOCX buffer (REQ-PRE-014, REQ-PRE-015). */
async function renderDocx(comparison: SavedComparison): Promise<Buffer> {
  const kNumbers = comparison.selected_predicate_knumbers ?? [];

  const predicateParagraphs = comparison.selected_predicates.map(
    (p, i) =>
      new Paragraph({
        children: [
          new TextRun(
            `${p.k_number || kNumbers[i] || `Predicate ${i + 1}`}${
              p.device_name ? ` — ${p.device_name}` : ''
            }`,
          ),
        ],
      }),
  );

  const comparisonRows = comparison.cells.map(
    (cell) =>
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: DIMENSION_LABELS[cell.dimension] ?? cell.dimension,
                    bold: true,
                  }),
                ],
              }),
            ],
            width: { size: 25, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph(cell.subject_text)],
            width: { size: 37, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: cell.predicate_texts.map((t) => new Paragraph(t)),
            width: { size: 38, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
  );

  const headerRow = new TableRow({
    children: ['Dimension', 'Subject Device', 'Predicate(s)'].map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        }),
    ),
  });

  const doc = new DocxDocument({
    sections: [
      {
        children: [
          // REQ-PRE-014: disclaimer first, before any comparison content.
          new Paragraph({
            children: [new TextRun({ text: 'Regulatory Disclaimer', bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: DISCLAIMER, color: '991B1B' })],
          }),
          new Paragraph({
            text: `Predicate Device Comparison — ${comparison.subject_device_name}`,
            heading: HeadingLevel.HEADING_1,
          }),
          ...predicateParagraphs,
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...comparisonRows],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Generated by Regula — For RA professional review only',
                size: 16,
                color: '6B7280',
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}

// @MX:NOTE [AUTO] POST export — ownership (REQ-PRE-014) verified before render:
//   the run must belong to the caller and be a predicate_comparison.
export const POST = withPermission('workflow.execute', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { workflow_run_id, format } = parsed.data;

  // Department RBAC (REQ-PRE-029): only RA/Dev may export.
  const department = await getDepartment(session.user.id);
  if (!canExportComparisons(department)) {
    return Response.json({ error: 'permission_denied', reason: 'department' }, { status: 403 });
  }

  const [row] = await db
    .select({
      id: workflowRuns.id,
      userId: workflowRuns.userId,
      workflowType: workflowRuns.workflowType,
      resultJson: workflowRuns.resultJson,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflow_run_id))
    .limit(1);

  // Unknown id or a non-predicate workflow type is a 404 (resource not found).
  if (!row || row.workflowType !== 'predicate_comparison' || !row.resultJson) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  // REQ-PRE-014 ownership: a user may export only their OWN comparison.
  if (row.userId !== session.user.id) {
    return Response.json({ error: 'permission_denied', reason: 'ownership' }, { status: 403 });
  }

  const comparison = row.resultJson as SavedComparison;

  const buffer = format === 'pdf' ? await renderPdf(comparison) : await renderDocx(comparison);
  const contentType =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const filename = `predicate-comparison-${workflow_run_id}.${format}`;

  // REQ-PRE-017-style audit: record every export for traceability.
  await writeAudit({
    action: 'predicate_comparison_exported',
    actor_id: session.user.id,
    resource_type: 'predicate_comparison',
    resource_id: workflow_run_id,
    meta_json: { format },
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
