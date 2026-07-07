// @MX:NOTE [AUTO] POST /api/labeling/documents/[id]/translations — register + diff a translation.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-007, REQ-010, AC-05)

// @MX:LEGACY archived from app

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { labelingDocuments, labelingSections, labelingTranslations } from '@/lib/db/schema';
import { detectSemanticDiff } from '@/lib/labeling/translation-diff';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const CreateTranslationSchema = z.object({
  sectionId: z.string().uuid(),
  sourceLocale: z.string().min(2).max(16),
  targetLocale: z.string().min(2).max(16),
  targetText: z.string().min(1).max(20000),
});

export const POST = withPermission('label.create', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const documentId = (ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {}))
    .id;
  if (typeof documentId !== 'string') {
    return Response.json({ error: 'Invalid document id' }, { status: 400 });
  }

  const parsed = CreateTranslationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // IDOR defense: document + section must belong to caller's org.
  const doc = await db
    .select({ id: labelingDocuments.id })
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, organizationId)))
    .limit(1);
  if (doc.length === 0) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  const section = await db
    .select({ id: labelingSections.id, content: labelingSections.content })
    .from(labelingSections)
    .where(
      and(
        eq(labelingSections.id, body.sectionId),
        eq(labelingSections.documentId, documentId),
        eq(labelingSections.orgId, organizationId),
      ),
    )
    .limit(1);
  if (section.length === 0 || !section[0]) {
    return Response.json({ error: 'Section not found' }, { status: 404 });
  }

  const sourceText = section[0].content;

  // REQ-007: detect semantic diff (MVP heuristic). major_diff forces approval.
  const diff = detectSemanticDiff(
    sourceText,
    body.sourceLocale,
    body.targetText,
    body.targetLocale,
  );

  try {
    const result = await db.transaction(async (tx) => {
      const [translation] = await tx
        .insert(labelingTranslations)
        .values({
          orgId: organizationId,
          sectionId: body.sectionId,
          sourceLocale: body.sourceLocale,
          targetLocale: body.targetLocale,
          sourceTextSnapshot: sourceText,
          targetText: body.targetText,
          semanticDiffStatus: diff.status,
          diffDetails: diff.details.length > 0 ? diff.details : null,
          // REQ-007: major_diff/review_required → approval_status stays 'pending'.
          approvalStatus:
            diff.status === 'match' || diff.status === 'minor_diff' ? 'approved' : 'pending',
          // Auto-approve match/minor_diff; major_diff forces RA re-approval gate.
          approvedBy:
            diff.status === 'match' || diff.status === 'minor_diff' ? session.user.id : null,
          approvedAt: diff.status === 'match' || diff.status === 'minor_diff' ? new Date() : null,
          createdBy: session.user.id,
        })
        .returning({ id: labelingTranslations.id });

      const translationId = translation?.id;
      if (!translationId) throw new Error('failed_to_insert_labeling_translation');

      // REQ-010/007: audit semantic diff detection when major_diff/review_required.
      if (diff.status === 'major_diff' || diff.status === 'review_required') {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'label.translation_diff_detected',
            resource_type: 'labelingTranslation',
            resource_id: translationId,
            meta_json: {
              documentId,
              sectionId: body.sectionId,
              sourceLocale: body.sourceLocale,
              targetLocale: body.targetLocale,
              diffStatus: diff.status,
              detailCount: diff.details.length,
            },
          },
          tx,
        );
      }

      return { translationId };
    });

    return Response.json(
      {
        translationId: result.translationId,
        diffStatus: diff.status,
        details: diff.details,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'label.translation_diff_detected',
            resource_type: 'labelingTranslation',
            resource_id: 'unknown',
            meta_json: { error: message, documentId, failed: true },
          },
          tx,
        );
      });
    } catch {
      return Response.json({ error: 'labeling_translation_audit_lost' }, { status: 500 });
    }
    return Response.json({ error: 'labeling_translation_failed' }, { status: 502 });
  }
});
