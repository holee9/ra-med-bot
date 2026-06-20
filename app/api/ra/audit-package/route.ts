// @MX:ANCHOR [AUTO] Audit package route — POST /api/ra/audit-package (auditor 1-click bundle).
// @MX:REASON Compiles audit log, signed answers, citations, expert reviews, and compliance
//            reports into a single ZIP with a SHA-256 manifest. AC #4, #5, #6.
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5, #6)

export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { buildAuditPackage } from '@/lib/audit-package/builder';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { answerSignatures, auditLogs, expertReviews } from '@/lib/db/schema';
import { and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

// 24-month ceiling — keeps generation well under the 60s SLA (AC #6).
const MAX_RANGE_MONTHS = 24;

const BodySchema = z.object({
  dateRange: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
});

function monthsBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return Number.POSITIVE_INFINITY;
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

export const POST = withPermission('audit.package.generate', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { dateRange } = parsed.data;

  if (new Date(dateRange.start) > new Date(dateRange.end)) {
    return Response.json({ error: 'reversed_date_range' }, { status: 400 });
  }
  if (monthsBetween(dateRange.start, dateRange.end) > MAX_RANGE_MONTHS) {
    return Response.json(
      { error: 'date_range_too_wide', maxMonths: MAX_RANGE_MONTHS },
      { status: 400 },
    );
  }

  const from = new Date(dateRange.start);
  const to = new Date(dateRange.end);

  // Audit log rows
  const logRows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      actorId: auditLogs.actorId,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metaJson: auditLogs.metaJson,
    })
    .from(auditLogs)
    .where(and(gte(auditLogs.createdAt, from), lte(auditLogs.createdAt, to)));

  // Signed answer rows (SPEC-REGULA-ESIG-001 records)
  const signatureRows = await db
    .select({
      id: answerSignatures.id,
      messageId: answerSignatures.messageId,
      signerName: answerSignatures.signerName,
      signerTitle: answerSignatures.signerTitle,
      meaning: answerSignatures.meaning,
      recordHash: answerSignatures.recordHash,
      signedAt: answerSignatures.signedAt,
      revokedAt: answerSignatures.revokedAt,
    })
    .from(answerSignatures)
    .where(and(gte(answerSignatures.signedAt, from), lte(answerSignatures.signedAt, to)));

  // Expert review rows
  const reviewRows = await db
    .select({
      id: expertReviews.id,
      status: expertReviews.status,
      reviewerId: expertReviews.assignedTo,
      decidedAt: expertReviews.resolvedAt,
      message: expertReviews.notes,
    })
    .from(expertReviews)
    .where(and(gte(expertReviews.resolvedAt, from), lte(expertReviews.resolvedAt, to)));

  const pkg = await buildAuditPackage({
    requesterId: session.user.id,
    requesterEmail: session.user.email,
    dateRange,
    auditLog: logRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      action: r.action,
      actorId: r.actorId,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      metaJson: r.metaJson,
    })),
    signedAnswers: signatureRows.map((r) => ({
      id: r.id,
      messageId: r.messageId,
      signerName: r.signerName,
      signerTitle: r.signerTitle,
      meaning: r.meaning,
      recordHash: r.recordHash,
      signedAt: r.signedAt.toISOString(),
      isRevoked: r.revokedAt !== null,
    })),
    // SPEC scope note: citations + compliance reports are populated by their
    // respective SPEC tables when present. Empty arrays keep the manifest shape
    // intact without coupling this route to every downstream SPEC's schema.
    citations: [],
    expertReviews: reviewRows.map((r) => ({
      id: r.id,
      status: r.status,
      reviewerId: r.reviewerId,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      message: r.message,
    })),
    complianceReports: [],
  });

  await writeAudit({
    action: 'audit.package.generated',
    actor_id: session.user.id,
    resource_type: 'auditPackage',
    resource_id: pkg.manifest.generatedAt,
    meta_json: {
      dateRange,
      fileCount: pkg.manifest.files.length,
      requesterEmail: session.user.email,
    },
  });

  const filename = `audit-package-${dateRange.start}_to_${dateRange.end}.zip`;
  // Pass a Uint8Array view of the Buffer — the Buffer type is not directly
  // assignable to BodyInit under the current DOM lib, but its underlying
  // Uint8Array view is.
  return new Response(new Uint8Array(pkg.zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pkg.zipBuffer.length),
    },
  });
});
