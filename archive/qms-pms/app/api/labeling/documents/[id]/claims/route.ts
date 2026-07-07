// @MX:NOTE [AUTO] POST /api/labeling/documents/[id]/claims — create + validate a claim.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-003, REQ-004, REQ-005, REQ-010, AC-02, AC-04)

// @MX:LEGACY archived from app

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import {
  labelingClaimCitations,
  labelingClaims,
  labelingDocuments,
  labelingSections,
} from '@/lib/db/schema';
import { validateClaimCitations } from '@/lib/labeling/claim-validator';
import { detectComparativeClaim } from '@/lib/labeling/comparable-detector';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const CitationSchema = z.object({
  source: z.string().min(1).max(256),
  section: z.string().max(256).optional(),
  excerpt: z.string().min(1).max(8000),
});

const CreateClaimSchema = z.object({
  sectionId: z.string().uuid(),
  claimText: z.string().min(1).max(8000),
  citations: z.array(CitationSchema).max(20).default([]),
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

  const parsed = CreateClaimSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // IDOR defense: document + section must belong to the caller's org.
  const doc = await db
    .select({ id: labelingDocuments.id })
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, organizationId)))
    .limit(1);
  if (doc.length === 0) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  const section = await db
    .select({ id: labelingSections.id })
    .from(labelingSections)
    .where(
      and(
        eq(labelingSections.id, body.sectionId),
        eq(labelingSections.documentId, documentId),
        eq(labelingSections.orgId, organizationId),
      ),
    )
    .limit(1);
  if (section.length === 0) {
    return Response.json({ error: 'Section not found' }, { status: 404 });
  }

  // REQ-003/004: validate citations (forces expert_review when ungrounded).
  const validation = validateClaimCitations(body.citations);

  // REQ-005: detect comparative/superiority language.
  const comparable = detectComparativeClaim(body.claimText);

  // Resolve final claim_type: unsupported (no citations) > superiority > comparative > supported.
  let claimType = comparable.claimType;
  if (!validation.hasGroundedCitation) {
    claimType = 'unsupported';
  }

  // H-2 prompt-injection note: claimText is persisted as-is and never flows
  // into an LLM in this route. When translation-diff later sends it to an
  // LLM, it MUST be wrapped in <claim_text> UNTRUSTED DATA tags (CC pattern).
  try {
    const result = await db.transaction(async (tx) => {
      const [claim] = await tx
        .insert(labelingClaims)
        .values({
          orgId: organizationId,
          sectionId: body.sectionId,
          claimText: body.claimText,
          claimType,
          expertReviewRequired: validation.expertReviewRequired,
          matchedKeywords:
            comparable.matchedKeywords.length > 0 ? comparable.matchedKeywords : null,
          createdBy: session.user.id,
        })
        .returning({ id: labelingClaims.id });

      const claimId = claim?.id;
      if (!claimId) throw new Error('failed_to_insert_labeling_claim');

      // REQ-003: persist grounded citations (excerpt NOT NULL DB defense).
      for (const c of validation.groundedCitations) {
        await tx.insert(labelingClaimCitations).values({
          orgId: organizationId,
          claimId,
          excerpt: c.excerpt,
          sourceLabel: c.source,
          citationId: c.section,
        });
      }

      // REQ-010: audit. Use the citation-rejected action when expert review
      // was forced; otherwise claim_validated (CC H-4 distinction pattern).
      const auditAction = validation.expertReviewRequired
        ? 'label.claim_citation_rejected'
        : 'label.claim_validated';

      await writeAudit(
        {
          actor_id: session.user.id,
          action: auditAction,
          resource_type: 'labelingClaim',
          resource_id: claimId,
          meta_json: {
            documentId,
            sectionId: body.sectionId,
            claimType,
            expertReviewRequired: validation.expertReviewRequired,
            rejectedCitationCount: validation.rejectedCitationCount,
            groundedCitationCount: validation.groundedCitations.length,
            isComparative: comparable.isComparative,
            isSuperiority: comparable.isSuperiority,
            matchedKeywords: comparable.matchedKeywords,
          },
        },
        tx,
      );

      return { claimId };
    });

    return Response.json(
      {
        claimId: result.claimId,
        claimType,
        expertReviewRequired: validation.expertReviewRequired,
        groundedCitationCount: validation.groundedCitations.length,
        rejectedCitationCount: validation.rejectedCitationCount,
        isComparative: comparable.isComparative,
        isSuperiority: comparable.isSuperiority,
        matchedKeywords: comparable.matchedKeywords,
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
            action: 'label.claim_validated',
            resource_type: 'labelingClaim',
            resource_id: 'unknown',
            meta_json: { error: message, documentId, failed: true },
          },
          tx,
        );
      });
    } catch {
      return Response.json({ error: 'labeling_claim_audit_lost' }, { status: 500 });
    }
    return Response.json({ error: 'labeling_claim_failed' }, { status: 502 });
  }
});
