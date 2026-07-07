// @MX:NOTE [AUTO] POST /api/labeling/documents — create a structured labeling document.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, REQ-010, REQ-012, AC-01)

// @MX:LEGACY archived from app

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { labelingDocuments, labelingSections } from '@/lib/db/schema';
import { buildInitialSections } from '@/lib/labeling/section-builder';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { z } from 'zod';

const CreateLabelingDocumentSchema = z.object({
  projectId: z.string().uuid(),
  productName: z.string().min(1).max(500),
  jurisdiction: z.enum(['FDA', 'EU_MDR', 'MFDS', 'NMPA', 'PMDA']),
  locale: z.string().min(2).max(16).optional(),
});

export const POST = withPermission('label.create', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = CreateLabelingDocumentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // C-1 IDOR defense: prove the project belongs to the caller's org BEFORE any
  // write (mirrors change-control run route + assertPmsProjectAccess pattern).
  const projectAccessDenied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (projectAccessDenied) {
    return Response.json({ error: 'Project access denied' }, { status: 403 });
  }

  const locale = body.locale ?? 'en';

  // REQ-001: insert document + 5 initial empty sections in a single tx so a
  // mid-write failure rolls back both (21 CFR Part 11 atomicity).
  try {
    const result = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(labelingDocuments)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          productName: body.productName,
          jurisdiction: body.jurisdiction,
          status: 'draft',
          createdBy: session.user.id,
        })
        .returning({ id: labelingDocuments.id });

      const documentId = doc?.id;
      if (!documentId) throw new Error('failed_to_insert_labeling_document');

      const sections = buildInitialSections(locale);
      for (const s of sections) {
        await tx.insert(labelingSections).values({
          orgId: organizationId,
          documentId,
          sectionType: s.sectionType,
          content: s.content,
          locale: s.locale,
        });
      }

      // REQ-010: 21 CFR Part 11 audit (label.document_created).
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'label.document_created',
          resource_type: 'labelingDocument',
          resource_id: documentId,
          meta_json: {
            projectId: body.projectId,
            productName: body.productName,
            jurisdiction: body.jurisdiction,
            locale,
          },
        },
        tx,
      );

      return { documentId };
    });

    return Response.json({ documentId: result.documentId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    // Failure-path audit (atomic; mirrors CC H-3 pattern).
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'label.document_created',
            resource_type: 'labelingDocument',
            resource_id: 'unknown',
            meta_json: { error: message, projectId: body.projectId, failed: true },
          },
          tx,
        );
      });
    } catch {
      // Audit write failed — surface 500 (compliance material not recorded).
      return Response.json({ error: 'labeling_create_audit_lost' }, { status: 500 });
    }
    return Response.json({ error: 'labeling_create_failed' }, { status: 502 });
  }
});
