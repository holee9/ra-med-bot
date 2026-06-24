// @MX:NOTE [AUTO] POST /api/labeling/documents/[id]/approve — RA-lead approval gate.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-006, REQ-009, REQ-010, REQ-012, AC-03, AC-07, AC-08)
//
// RBAC: withPermission('label.approve') restricts to ra-lead (REQ-012).
// Preconditions (REQ-006): zero unsupported claims, checklist 100% coverage,
// all translations approved. eSubmit forward hook fires on success (REQ-009).

import { internalDocsRetrieve } from '@/lib/ai/retrievers/internal-docs';
import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import {
  labelingClaims,
  labelingDocuments,
  labelingSections,
  labelingTranslations,
} from '@/lib/db/schema';
import { linkLabelingChangeToChangeControl } from '@/lib/labeling/change-control-link';
import { forwardLabelingToESubmit } from '@/lib/labeling/esubmit-bridge';
import { evaluateChecklist } from '@/lib/labeling/jurisdiction-checklist';
import { and, eq, sql } from 'drizzle-orm';

export const POST = withPermission('label.approve', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const documentId = (ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {}))
    .id;
  if (typeof documentId !== 'string') {
    return Response.json({ error: 'Invalid document id' }, { status: 400 });
  }

  // IDOR defense: document must belong to caller's org.
  const docs = await db
    .select({
      id: labelingDocuments.id,
      jurisdiction: labelingDocuments.jurisdiction,
      projectId: labelingDocuments.projectId,
      status: labelingDocuments.status,
    })
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, organizationId)))
    .limit(1);
  if (docs.length === 0 || !docs[0]) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }
  const doc = docs[0];

  if (doc.status === 'approved') {
    return Response.json({ error: 'Document already approved' }, { status: 409 });
  }

  // REQ-006 precondition 1: zero unsupported / expert-review-required claims.
  const blockingClaims = await db
    .select({ id: labelingClaims.id })
    .from(labelingClaims)
    .innerJoin(labelingSections, eq(labelingClaims.sectionId, labelingSections.id))
    .innerJoin(labelingDocuments, eq(labelingSections.documentId, labelingDocuments.id))
    .where(
      and(
        eq(labelingDocuments.id, documentId),
        eq(labelingDocuments.orgId, organizationId),
        sql`${labelingClaims.claimType} = 'unsupported' OR ${labelingClaims.expertReviewRequired} = true`,
      ),
    );
  if (blockingClaims.length > 0) {
    return Response.json(
      {
        error: 'Cannot approve: unsupported or pending-review claims exist',
        blockingClaimCount: blockingClaims.length,
      },
      { status: 409 },
    );
  }

  // REQ-002/011 precondition 2: checklist 100% coverage.
  const sections = await db
    .select({
      sectionType: labelingSections.sectionType,
      content: labelingSections.content,
    })
    .from(labelingSections)
    .where(
      and(eq(labelingSections.documentId, documentId), eq(labelingSections.orgId, organizationId)),
    );
  const checklist = evaluateChecklist(
    sections.map((s) => ({
      sectionType: s.sectionType as Parameters<typeof evaluateChecklist>[0][number]['sectionType'],
      content: s.content,
    })),
    doc.jurisdiction as Parameters<typeof evaluateChecklist>[1],
  );
  if (checklist.coveragePercent < 100) {
    return Response.json(
      {
        error: 'Cannot approve: checklist coverage incomplete',
        coveragePercent: checklist.coveragePercent,
        missingCount: checklist.missing.length,
      },
      { status: 409 },
    );
  }

  // REQ-007 precondition 3: all translations approved (no pending major_diff).
  const pendingTranslations = await db
    .select({ id: labelingTranslations.id })
    .from(labelingTranslations)
    .innerJoin(labelingSections, eq(labelingTranslations.sectionId, labelingSections.id))
    .innerJoin(labelingDocuments, eq(labelingSections.documentId, labelingDocuments.id))
    .where(
      and(
        eq(labelingDocuments.id, documentId),
        eq(labelingDocuments.orgId, organizationId),
        eq(labelingTranslations.approvalStatus, 'pending'),
      ),
    );
  if (pendingTranslations.length > 0) {
    return Response.json(
      {
        error: 'Cannot approve: pending translation approvals exist',
        count: pendingTranslations.length,
      },
      { status: 409 },
    );
  }

  // All preconditions satisfied — approve.
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(labelingDocuments)
        .set({
          status: 'approved',
          approvedBy: session.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(labelingDocuments.id, documentId));

      // REQ-010: audit the approval (21 CFR Part 11).
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'label.approved',
          resource_type: 'labelingDocument',
          resource_id: documentId,
          meta_json: {
            projectId: doc.projectId,
            jurisdiction: doc.jurisdiction,
            checklistCoverage: checklist.coveragePercent,
          },
        },
        tx,
      );
    });

    // REQ-009: forward to eSubmit (stub — #65 not yet implemented).
    const esubmitResult = await forwardLabelingToESubmit({
      documentId,
      projectId: doc.projectId,
      orgId: organizationId,
    });

    // REQ-008 / AC-06: link the labeling change to #54 Change Control. Runs
    // OUTSIDE the approval transaction (which already committed) so the approval's
    // 21 CFR Part 11 audit integrity is never compromised by the linkage's
    // separate change_assessment write. Best-effort: failure is logged and surfaced
    // via meta, but does NOT block the approval (linkage is an ancillary action,
    // not a precondition). Mirrors the createHybridRaFetch pattern from
    // /api/change-control/run/route.ts (H-1) — offline dev falls back to the
    // engine's stubVerdict via fetchFn=undefined.
    let changeControlLinked = false;
    let changeControlError: string | undefined;
    try {
      let fetchFn: Parameters<typeof linkLabelingChangeToChangeControl>[1]['fetchFn'] | undefined;
      try {
        const hybridFetch = createHybridRaFetch();
        fetchFn = async (endpoint, init) => {
          const res = await hybridFetch(endpoint, init);
          return { json: async () => res };
        };
      } catch {
        // Hybrid-RA not configured (dev/test) — engine uses stubVerdict.
        fetchFn = undefined;
      }
      await linkLabelingChangeToChangeControl(
        {
          documentId,
          projectId: doc.projectId,
          changeDescription: `Labeling document approved (${doc.jurisdiction}).`,
          targetMarkets: [doc.jurisdiction],
        },
        {
          orgId: organizationId,
          userId: session.user.id,
          retrieveFn: internalDocsRetrieve,
          fetchFn,
        },
      );
      changeControlLinked = true;
    } catch (err) {
      // Ancillary failure — approval already committed. Do not block the response.
      changeControlError = err instanceof Error ? err.message : 'unknown_error';
    }

    return Response.json(
      {
        documentId,
        status: 'approved',
        esubmitForwarded: esubmitResult.forwarded,
        esubmitDetail: esubmitResult.detail,
        changeControlLinked,
        ...(changeControlError ? { changeControlError } : {}),
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'label.approved',
            resource_type: 'labelingDocument',
            resource_id: documentId,
            meta_json: { error: message, failed: true },
          },
          tx,
        );
      });
    } catch {
      return Response.json({ error: 'labeling_approve_audit_lost' }, { status: 500 });
    }
    return Response.json({ error: 'labeling_approve_failed' }, { status: 502 });
  }
});
