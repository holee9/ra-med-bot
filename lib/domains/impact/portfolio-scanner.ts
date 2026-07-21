// SPEC-REGULA-IMPACT-001 — scan org portfolio projects for a regulatory update.
// @MX:ANCHOR [AUTO] Entry point for impact analysis pipeline.
// @MX:REASON Called by analyzer.ts and admin API route. fan_in >= 2, grows to 3+ with UI.
// @MX:SPEC SPEC-REGULA-IMPACT-001

import type { Database } from '@/lib/kernel/db/client';
import { projects } from '@/lib/kernel/db/schema';
import { eq } from 'drizzle-orm';
import { mapSections } from './section-mapper';
import type { ImpactLevel, ScanResult } from './types';

interface RegUpdateForScan {
  id: string;
  region: string;
  severity: string;
  affectedProductTypes: string[];
  impactTypeHint: string | null;
  impactAnalysisText: string | null;
  title: string;
}

// Normalize severity → ImpactLevel
function severityToLevel(severity: string, confidence: number): ImpactLevel {
  if (severity === 'critical' || (severity === 'high' && confidence >= 0.8)) return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'info';
}

function hasRegionOverlap(updateRegion: string, targetMarkets: string[]): boolean {
  if (!targetMarkets.length) return true;
  const norm = updateRegion.toUpperCase();
  return targetMarkets.some((m) => {
    const mn = m.toUpperCase();
    return mn.includes(norm) || norm.includes(mn);
  });
}

function hasCategoryOverlap(affectedTypes: string[], deviceClass: string | null): boolean {
  if (!affectedTypes.length) return true; // broad update — affects all
  if (!deviceClass) return false;
  const dc = deviceClass.toLowerCase();
  return affectedTypes.some((t) => dc.includes(t.toLowerCase()) || t.toLowerCase().includes(dc));
}

/**
 * Scans all active projects in the org for relevance to a regulatory update.
 * Returns only projects with at least 'info'-level impact.
 */
export async function scanPortfolio(
  update: RegUpdateForScan,
  orgId: string,
  db: Database,
): Promise<ScanResult[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      deviceClass: projects.deviceClass,
      targetMarkets: projects.targetMarkets,
    })
    .from(projects)
    .where(eq(projects.organizationId, orgId));

  const results: ScanResult[] = [];

  for (const project of rows) {
    const regionMatch = hasRegionOverlap(update.region, project.targetMarkets ?? []);
    const categoryMatch = hasCategoryOverlap(update.affectedProductTypes, project.deviceClass);

    if (!regionMatch && !categoryMatch) continue;

    const confidence = regionMatch && categoryMatch ? 0.85 : 0.5;
    const sections = await mapSections(update, project.deviceClass);
    const level = severityToLevel(update.severity, confidence);

    results.push({
      project_id: project.id,
      project_name: project.name,
      impact_level: level,
      affected_sections: sections,
      analysis_summary: `${update.title} — region: ${update.region}, severity: ${update.severity}.${sections.length > 0 ? ` ${sections.length} section(s) require attention.` : ''}`,
      confidence,
    });
  }

  return results;
}
