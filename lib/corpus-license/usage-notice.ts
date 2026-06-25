// @MX:ANCHOR [AUTO] generateUsageNotice — answer/export per-source usage restriction text.
// @MX:REASON fan_in >= 3: lib/ai/consult.ts (answer path), export-hub route, and
//   integration tests all call this. REQ-007/011 compliance gate — every answer
//   or export MUST include the per-source usage-restriction notice. A dead-code
//   definition without a call site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-007, REQ-CORPUSLIC-011)
import { db } from '@/lib/db/client';
import { sourceLicense } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { SourceUsageNotice } from './types';

const NOTICE_TEXT: Record<string, string> = {
  standard_paid:
    'ISO/IEC/ASTM paid standard — full text under subscription license; redistribution prohibited.',
  journal:
    'Published under journal copyright; abstract-only use permitted without full-text entitlement.',
  internal_sop:
    'Company-internal SOP — confidential, trade-secret protected; external distribution forbidden.',
  open: 'Public-domain regulatory text; standard attribution required.',
};

/**
 * REQ-007/011 — produce per-source usage-restriction notices for the given
 * sourceIds. Returns one entry per source that has a license row.
 *
 * Wired at:
 *   - lib/ai/consult.ts (consult answer assembly, post-retrieval)
 *   - app/api/ra/export/route.ts (export package assembly)
 */
export async function generateUsageNotice(
  sourceIds: string[],
  orgId: string,
): Promise<SourceUsageNotice[]> {
  if (sourceIds.length === 0) return [];

  const rows = await db
    .select({
      sourceId: sourceLicense.sourceId,
      licenseType: sourceLicense.licenseType,
      abstractOnly: sourceLicense.abstractOnly,
    })
    .from(sourceLicense)
    .where(and(eq(sourceLicense.orgId, orgId), inArray(sourceLicense.sourceId, sourceIds)));

  return rows.map((r) => {
    const base = NOTICE_TEXT[r.licenseType] ?? 'Usage restricted per source license terms.';
    const suffix = r.abstractOnly ? ' Abstract-only policy applies.' : '';
    return { sourceId: r.sourceId, notice: `${base}${suffix}` };
  });
}
