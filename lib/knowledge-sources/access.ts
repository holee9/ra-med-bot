// @MX:ANCHOR [AUTO] IDOR org guard for knowledge sources — prevents cross-org access.
// @MX:REASON fan_in >= 3: All API routes (GET/POST/DELETE/[id]/sync) delegate here for org isolation.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { db } from '@/lib/kernel/db/client';
import { knowledgeSources } from '@/lib/kernel/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Assert that a knowledge source belongs to the specified organization.
 * Throws a 404-compatible error if not found or org mismatch.
 *
 * @param id - Knowledge source ID
 * @param orgId - Organization ID to verify
 * @throws Error with 'not_found' or 'org_mismatch' code
 */
export async function assertKnowledgeSourceInOrg(id: string, orgId: string): Promise<void> {
  const source = await db
    .select({ organizationId: knowledgeSources.organizationId })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, id))
    .limit(1);

  if (source.length === 0) {
    throw new Error('knowledge_source_not_found');
  }

  if (source[0]?.organizationId !== orgId) {
    throw new Error('org_mismatch');
  }
}
