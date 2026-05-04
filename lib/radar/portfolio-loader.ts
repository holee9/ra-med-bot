// Portfolio loader — loads org product portfolio for relevance scoring.
// @MX:SPEC SPEC-REGULA-RADAR-001

import type { Database } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface OrgPortfolio {
  device_classes: string[];
  product_categories: string[];
  target_markets: string[];
}

// Simple in-memory cache: orgId → { portfolio, expiresAt }
const cache = new Map<string, { portfolio: OrgPortfolio; expiresAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load org product portfolio from projects table.
 * Caches result for 5 minutes per org to avoid repeated DB queries.
 */
export async function loadPortfolio(orgId: string, db: Database): Promise<OrgPortfolio> {
  const now = Date.now();
  const cached = cache.get(orgId);

  if (cached && cached.expiresAt > now) {
    return cached.portfolio;
  }

  const rows = await db
    .select({
      deviceClass: projects.deviceClass,
      targetMarkets: projects.targetMarkets,
    })
    .from(projects)
    .where(eq(projects.organizationId, orgId));

  const deviceClasses = Array.from(
    new Set(rows.map((r) => r.deviceClass).filter((dc): dc is string => dc !== null)),
  );

  const targetMarkets = Array.from(
    new Set(rows.flatMap((r) => r.targetMarkets ?? []).filter(Boolean)),
  );

  // Product categories are not yet stored as a structured field on projects.
  // Future: join organization_documents once DOCINGEST schema exposes categories.
  const productCategories: string[] = [];

  const portfolio: OrgPortfolio = {
    device_classes: deviceClasses,
    product_categories: productCategories,
    target_markets: targetMarkets,
  };

  cache.set(orgId, { portfolio, expiresAt: now + CACHE_TTL_MS });

  return portfolio;
}

/** Clear portfolio cache (for testing). */
export function clearPortfolioCache(): void {
  cache.clear();
}
