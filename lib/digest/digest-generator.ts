// @MX:ANCHOR: [AUTO] Weekly digest generator — called by API route and Inngest cron stub
// @MX:REASON: Public boundary; Sonnet AI per-update impact summaries + digest compilation (fan_in >= 3)
// @MX:SPEC: SPEC-REGULA-DIGEST-001

import crypto from 'node:crypto';
import { generateText } from 'ai';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { getLlmModel } from '../ai/llm-provider';
import { withTenantScope } from '../db/client';
import { orgUpdateRelevance, regulatoryUpdates, weeklyDigests } from '../db/schema';
import { logger } from '../observability/logger';

export interface DigestUpdate {
  id: string;
  title: string;
  region: string;
  severity: string;
  severity_classification: 'critical' | 'high' | 'medium' | 'low';
  impact_score: number;
  impact_summary: string; // AI-generated 2-3 sentence "so what"
  source_url: string | null;
  published_at: string;
}

export interface DigestPayload {
  week_id: string;
  share_token: string;
  week_start: string;
  week_end: string;
  org_id: string;
  updates: DigestUpdate[];
  update_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

// Current ISO week string: '2026-W23'
export function getWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekBounds(weekId: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000);
  const start = new Date(startOfWeek1.getTime() + (week - 1) * 7 * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000 + 86399999);
  return { start, end };
}

// @MX:NOTE: [AUTO] severity classification maps DB severity field + impactScore to display tier.
// 'warning' = high, 'info' = medium — these are legacy radar severity labels.
export function classifySeverity(
  severity: string,
  impactScore: number | null,
): 'critical' | 'high' | 'medium' | 'low' {
  if (severity === 'critical' || (impactScore !== null && impactScore >= 0.9)) return 'critical';
  if (severity === 'warning' || (impactScore !== null && impactScore >= 0.7)) return 'high';
  if (severity === 'info' || (impactScore !== null && impactScore >= 0.4)) return 'medium';
  return 'low';
}

// E2E mock data
const MOCK_IMPACT_SUMMARY =
  'This update requires immediate review of your current compliance posture. Action may be needed within 30 days. Consult with your RA team to assess specific impact on your device portfolio.';

async function generateImpactSummary(update: {
  title: string;
  region: string;
  rawContentEn: string | null;
}): Promise<string> {
  if (process.env.E2E_TEST_MODE === 'true') {
    return MOCK_IMPACT_SUMMARY;
  }

  const maxRetries = 3;
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await generateText({
        model: getLlmModel(),
        maxTokens: 256,
        abortSignal: AbortSignal.timeout(30000),
        messages: [
          {
            role: 'user',
            content: `You are a regulatory affairs expert. Summarize the impact of this regulatory update in 2-3 sentences, focusing on "so what does this mean for a medical device company?"\n\nTitle: ${update.title}\nRegion: ${update.region}\nContent: ${update.rawContentEn ?? update.title}\n\nProvide only the 2-3 sentence summary, no preamble:`,
          },
        ],
      });

      const text = response.text?.trim() ?? '';
      return text || MOCK_IMPACT_SUMMARY;
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (!isLastAttempt) {
        const delayMs = baseDelayMs * 2 ** attempt;
        logger.warn(`[digest] AI summary attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
          err,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        logger.error('[digest] AI summary failed after retries, using title fallback', {
          err,
          attempts: maxRetries,
        });
        return `Regulatory update from ${update.region}: ${update.title}. Review applicability to your product portfolio.`;
      }
    }
  }

  return MOCK_IMPACT_SUMMARY;
}

// @MX:ANCHOR: [AUTO] generateWeeklyDigest — primary entry point for digest compilation
// @MX:REASON: Called by API route POST /api/ra/digest/generate and Inngest cron stub
// @MX:SPEC: SPEC-REGULA-DIGEST-001
export async function generateWeeklyDigest(orgId: string, weekId?: string): Promise<DigestPayload> {
  const targetWeekId = weekId ?? getWeekId(new Date());
  const { start, end } = getWeekBounds(targetWeekId);

  // Wrap all DB access in one tenant scope so the weekly_digests upsert runs
  // with the GUC set (regulatory_updates is a global catalog read, but
  // org_update_relevance + weekly_digests are org-scoped).
  const updates = await withTenantScope(orgId, (dbs) =>
    dbs
      .select({
        id: regulatoryUpdates.id,
        title: regulatoryUpdates.title,
        region: regulatoryUpdates.region,
        severity: regulatoryUpdates.severity,
        publishedAt: regulatoryUpdates.publishedAt,
        sourceUrl: regulatoryUpdates.sourceUrl,
        rawContentEn: regulatoryUpdates.rawContentEn,
        impactScore: regulatoryUpdates.impactScore,
        orgImpactScore: orgUpdateRelevance.impactScore,
      })
      .from(regulatoryUpdates)
      .leftJoin(
        orgUpdateRelevance,
        and(
          eq(orgUpdateRelevance.updateId, regulatoryUpdates.id),
          eq(orgUpdateRelevance.orgId, orgId),
        ),
      )
      .where(
        and(gte(regulatoryUpdates.publishedAt, start), lte(regulatoryUpdates.publishedAt, end)),
      )
      .orderBy(desc(regulatoryUpdates.impactScore))
      .limit(50),
  );

  // Generate AI summaries (sequential to avoid rate limits)
  const digestUpdates: DigestUpdate[] = [];
  for (const u of updates) {
    const effectiveScore =
      u.orgImpactScore != null
        ? Number(u.orgImpactScore)
        : u.impactScore != null
          ? Number(u.impactScore)
          : 0.5;
    const classification = classifySeverity(u.severity, effectiveScore);
    const summary = await generateImpactSummary({
      title: u.title,
      region: u.region,
      rawContentEn: u.rawContentEn,
    });
    digestUpdates.push({
      id: u.id,
      title: u.title,
      region: u.region,
      severity: u.severity,
      severity_classification: classification,
      impact_score: effectiveScore,
      impact_summary: summary,
      source_url: u.sourceUrl,
      published_at: u.publishedAt.toISOString(),
    });
  }

  const counts = digestUpdates.reduce(
    (acc, u) => {
      acc[u.severity_classification]++;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  // Check for existing digest + upsert in one tenant scope.
  await withTenantScope(orgId, async (dbs) => {
    const existing = await dbs.query.weeklyDigests.findFirst({
      where: and(eq(weeklyDigests.orgId, orgId), eq(weeklyDigests.weekId, targetWeekId)),
    });

    // @MX:NOTE: [AUTO] Preserve existing shareToken to keep email links stable across normal regenerations
    // @MX:REASON: Using existing?.shareToken prevents 404 errors on previously sent token-gated email links
    // Preserve existing token for normal regeneration, only generate new for explicit rotation
    const shareToken = existing?.shareToken || crypto.randomBytes(16).toString('hex');

    await dbs
      .insert(weeklyDigests)
      .values({
        orgId,
        weekId: targetWeekId,
        updateCount: digestUpdates.length,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        digestJson: {
          week_id: targetWeekId,
          share_token: shareToken,
          week_start: start.toISOString(),
          week_end: end.toISOString(),
          org_id: orgId,
          updates: digestUpdates,
          update_count: digestUpdates.length,
          critical_count: counts.critical,
          high_count: counts.high,
          medium_count: counts.medium,
          low_count: counts.low,
        } as unknown as Record<string, unknown>,
        shareToken,
      })
      .onConflictDoUpdate({
        target: [weeklyDigests.orgId, weeklyDigests.weekId],
        set: {
          updateCount: digestUpdates.length,
          criticalCount: counts.critical,
          highCount: counts.high,
          mediumCount: counts.medium,
          lowCount: counts.low,
          generatedAt: new Date(),
        },
      });
  });

  // Reconstruct the payload for the return value (token may have been regenerated
  // by the upsert; use a fresh read to stay consistent). For simplicity, derive
  // the share token from a final read inside a scope.
  const finalRow = await withTenantScope(orgId, (dbs) =>
    dbs.query.weeklyDigests.findFirst({
      where: and(eq(weeklyDigests.orgId, orgId), eq(weeklyDigests.weekId, targetWeekId)),
    }),
  );
  const shareToken = finalRow?.shareToken ?? crypto.randomBytes(16).toString('hex');

  return {
    week_id: targetWeekId,
    share_token: shareToken,
    week_start: start.toISOString(),
    week_end: end.toISOString(),
    org_id: orgId,
    updates: digestUpdates,
    update_count: digestUpdates.length,
    critical_count: counts.critical,
    high_count: counts.high,
    medium_count: counts.medium,
    low_count: counts.low,
  };
}
