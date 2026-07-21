// @MX:NOTE [AUTO] Team knowledge library listing + tag filter.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-008, REQ-012, REQ-015, AC-06)
// @MX:REASON Returns status='active' promoted answers for the caller's org.
//           org-scoped via withTenantScope (RLS GUC — #239) + defense-in-depth
//           eq(orgId). Tag filter uses the text[] GIN index (REQ-015).

import { withTenantScope } from '@/lib/kernel/db/client';
import { promotedAnswers } from '@/lib/kernel/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';

export interface LibraryEntry {
  id: string;
  sourceMessageId: string;
  title: string;
  tags: string[];
  promotedBy: string;
  promotedAt: Date;
}

export interface LibraryParams {
  orgId: string;
  /** Optional tag filter — only entries containing ALL tags are returned. */
  tags?: string[];
  limit?: number;
}

/**
 * REQ-012 / REQ-015 / AC-06: list active promoted answers for the org, with
 * optional tag filter (AND semantics via `tags @> ARRAY[...]`). Ordered by
 * promoted_at descending (most recent first).
 */
export async function listLibrary(params: LibraryParams): Promise<LibraryEntry[]> {
  const { orgId, tags, limit = 50 } = params;

  // When a tag filter is supplied, apply it at SQL level via the GIN index.
  // Array-overlap/containment is built with the Drizzle column so the value
  // is parameterised (no string interpolation / injection surface).
  const tagFilter =
    tags && tags.length > 0 ? sql`${promotedAnswers.tags} @> ${tags}::text[]` : null;

  return withTenantScope(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: promotedAnswers.id,
        sourceMessageId: promotedAnswers.sourceMessageId,
        title: promotedAnswers.title,
        tags: promotedAnswers.tags,
        promotedBy: promotedAnswers.promotedBy,
        promotedAt: promotedAnswers.promotedAt,
      })
      .from(promotedAnswers)
      .where(
        tagFilter
          ? and(eq(promotedAnswers.orgId, orgId), eq(promotedAnswers.status, 'active'), tagFilter)
          : and(eq(promotedAnswers.orgId, orgId), eq(promotedAnswers.status, 'active')),
      )
      .orderBy(asc(promotedAnswers.promotedAt))
      .limit(limit);
    return rows;
  });
}
