// @MX:NOTE [AUTO] Route-level + domain-level integration tests for Cyberdevice.
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-001~014, AC-01~07)
//
// Two complementary strategies (mirrors capa.test.ts / change-control.test.ts):
//   1. Source-level: read the route/lib/migration source and assert the control
//      is present (IDOR guard, withPermission RBAC, writeAudit tx, RLS).
//   2. Domain-level: exercise the pure domain functions (SBOM parse/diff,
//      threat-model generation, CVE mapping, GSPR mapping, checklist coverage,
//      evidence-bundle assembly, risk-linkage predicate) directly.
//
// AC mapping:
//   AC-01 — SBOM import 2 versions + diff (domain-level diff function)
//   AC-02 — FDA checklist coverage report (domain-level coverage function)
//   AC-03 — CVE input → affected component mapping (domain-level mapper)
//   AC-04 — residual cyber risk → risk_item FK linkage (source-level FK + linkage)
//   AC-05 — evidence bundle includes threat_model + sbom + links (domain + source)
//   AC-06 — threat model → GSPR 17.2/17.4 + IEC 81001-5-1 mapping completeness
//   AC-07 — unauthorized/entitlement-less access → 403 + audit (source-level RBAC + audit)

import fs from 'node:fs';
import path from 'node:path';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { FDA_CYBERSECURITY_CHECKLIST, computeChecklistCoverage } from '@/lib/cyberdevice/checklist';
import { cvssToSeverity, mapCvesToComponents } from '@/lib/cyberdevice/cve-mapper';
import { assembleEvidenceBundle } from '@/lib/cyberdevice/evidence-bundle';
import {
  CYBERSECURITY_GSPR_REQUIREMENTS,
  mapThreatsToGspr,
  uncoveredRequirements,
} from '@/lib/cyberdevice/gspr-mapping';
import { shouldTriggerReassessment } from '@/lib/cyberdevice/reassess-policy';
import { diffSbomVersions } from '@/lib/cyberdevice/sbom-diff';
import { SbomParseError, parseSbom } from '@/lib/cyberdevice/sbom-parser';
import { generateThreatModel } from '@/lib/cyberdevice/threat-model-generator';
import type { ArchitectureInput } from '@/lib/cyberdevice/types';
import { generateUpdatePlan } from '@/lib/cyberdevice/update-plan';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// AC-01: SBOM import + version diff (REQ-003/004)
// ---------------------------------------------------------------------------
describe('AC-01: SBOM import + version diff (REQ-003/004)', () => {
  const spdxV1 = JSON.stringify({
    spdxVersion: 'SPDX-2.3',
    packages: [
      { name: 'openssl', versionInfo: '3.0.0', supplier: 'Supplier: OpenSSL' },
      { name: 'zlib', versionInfo: '1.2.11' },
    ],
  });
  const spdxV2 = JSON.stringify({
    spdxVersion: 'SPDX-2.3',
    packages: [
      { name: 'openssl', versionInfo: '3.0.1', supplier: 'Supplier: OpenSSL' },
      { name: 'libcurl', versionInfo: '8.0.0' },
    ],
  });

  it('parses a valid SPDX JSON document', () => {
    const parsed = parseSbom('spdx', spdxV1);
    expect(parsed.components).toHaveLength(2);
    expect(parsed.components[0]?.name).toBe('openssl');
    expect(parsed.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('parses a valid CycloneDX JSON document', () => {
    const cdx = JSON.stringify({
      bomFormat: 'CycloneDX',
      components: [
        {
          name: 'openssl',
          version: '3.0.0',
          supplier: { name: 'OpenSSL' },
          purl: 'pkg:generic/openssl@3.0.0',
        },
      ],
    });
    const parsed = parseSbom('cyclonedx', cdx);
    expect(parsed.components).toHaveLength(1);
    expect(parsed.components[0]?.purl).toBe('pkg:generic/openssl@3.0.0');
  });

  it('rejects an invalid SPDX document (missing spdxVersion)', () => {
    expect(() => parseSbom('spdx', JSON.stringify({ packages: [] }))).toThrow(SbomParseError);
  });

  it('rejects an invalid CycloneDX document (missing bomFormat)', () => {
    expect(() => parseSbom('cyclonedx', JSON.stringify({ components: [] }))).toThrow(
      SbomParseError,
    );
  });

  it('rejects non-JSON input', () => {
    expect(() => parseSbom('spdx', 'not json')).toThrow(SbomParseError);
  });

  it('diffs two SBOM versions: added/removed/updated', () => {
    const a = parseSbom('spdx', spdxV1).components;
    const b = parseSbom('spdx', spdxV2).components;
    const diff = diffSbomVersions(a, b);
    // openssl 3.0.0 → 3.0.1 (updated); zlib removed; libcurl added.
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]?.from.version).toBe('3.0.0');
    expect(diff.updated[0]?.to.version).toBe('3.0.1');
    expect(diff.removed.map((c) => c.name)).toEqual(['zlib']);
    expect(diff.added.map((c) => c.name)).toEqual(['libcurl']);
  });

  it('sbom route enforces withPermission + IDOR + audit (source-level)', () => {
    const src = readText('app/api/cyberdevice/sbom/route.ts');
    expect(src).toContain("withPermission('cyberdevice.manage'");
    expect(src).toContain('assertPmsProjectAccess');
    expect(src).toContain('auditSbomImported');
    expect(src).toContain('auditSbomValidated');
    expect(src).toContain('db.transaction');
  });

  it('sbom/diff route enforces withPermission + IDOR + audit (source-level)', () => {
    const src = readText('app/api/cyberdevice/sbom/diff/route.ts');
    expect(src).toContain("withPermission('cyberdevice.view'");
    expect(src).toContain('assertPmsProjectAccess');
    expect(src).toContain('auditSbomDiffed');
  });
});

// ---------------------------------------------------------------------------
// AC-02: FDA cybersecurity checklist 100% coverage (REQ-002)
// ---------------------------------------------------------------------------
describe('AC-02: FDA cybersecurity checklist coverage (REQ-002)', () => {
  it('checklist has exactly 8 items covering FDA Premarket Cybersecurity sections', () => {
    expect(FDA_CYBERSECURITY_CHECKLIST).toHaveLength(8);
    const ids = FDA_CYBERSECURITY_CHECKLIST.map((i) => i.id);
    expect(ids).toContain('threat_model');
    expect(ids).toContain('sbom');
    expect(ids).toContain('secure_update');
  });

  it('achieves 100% coverage when all evidence is present', () => {
    const arch: ArchitectureInput = {
      connectivity: ['https://api.example.com'],
      dataFlows: ['sensor → cloud'],
      assets: ['firmware', 'patient-data'],
      trustBoundaries: ['DMZ'],
      externalInterfaces: ['REST API'],
    };
    const cov = computeChecklistCoverage({
      hasThreatModel: true,
      hasSbom: true,
      hasCveAnalysis: true,
      hasUpdatePlan: true,
      architecture: arch,
    });
    expect(cov.coverage).toBe(1.0);
    expect(cov.completedCount).toBe(cov.totalCount);
  });

  it('reports partial coverage when evidence is missing', () => {
    const cov = computeChecklistCoverage({
      hasThreatModel: true,
      hasSbom: false,
      hasCveAnalysis: false,
      hasUpdatePlan: false,
      architecture: undefined,
    });
    expect(cov.coverage).toBeLessThan(1.0);
    expect(cov.items.find((i) => i.id === 'sbom')?.completed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-03: CVE impact analysis → affected component mapping (REQ-005/006)
// ---------------------------------------------------------------------------
describe('AC-03: CVE impact → component mapping (REQ-005/006)', () => {
  const components = [
    { name: 'openssl', version: '3.0.0', purl: 'pkg:generic/openssl@3.0.0' },
    { name: 'zlib', version: '1.2.11' },
  ];

  it('maps a CVE to affected components via name hint', () => {
    const result = mapCvesToComponents(components, [
      {
        cveId: 'CVE-2025-1234',
        kevFlag: false,
        cvssBaseScore: 9.8,
        affectedComponentNames: ['openssl'],
      },
    ]);
    expect(result[0]?.matched).toBe(true);
    expect(result[0]?.affectedComponents).toHaveLength(1);
    expect(result[0]?.affectedComponents[0]?.name).toBe('openssl');
    expect(result[0]?.severity).toBe('critical');
  });

  it('cvss score → severity bands', () => {
    expect(cvssToSeverity(9.8)).toBe('critical');
    expect(cvssToSeverity(7.5)).toBe('high');
    expect(cvssToSeverity(5.0)).toBe('medium');
    expect(cvssToSeverity(2.0)).toBe('low');
    expect(cvssToSeverity(0)).toBe('none');
  });

  it('does not match a CVE with no component hint (tier1 conservative)', () => {
    const result = mapCvesToComponents(components, [
      { cveId: 'CVE-2025-9999', kevFlag: false, cvssBaseScore: 7.0 },
    ]);
    expect(result[0]?.matched).toBe(false);
    expect(result[0]?.affectedComponents).toHaveLength(0);
  });

  it('flags KEV CVEs as kev_flag=true', () => {
    const result = mapCvesToComponents(components, [
      {
        cveId: 'CVE-2025-1234',
        kevFlag: true,
        cvssBaseScore: 8.0,
        affectedComponentNames: ['openssl'],
      },
    ]);
    expect(result[0]?.kevFlag).toBe(true);
  });

  it('cve-analysis route enforces withPermission + IDOR + audit (source-level)', () => {
    const src = readText('app/api/cyberdevice/cve-analysis/route.ts');
    expect(src).toContain("withPermission('cyberdevice.manage'");
    expect(src).toContain('assertPmsProjectAccess');
    expect(src).toContain('auditCveAnalyzed');
    expect(src).toContain('db.transaction');
    expect(src).toContain('shouldTriggerReassessment');
  });
});

// ---------------------------------------------------------------------------
// AC-04: residual cyber risk → ISO 14971 risk_item linkage (REQ-010/011)
// ---------------------------------------------------------------------------
describe('AC-04: residual cyber risk → risk_item linkage (REQ-010/011)', () => {
  it('migration defines cve_impact.risk_item_id FK → risk_items', () => {
    const sql = readText('migrations/0078_cyberdevice.sql');
    expect(sql).toMatch(/risk_item_id\s+uuid\s+REFERENCES risk_items\(id\)/);
  });

  it('shouldTriggerReassessment fires on new matched CVE', () => {
    expect(shouldTriggerReassessment({ matched: true, newSeverity: 'high', kevFlag: false })).toBe(
      true,
    );
  });

  it('shouldTriggerReassessment fires on KEV addition', () => {
    expect(shouldTriggerReassessment({ matched: false, newSeverity: 'low', kevFlag: true })).toBe(
      true,
    );
  });

  it('shouldTriggerReassessment fires on severity escalation', () => {
    expect(
      shouldTriggerReassessment({
        matched: true,
        previousSeverity: 'medium',
        newSeverity: 'critical',
        kevFlag: false,
      }),
    ).toBe(true);
  });

  it('shouldTriggerReassessment does NOT fire on static unmatched non-KEV CVE', () => {
    expect(shouldTriggerReassessment({ matched: false, newSeverity: 'low', kevFlag: false })).toBe(
      false,
    );
  });

  it('risk-linkage module exists with linkCveImpactToRiskItem + filter', () => {
    const src = readText('lib/cyberdevice/risk-linkage.ts');
    expect(src).toContain('export async function linkCveImpactToRiskItem');
    expect(src).toContain('filterRiskItemsByOrg');
    expect(src).toContain('workflowRuns.organizationId');
  });
});

// ---------------------------------------------------------------------------
// AC-05: evidence bundle includes threat_model + sbom + links (REQ-009/012/014)
// ---------------------------------------------------------------------------
describe('AC-05: evidence bundle assembly (REQ-009/012/014)', () => {
  it('assembles a complete bundle when all inputs present', () => {
    const bundle = assembleEvidenceBundle({
      threatModelId: 'tm-1',
      sbomId: 'sbom-1',
      updatePlan: { patchCadenceDays: 90 },
      linkedSubmissionId: 'sub-1',
    });
    expect(bundle.complete).toBe(true);
    expect(bundle.missing).toHaveLength(0);
    expect(bundle.threatModelId).toBe('tm-1');
    expect(bundle.sbomId).toBe('sbom-1');
    expect(bundle.linkedSubmissionId).toBe('sub-1');
  });

  it('flags incomplete bundle when update_plan missing', () => {
    const bundle = assembleEvidenceBundle({
      threatModelId: 'tm-1',
      sbomId: 'sbom-1',
      updatePlan: {},
    });
    expect(bundle.complete).toBe(false);
    expect(bundle.missing).toContain('update_plan');
  });

  it('evidence-bundle route enforces IDOR on BOTH threat_model + sbom', () => {
    const src = readText('app/api/cyberdevice/evidence-bundle/route.ts');
    expect(src).toContain("withPermission('cyberdevice.manage'");
    expect(src).toContain('assertPmsProjectAccess');
    expect(src).toContain('threat_model_not_found');
    expect(src).toContain('sbom_not_found');
    expect(src).toContain('auditEvidenceBundled');
    expect(src).toContain('db.transaction');
  });

  it('update-plan route generates signed staged plan', () => {
    const plan = generateUpdatePlan({
      projectId: 'p-1',
      patchCadenceDays: 30,
    });
    expect(plan.signingRequired).toBe(true);
    expect(plan.rollbackWindowDays).toBe(30);
    expect(plan.stages.length).toBeGreaterThan(0);
    const stageNames = plan.stages.map((s) => s.name);
    expect(stageNames).toContain('signing');
    expect(stageNames).toContain('staged_rollout');
    expect(plan.stages[0]?.name).toBe('identification');
  });
});

// ---------------------------------------------------------------------------
// AC-06: GSPR 17.2/17.4 + IEC 81001-5-1 mapping completeness (REQ-008)
// ---------------------------------------------------------------------------
describe('AC-06: GSPR + IEC 81001-5-1 mapping (REQ-008)', () => {
  const arch: ArchitectureInput = {
    connectivity: ['https://gateway.example.com'],
    dataFlows: ['device → gateway → cloud', 'DMZ flow'],
    assets: ['firmware'],
    trustBoundaries: ['DMZ'],
    externalInterfaces: ['REST API', 'BLE'],
  };

  it('threat model generates STRIDE-categorized threats', () => {
    const { threats } = generateThreatModel(arch);
    expect(threats.length).toBeGreaterThan(0);
    const categories = new Set(threats.map((t) => t.category));
    expect(categories.has('spoofing')).toBe(true);
    expect(categories.has('denial_of_service')).toBe(true);
  });

  it('maps threats to GSPR 17.2, 17.4, and IEC 81001-5-1', () => {
    const { threats } = generateThreatModel(arch);
    const mapping = mapThreatsToGspr(threats);
    const standards = new Set(mapping.map((m) => m.standard));
    expect(standards.has('GSPR_17.2')).toBe(true);
    expect(standards.has('GSPR_17.4')).toBe(true);
    expect(standards.has('IEC_81001_5_1')).toBe(true);
  });

  it('every canonical requirement is covered (completeness)', () => {
    const { threats } = generateThreatModel(arch);
    const mapping = mapThreatsToGspr(threats);
    const uncovered = uncoveredRequirements(mapping);
    expect(uncovered).toHaveLength(0);
  });

  it('CYBERSECURITY_GSPR_REQUIREMENTS includes the 3 named clauses', () => {
    const clauses = CYBERSECURITY_GSPR_REQUIREMENTS.map((r) => r.clause);
    expect(clauses).toContain('GSPR 17.2');
    expect(clauses).toContain('GSPR 17.4');
    expect(clauses.some((c) => c.startsWith('IEC 81001-5-1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-07: unauthorized access → 403 + audit (REQ-013)
// ---------------------------------------------------------------------------
describe('AC-07: entitlement denial → 403 + audit (REQ-013)', () => {
  it('PERMISSIONS defines cyberdevice.manage + cyberdevice.view', () => {
    expect(PERMISSIONS['cyberdevice.manage']).toBeDefined();
    expect(PERMISSIONS['cyberdevice.view']).toBeDefined();
    expect(PERMISSIONS['cyberdevice.manage'].minRole).toBe('ra-member');
  });

  it('access.ts asserts resource org/project ownership + audits denial', () => {
    const src = readText('lib/cyberdevice/access.ts');
    expect(src).toContain('assertCyberResourceAccess');
    expect(src).toContain('auditCyberAccessDenied');
    // 404 on mismatch (existence hidden) — required by IDOR pattern.
    expect(src).toContain('not_found');
  });

  it('audit.ts defines cyber.access_denied wrapper', () => {
    const src = readText('lib/cyberdevice/audit.ts');
    expect(src).toContain('auditCyberAccessDenied');
    expect(src).toContain("'cyber.access_denied'");
  });

  it('every cyberdevice route uses withPermission', () => {
    const routes = [
      'app/api/cyberdevice/threat-model/route.ts',
      'app/api/cyberdevice/sbom/route.ts',
      'app/api/cyberdevice/sbom/diff/route.ts',
      'app/api/cyberdevice/cve-analysis/route.ts',
      'app/api/cyberdevice/update-plan/route.ts',
      'app/api/cyberdevice/evidence-bundle/route.ts',
    ];
    for (const rel of routes) {
      const src = readText(rel);
      expect(src, `${rel} missing withPermission`).toMatch(/withPermission\(['"]cyberdevice\./);
    }
  });
});

// ---------------------------------------------------------------------------
// Count-sync (L-009): audit_action + PermissionAction deltas.
// ---------------------------------------------------------------------------
describe('count-sync: audit_action (164→173) + PermissionAction (64→66)', () => {
  it('audit_action enum has 173 values', () => {
    const src = readText('lib/db/schema.ts');
    const match = src.match(
      /export const auditActionEnum = pgEnum\('audit_action', \[([\s\S]*?)\]\);/,
    );
    const vals = match?.[1]?.match(/'[a-z_.]+'/g) ?? [];
    expect(vals.length).toBe(173);
  });

  it('AuditAction type has 173 values (sync with schema enum)', () => {
    const src = readText('lib/audit.ts');
    const match = src.match(/export type AuditAction =\s*([\s\S]*?);/);
    const vals = match?.[1]?.match(/'[a-z_.]+'/g) ?? [];
    expect(vals.length).toBe(173);
  });

  it('PERMISSIONS matrix has 66 entries', () => {
    expect(Object.keys(PERMISSIONS).length).toBe(66);
  });

  it('schema.ts defines all 4 cyberdevice tables', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const threatModel = pgTable/);
    expect(src).toMatch(/export const sbom = pgTable/);
    expect(src).toMatch(/export const cveImpact = pgTable/);
    expect(src).toMatch(/export const cyberEvidenceBundle = pgTable/);
  });
});
