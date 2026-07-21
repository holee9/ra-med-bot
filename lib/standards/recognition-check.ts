// @MX:NOTE [AUTO] FDA recognition real-time check with graceful fallback.
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-015/016, AC-06)
//
// When FDA_RECOGNIZED_STANDARDS_API_URL is set, queries the FDA endpoint for
// the current recognition status. When unset, falls back to the local seed /
// catalog row and returns degraded=true so the UI surfaces the limitation
// (Charter [지양-3] external-dependency isolation).
//
// AC-06: a withdrawn standard yields tier='warn' plus an alternative-standard
// suggestion sourced from the catalog's scope_keywords overlap.

import { withTenantScope } from '@/lib/kernel/db/client';
import { standardsOrgCatalog as standardsCatalog } from '@/lib/kernel/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export type RecognitionStatus = 'recognized' | 'not_recognized' | 'withdrawn' | 'unknown';

export interface RecognitionResult {
  standardId: string;
  status: RecognitionStatus;
  /** True when the live FDA API was NOT called (env unset or fetch failed). */
  degraded: boolean;
  /** Present only when status='withdrawn' — alternative standard suggestion. */
  alternativeStandardId?: string | null;
  alternativeStandardNumber?: string | null;
  /** Human-readable explanation for audit / UI display. */
  note: string;
}

/**
 * Check FDA recognition status for a standard.
 *
 * @MX:TODO #62-B — Full FDA Recognized Consensus Standards DB (6000+ rows)
 *   integration. Today we hit the configured endpoint if present and fall back
 *   to the catalog row otherwise. Live FDA list sync is deferred to #62-B.
 */
export async function checkRecognition(
  standardId: string,
  orgId: string,
): Promise<RecognitionResult> {
  return withTenantScope(orgId, async (tx) => {
    // Fetch the local catalog row first — needed for both fallback and alt-search.
    const [row] = await tx
      .select({
        id: standardsCatalog.id,
        standardNumber: standardsCatalog.standardNumber,
        recognitionStatus: standardsCatalog.recognitionStatus,
        scopeKeywords: standardsCatalog.scopeKeywords,
      })
      .from(standardsCatalog)
      .where(and(eq(standardsCatalog.id, standardId), eq(standardsCatalog.orgId, orgId)))
      .limit(1);

    if (!row) {
      return {
        standardId,
        status: 'unknown',
        degraded: true,
        note: 'Standard not found in org catalog.',
      };
    }

    const apiUrl = process.env.FDA_RECOGNIZED_STANDARDS_API_URL;

    // Graceful degradation: no env → catalog fallback (Charter [지양-3]).
    if (!apiUrl) {
      return {
        standardId,
        status: row.recognitionStatus,
        degraded: true,
        note: 'FDA_STANDARDS_API_URL not configured; recognition from local catalog (degraded).',
      };
    }

    // Live FDA check — env is set. Network failure falls back to catalog + degraded.
    try {
      const url = `${apiUrl}?standard=${encodeURIComponent(row.standardNumber)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        // Tight timeout — recognition is a user-facing lookup, not a background job.
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`FDA API ${res.status}`);
      }
      const data = (await res.json()) as {
        recognition_status?: RecognitionStatus;
        withdrawn?: boolean;
      };
      const status: RecognitionStatus =
        data.recognition_status ?? (data.withdrawn ? 'withdrawn' : 'unknown');

      const result: RecognitionResult = {
        standardId,
        status,
        degraded: false,
        note: `Live FDA API response (${status}).`,
      };

      // AC-06: withdrawn → warn + suggest alternative by scope_keywords overlap.
      if (status === 'withdrawn') {
        // Use raw && array-overlap operator (drizzle has no arrayOverlaps helper).
        const alt = await tx
          .select({
            id: standardsCatalog.id,
            standardNumber: standardsCatalog.standardNumber,
          })
          .from(standardsCatalog)
          .where(
            and(
              eq(standardsCatalog.orgId, orgId),
              eq(standardsCatalog.recognitionStatus, 'recognized'),
              sql`${standardsCatalog.scopeKeywords} && ${sql.raw(`ARRAY[${row.scopeKeywords.map((k) => `'${k.replace(/'/g, "''")}'`).join(',')}]::text[]`)}`,
            ),
          )
          .limit(1);
        const candidate = alt.find((c) => c.id !== standardId);
        result.alternativeStandardId = candidate?.id ?? null;
        result.alternativeStandardNumber = candidate?.standardNumber ?? null;
        if (candidate) {
          result.note += ` Alternative suggested: ${candidate.standardNumber}.`;
        }
      }
      return result;
    } catch {
      // Network/parse failure — fall back to catalog with degraded flag.
      return {
        standardId,
        status: row.recognitionStatus,
        degraded: true,
        note: 'FDA API call failed; recognition from local catalog (degraded).',
      };
    }
  });
}
