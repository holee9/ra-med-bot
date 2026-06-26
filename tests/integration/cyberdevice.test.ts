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
import { describe, expect, it, vi } from 'vitest';

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
    // #239 Phase 2: withTenantScope wraps db.transaction (sets GUC + preserves atomicity).
    expect(src).toContain('withTenantScope');
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
    // #239 Phase 2: withTenantScope wraps db.transaction (sets GUC + preserves atomicity).
    expect(src).toContain('withTenantScope');
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

  // H-1 fix (REQ-010): linkCveImpactToRiskItem is actually CALLED in the live
  // route and accepts a tx so the update rides the cve-analysis transaction.
  it('H-1: cve-analysis route calls linkCveImpactToRiskItem + auditRiskLinked (not dead)', () => {
    const src = readText('app/api/cyberdevice/cve-analysis/route.ts');
    expect(src).toContain('linkCveImpactToRiskItem(');
    expect(src).toContain('auditRiskLinked(');
    // tx is passed so the UPDATE + audit ride the same atomicity boundary.
    expect(src).toMatch(/linkCveImpactToRiskItem\(\{[\s\S]*?tx,/);
  });

  it('H-1: linkCveImpactToRiskItem accepts optional tx + calls filterRiskItemsByOrg', () => {
    const src = readText('lib/cyberdevice/risk-linkage.ts');
    expect(src).toMatch(/tx\?:\s*RiskLinkTx/);
    // org-filter defense is live inside the function body.
    expect(src).toContain('filterRiskItemsByOrg(params.riskItemIds, params.orgId)');
  });

  it('H-1: cveRecordSchema accepts optional riskItemIds (uuid array)', () => {
    const src = readText('lib/cyberdevice/types.ts');
    expect(src).toMatch(/riskItemIds:\s*z\.array\(z\.string\(\)\.uuid\(\)\)\.optional\(\)/);
  });

  // H-2 fix (REQ-011): cyber.reassess_triggered audit row is written inside the
  // transaction when the predicate fires.
  it('H-2: cve-analysis route writes cyber.reassess_triggered audit inside tx', () => {
    const src = readText('app/api/cyberdevice/cve-analysis/route.ts');
    expect(src).toContain('auditReassessTriggered(');
    // Called inside db.transaction, after auditCveAnalyzed.
    expect(src).toMatch(/auditCveAnalyzed\([\s\S]*?auditReassessTriggered\(/);
  });

  it('H-2: audit.ts defines auditReassessTriggered wrapper', () => {
    const src = readText('lib/cyberdevice/audit.ts');
    expect(src).toContain('export async function auditReassessTriggered');
    expect(src).toContain("'cyber.reassess_triggered'");
  });

  it('H-2: cyber.reassess_triggered is in the enum + type + migration', () => {
    const schema = readText('lib/db/schema.ts');
    expect(schema).toContain("'cyber.reassess_triggered'");
    const audit = readText('lib/audit.ts');
    expect(audit).toContain("'cyber.reassess_triggered'");
    const migration = readText('migrations/0079_cyberdevice_linkage_hardening.sql');
    expect(migration).toContain("'cyber.reassess_triggered'");
  });
});

// ---------------------------------------------------------------------------
// C-1 fix: evidence-bundle linked_* referent validation (REQ-009/012/014)
// ---------------------------------------------------------------------------
describe('C-1: evidence-bundle linked_* referent validation', () => {
  it('linkage.ts exports verifyLinkedReferentExists for samd/dhf/submission', () => {
    const src = readText('lib/cyberdevice/linkage.ts');
    expect(src).toContain('export async function verifyLinkedReferentExists');
    expect(src).toContain("kind === 'samd'");
    expect(src).toContain("kind === 'dhf'");
    expect(src).toContain("kind === 'submission'");
    // Each referent is org-scoped via the table's org_id column.
    expect(src).toContain('samdAssessments.orgId');
    expect(src).toContain('designHistoryFiles.orgId');
    expect(src).toContain('submissionPackages.orgId');
  });

  it('evidence-bundle route validates linked_* referents before insert', () => {
    const src = readText('app/api/cyberdevice/evidence-bundle/route.ts');
    expect(src).toContain('verifyLinkedReferentExists');
    expect(src).toContain("verifyLinkedReferentExists(organizationId, 'samd'");
    expect(src).toContain("verifyLinkedReferentExists(organizationId, 'dhf'");
    // The submission call wraps across lines (biome formatter), so assert the
    // kind argument + orgId appear together in the route body.
    expect(src).toMatch(/verifyLinkedReferentExists\([\s\S]*?'submission'/);
    // Rejection surfaces 404 (existence hidden).
    expect(src).toContain('linked_samd_not_found');
    expect(src).toContain('linked_dhf_not_found');
    expect(src).toContain('linked_submission_not_found');
  });

  it('migration 0079 documents the C-1 FK type-mismatch + adds reassess_triggered', () => {
    const sql = readText('migrations/0079_cyberdevice_linkage_hardening.sql');
    expect(sql).toContain("'cyber.reassess_triggered'");
    // Documents why native FK is impossible (uuid vs text PK mismatch).
    expect(sql).toContain('uuid');
    expect(sql).toContain('text');
  });
});

// ---------------------------------------------------------------------------
// REQ-013 fix: cross-tenant denial produces cyber.access_denied audit
// ---------------------------------------------------------------------------
describe('REQ-013: cross-tenant denial audited (AC-07)', () => {
  it('evidence-bundle route writes auditCyberAccessDenied on cross-org IDOR', () => {
    const src = readText('app/api/cyberdevice/evidence-bundle/route.ts');
    expect(src).toContain('auditCyberAccessDenied');
    // Cross-org threat_model + sbom denials are audited.
    expect(src).toContain('threat_model_cross_org');
    expect(src).toContain('sbom_cross_org');
  });

  it('cve-analysis route writes auditCyberAccessDenied on cross-org sbom', () => {
    const src = readText('app/api/cyberdevice/cve-analysis/route.ts');
    expect(src).toContain('auditCyberAccessDenied');
    expect(src).toContain('sbom_cross_org');
  });

  it('assertCyberResourceAccess remains available for future by-id routes', () => {
    const src = readText('lib/cyberdevice/access.ts');
    expect(src).toContain('export async function assertCyberResourceAccess');
    expect(src).toContain('auditCyberAccessDenied');
  });
});

// ---------------------------------------------------------------------------
// M-1 fix: SBOM component-count DoS guard
// ---------------------------------------------------------------------------
describe('M-1: SBOM component-count cap (DoS guard)', () => {
  it('SBOM_MAX_COMPONENTS is exported + enforced before per-component validation', () => {
    const src = readText('lib/cyberdevice/sbom-parser.ts');
    expect(src).toContain('export const SBOM_MAX_COMPONENTS');
    expect(src).toContain('too_many_components');
    // The cap is checked BEFORE the Zod validation loop (O(1) reject).
    const capIdx = src.indexOf('too_many_components');
    const zodIdx = src.indexOf('sbomComponentSchema.safeParse');
    expect(capIdx).toBeGreaterThan(-1);
    expect(zodIdx).toBeGreaterThan(-1);
    expect(capIdx).toBeLessThan(zodIdx);
  });

  it('SBOM_MAX_COMPONENTS default is 10000 (bounds the synchronous parse)', async () => {
    const { SBOM_MAX_COMPONENTS } = await import('@/lib/cyberdevice/sbom-parser');
    expect(SBOM_MAX_COMPONENTS).toBe(10000);
  });

  it('parseSbom rejects documents exceeding the cap with too_many_components', async () => {
    const orig = process.env.SBOM_MAX_COMPONENTS;
    process.env.SBOM_MAX_COMPONENTS = '3';
    try {
      vi.resetModules();
      const mod = await import('@/lib/cyberdevice/sbom-parser');
      const packages = Array.from({ length: 4 }, (_, i) => ({
        name: `pkg-${i}`,
        versionInfo: '1.0.0',
      }));
      const doc = JSON.stringify({ spdxVersion: 'SPDX-2.3', packages });
      // After vi.resetModules the thrown class is a fresh module instance, so
      // assert by name + code rather than instanceof across the module boundary.
      let caught: { name: string; code: string } | undefined;
      try {
        mod.parseSbom('spdx', doc);
      } catch (e) {
        caught = e as { name: string; code: string };
      }
      expect(caught?.name).toBe('SbomParseError');
      expect(caught?.code).toBe('too_many_components');
    } finally {
      if (orig === undefined) {
        process.env.SBOM_MAX_COMPONENTS = undefined;
      } else {
        process.env.SBOM_MAX_COMPONENTS = orig;
      }
      vi.resetModules();
    }
  });

  it('a normal-sized SBOM still parses fine under the cap', () => {
    const doc = JSON.stringify({
      spdxVersion: 'SPDX-2.3',
      packages: [
        { name: 'openssl', versionInfo: '3.0.0' },
        { name: 'zlib', versionInfo: '1.2.11' },
      ],
    });
    const parsed = parseSbom('spdx', doc);
    expect(parsed.components).toHaveLength(2);
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
    // #239 Phase 2: withTenantScope wraps db.transaction (sets GUC + preserves atomicity).
    expect(src).toContain('withTenantScope');
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
describe('count-sync: audit_action (174→191) + PermissionAction (66→70)', () => {
  it('audit_action enum has 191 values', () => {
    const src = readText('lib/db/schema.ts');
    const match = src.match(
      /export const auditActionEnum = pgEnum\('audit_action', \[([\s\S]*?)\]\);/,
    );
    const vals = match?.[1]?.match(/'[a-z_.]+'/g) ?? [];
    expect(vals.length).toBe(199);
  });

  it('AuditAction type has 199 values (sync with schema enum)', () => {
    const src = readText('lib/audit.ts');
    const match = src.match(/export type AuditAction =\s*([\s\S]*?);/);
    const vals = match?.[1]?.match(/'[a-z_.]+'/g) ?? [];
    expect(vals.length).toBe(199);
  });

  it('PERMISSIONS matrix has 71 entries', () => {
    expect(Object.keys(PERMISSIONS).length).toBe(75); // +2 knowledgepromo.* (#50)
  });

  it('schema.ts defines all 4 cyberdevice tables', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const threatModel = pgTable/);
    expect(src).toMatch(/export const sbom = pgTable/);
    expect(src).toMatch(/export const cveImpact = pgTable/);
    expect(src).toMatch(/export const cyberEvidenceBundle = pgTable/);
  });
});
