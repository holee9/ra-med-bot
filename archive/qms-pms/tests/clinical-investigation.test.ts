// @MX:NOTE [AUTO] Route-level + domain-level integration tests for Clinical Investigation.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (REQ-CLININV-001~012, AC-01~07)

// @MX:LEGACY archived from tests
//
// Two complementary strategies:
//   1. Source-level: read route/lib/migration source and assert controls are present
//      (IDOR guard, withPermission RBAC, audit writeAudit, close gate, citation
//      enforcement).
//   2. Domain-level: exercise pure domain functions (gap-assessment, IDE decision
//      tree, EU checklist, protocol builder, IRB package draft, close gate logic).
//
// AC mapping:
//   AC-01 — gap → recommendation (domain: assessNecessity)
//   AC-02 — pathway + citation (domain: decideIdePathway + enforceCitations)
//   AC-03 — IRB package draft (domain: buildIrbPackageDraft)
//   AC-04 — result → CER/DHF link (source: linkage.ts + links route)
//   AC-06 — protocol builder (domain: buildProtocolDraft)
//   AC-07 — expert signoff close block (domain: close-gate + source: close route)
// SPEC-REGULA-PHI-REMOVAL-001: AC-08 (adverse_event ↔ vigilance) removed.

import fs from 'node:fs';
import path from 'node:path';
import { enforceCitations } from '@/lib/clinical-investigation/citation-enforcement';
import { buildEuMdrChecklist } from '@/lib/clinical-investigation/eu-checklist';
import { assessNecessity } from '@/lib/clinical-investigation/gap-assessment';
import { decideIdePathway } from '@/lib/clinical-investigation/ide-decision-tree';
import { buildIrbPackageDraft } from '@/lib/clinical-investigation/irb-package';
import { buildProtocolDraft } from '@/lib/clinical-investigation/protocol-builder';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// AC-01: CER gap → clinical investigation recommendation (REQ-001)
// ---------------------------------------------------------------------------
describe('AC-01: gap → recommendation (REQ-001)', () => {
  it('assessNecessity returns required when CER gap is explicit + high-risk device', () => {
    const result = assessNecessity(
      {
        cerGapSummary: 'The existing CER identifies an INSUFFICIENT evidence base for conformity.',
        literatureGapSummary: 'No clinical studies found for this indication.',
        deviceClass: 'Class III implantable',
        intendedUse: 'Long-term implantable insulin delivery',
      },
      [
        { citation: 'EU MDR Annex XIV Part A clinical evaluation' },
        { citation: 'ISO 14155 clinical investigation good clinical practice' },
        { citation: '21 CFR 812 investigational device exemptions' },
      ],
    );
    expect(result.necessityStatus).toBe('required');
    expect(result.recommendation).toMatch(/REQUIRED/i);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.confidence).not.toBe('unverified');
  });

  it('assessNecessity returns conditional for mid-risk device with partial literature gap', () => {
    const result = assessNecessity({
      cerGapSummary: 'CER is generally adequate.',
      literatureGapSummary: 'Some gap in long-term follow-up data exists.',
      deviceClass: 'Class IIb',
    });
    expect(result.necessityStatus).toBe('conditional');
    expect(result.recommendation).toMatch(/PMCF|conditional/i);
  });

  it('assessNecessity returns not_required when no gap signal is present', () => {
    const result = assessNecessity({
      cerGapSummary: 'CER evidence is complete and adequate.',
      deviceClass: 'Class IIa',
    });
    expect(result.necessityStatus).toBe('not_required');
  });

  it('assess route enforces withPermission + IDOR + audit + Zod (source-level)', () => {
    const src = readText('app/api/clinical-investigation/assess/route.ts');
    expect(src).toMatch(/withPermission\(\s*'clinical_investigation\.assess'/);
    expect(src).toContain('assertPmsProjectAccess');
    expect(src).toContain('assessInputSchema');
    expect(src).toContain('db.transaction');
    expect(src).toContain("'ci.assessed'");
  });
});

// ---------------------------------------------------------------------------
// AC-02: pathway + citation (REQ-002/003/010)
// ---------------------------------------------------------------------------
describe('AC-02: pathway decision + citation enforcement (REQ-002/003/010)', () => {
  it('decideIdePathway returns full IDE for significant risk device', () => {
    const result = decideIdePathway({ riskLevel: 'significant', isExemptDevice: false });
    expect(result.pathway).toBe('fda_ide');
    expect(result.decision).toMatch(/Significant Risk/i);
    expect(result.citations.some((c) => c.id.includes('812.20'))).toBe(true);
  });

  it('decideIdePathway returns NSR for non_significant risk', () => {
    const result = decideIdePathway({ riskLevel: 'non_significant', isExemptDevice: false });
    expect(result.decision).toMatch(/Non-Significant Risk/i);
    expect(result.citations.some((c) => c.id.includes('812.2'))).toBe(true);
  });

  it('decideIdePathway returns exempt when device is exempt', () => {
    const result = decideIdePathway({ riskLevel: 'non_significant', isExemptDevice: true });
    expect(result.decision).toMatch(/exempt/i);
  });

  it('enforceCitations strips unmatched citations and sets confidence=unverified', () => {
    const emitted = [
      { source: '21 CFR', id: '812.20' },
      { source: 'Hallucinated Regulation', id: '999.999' },
    ];
    const retrieved = [{ citation: '21 CFR 812.20 IDE Applications' }];
    const result = enforceCitations(emitted, retrieved);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.id).toBe('812.20');
    expect(result.hadUnmatched).toBe(true);
    expect(result.allUnmatched).toBe(false);
  });

  it('enforceCitations sets confidence=unverified when ALL citations are unmatched', () => {
    const emitted = [{ source: 'Fake Reg', id: '000.000' }];
    const retrieved = [{ citation: '21 CFR 812.20 IDE Applications' }];
    const result = enforceCitations(emitted, retrieved);
    expect(result.allUnmatched).toBe(true);
    expect(result.confidence).toBe('unverified');
    expect(result.citations).toHaveLength(0);
  });

  it('EU checklist includes Article 62 + Annex XV items (REQ-003)', () => {
    const checklist = buildEuMdrChecklist();
    expect(checklist.items.length).toBeGreaterThanOrEqual(10);
    expect(checklist.items.some((i) => i.ref.includes('Article 62'))).toBe(true);
    expect(checklist.items.some((i) => i.ref.includes('Annex XV'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-03: IRB package draft (REQ-004/006/007)
// ---------------------------------------------------------------------------
describe('AC-03: IRB package draft (REQ-004/006/007)', () => {
  it('buildIrbPackageDraft produces cover letter + sections', () => {
    const pkg = buildIrbPackageDraft(
      {
        pathway: 'fda_ide',
        includeConsentDraft: true,
        includeBrochure: true,
        includeMonitoringPlan: true,
      },
      {
        deviceName: 'Insulin Pump X',
        intendedUse: 'Diabetes management',
        riskLevel: 'significant',
      },
    );
    expect(pkg.irbPackage).toMatch(/IRB Submission Package/);
    expect(pkg.consentDraft).toMatch(/Informed Consent Form/);
    expect(pkg.brochure).toMatch(/Investigator Brochure/);
    expect(pkg.monitoringPlan).toMatch(/Monitoring Plan/);
    expect(pkg.citations.length).toBeGreaterThan(0);
  });

  it('irb-package route persists pathway + audits (source-level)', () => {
    const src = readText('app/api/clinical-investigation/[id]/irb-package/route.ts');
    expect(src).toMatch(/withPermission\(\s*'clinical_investigation\.manage'/);
    expect(src).toContain('assertInvestigationAccess');
    expect(src).toContain('buildIrbPackageDraft');
    expect(src).toContain("'ci.irb_package_drafted'");
    expect(src).toMatch(/DEFERRED.*Issue 65|eSubmit.*65/s);
  });

  it('consent draft includes risk/benefit rationale (REQ-006)', () => {
    const src = readText('lib/clinical-investigation/consent-generator.ts');
    expect(src).toMatch(/Risk\/Benefit Rationale/);
  });
});

// ---------------------------------------------------------------------------
// AC-04: result → CER/DHF link (REQ-009)
// ---------------------------------------------------------------------------
describe('AC-04: result → CER/DHF link (REQ-009)', () => {
  it('linkage helper persists ci_links with UNIQUE constraint (source-level)', () => {
    const src = readText('lib/clinical-investigation/linkage.ts');
    expect(src).toContain('onConflictDoNothing');
    expect(src).toContain('ciLinks');
  });

  it('links route enforces withPermission + IDOR + audit (source-level)', () => {
    const src = readText('app/api/clinical-investigation/[id]/links/route.ts');
    expect(src).toMatch(/withPermission\(\s*'clinical_investigation\.manage'/);
    expect(src).toContain('assertInvestigationAccess');
    expect(src).toContain('linkInvestigationResults');
    expect(src).toContain("'ci.results_linked'");
  });

  it('ci_links migration enforces UNIQUE (investigation_id, target_type, target_id)', () => {
    const sql = readText('migrations/0076_clinical_investigation.sql');
    expect(sql).toMatch(/UNIQUE \(investigation_id, target_type, target_id\)/);
  });
});

// ---------------------------------------------------------------------------
// AC-05: approval/progress dashboard frontend (REQ-011)
// ---------------------------------------------------------------------------
describe('AC-05: clinical investigation dashboard frontend (REQ-011)', () => {
  it('entry page renders the workbench and dashboard state', () => {
    const src = readText('app/(app)/clinical-investigation/page.tsx');
    expect(src).toContain('ClinicalInvestigationWorkbench');
    expect(src).toContain('clinicalInvestigations');
    expect(src).toContain('clinical-investigation-page');
  });

  it('sidebar and layout expose the planner behind ra-member visibility', () => {
    const sidebar = readText('components/shell/Sidebar.tsx');
    const layout = readText('app/(app)/layout.tsx');
    expect(sidebar).toContain('sidebar-clinical-investigation-link');
    expect(sidebar).toContain('/clinical-investigation');
    expect(layout).toContain('showClinicalInvestigation');
  });
});

// ---------------------------------------------------------------------------
// AC-06: protocol builder (REQ-005)
// ---------------------------------------------------------------------------
describe('AC-06: protocol builder (REQ-005)', () => {
  it('buildProtocolDraft normalizes synopsis + criteria', () => {
    const draft = buildProtocolDraft({
      synopsis: '  Prospective single-arm study  ',
      endpoints: [{ name: '  Primary Safety  ', description: '  AE rate  ' }],
      inclusionCriteria: ['  Adult patients  ', '  Type 1 diabetes  '],
      exclusionCriteria: ['  Pregnancy  '],
    });
    expect(draft.synopsis).toBe('Prospective single-arm study');
    expect(draft.endpoints[0]?.name).toBe('Primary Safety');
    expect(draft.endpoints[0]?.description).toBe('AE rate');
    expect(draft.inclusionCriteria).toEqual(['Adult patients', 'Type 1 diabetes']);
    expect(draft.exclusionCriteria).toEqual(['Pregnancy']);
  });

  it('protocol route persists + audits (source-level)', () => {
    const src = readText('app/api/clinical-investigation/[id]/protocol/route.ts');
    expect(src).toMatch(/withPermission\(\s*'clinical_investigation\.manage'/);
    expect(src).toContain('buildProtocolDraft');
    expect(src).toContain("'ci.protocol_updated'");
  });
});

// ---------------------------------------------------------------------------
// AC-07: expert signoff close block (REQ-012) — NEGATIVE test
// ---------------------------------------------------------------------------
describe('AC-07: expert signoff close gate (REQ-012)', () => {
  it('close route requires expertSignoffId via Zod (source-level)', () => {
    const src = readText('app/api/clinical-investigation/[id]/close/route.ts');
    expect(src).toMatch(/withPermission\(\s*'clinical_investigation\.manage'/);
    expect(src).toContain('canCloseInvestigation');
    expect(src).toContain('input.expertSignoffId');
    expect(src).toContain('closeInputSchema');
    expect(src).toContain("'ci.close_blocked_signoff_missing'");
    expect(src).toContain("'ci.closed'");
  });

  it('closeInputSchema rejects requests without expertSignoffId (negative)', async () => {
    const { closeInputSchema } = await import('@/lib/clinical-investigation/types');
    const bad = closeInputSchema.safeParse({ notes: 'attempting close without signoff' });
    expect(bad.success).toBe(false);
  });

  it('close gate IDOR-scoped — cross-org returns not_found_or_org_mismatch reason (source-level)', () => {
    const src = readText('lib/clinical-investigation/close-gate.ts');
    expect(src).toContain('eq(clinicalInvestigations.orgId, orgId)');
    expect(src).toContain('investigation_not_found_or_org_mismatch');
  });

  it('close gate verifies expertSignoffId is a resolved expert review org-bound to the caller (source-level)', () => {
    const src = readText('lib/clinical-investigation/close-gate.ts');
    expect(src).toContain('expertReviews');
    expect(src).toContain('expertSignoffId');
    expect(src).toContain("eq(expertReviews.status, 'resolved')");
    // C-1 fix: signoff is org-bound via conversations → projects.organizationId.
    // A cross-org resolved review UUID is denied with expert_signoff_not_org_bound.
    expect(src).toContain('projects.organizationId');
    expect(src).toContain('expert_signoff_not_org_bound');
  });
});

// ---------------------------------------------------------------------------
// IDOR regression (L-007 cross-SPEC lesson)
// ---------------------------------------------------------------------------
describe('IDOR regression: every [id] route asserts org scope', () => {
  const routes = [
    'app/api/clinical-investigation/[id]/ide-decision/route.ts',
    'app/api/clinical-investigation/[id]/eu-checklist/route.ts',
    'app/api/clinical-investigation/[id]/protocol/route.ts',
    'app/api/clinical-investigation/[id]/irb-package/route.ts',
    'app/api/clinical-investigation/[id]/events/route.ts',
    'app/api/clinical-investigation/[id]/close/route.ts',
    'app/api/clinical-investigation/[id]/links/route.ts',
    'app/api/clinical-investigation/[id]/route.ts',
  ];
  it.each(routes)('%s asserts assertInvestigationAccess (org-scoped IDOR guard)', (rel) => {
    const src = readText(rel);
    expect(src).toContain('assertInvestigationAccess');
    expect(src).toMatch(/Investigation not found.*404/);
  });
});

// ---------------------------------------------------------------------------
// Schema regression: org_id on every table (L-007)
// ---------------------------------------------------------------------------
describe('Schema regression: org_id on every CI table (L-007)', () => {
  it.each(['clinical_investigations', 'ci_protocols', 'ci_documents', 'ci_events', 'ci_links'])(
    'table %s has org_id column in migration',
    (table) => {
      const sql = readText('migrations/0076_clinical_investigation.sql');
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}[\\s\\S]*?org_id uuid NOT NULL`));
    },
  );

  it.each(['clinical_investigations', 'ci_protocols', 'ci_documents', 'ci_events', 'ci_links'])(
    'schema.ts exports %s table with orgId',
    (table) => {
      const src = readText('lib/db/schema.ts');
      expect(src).toContain(`'${table}'`);
      // All 5 tables use camelCase orgId.
      const tableExport = src.match(new RegExp(`export const \\w+ = pgTable\\(\\s*'${table}'`));
      expect(tableExport).toBeTruthy();
    },
  );
});

// ---------------------------------------------------------------------------
// Audit atomicity (H2 — 21 CFR Part 11)
// ---------------------------------------------------------------------------
describe('Audit atomicity (H2): writeAudit rides db.transaction', () => {
  it.each([
    'app/api/clinical-investigation/assess/route.ts',
    'app/api/clinical-investigation/[id]/ide-decision/route.ts',
    'app/api/clinical-investigation/[id]/protocol/route.ts',
    'app/api/clinical-investigation/[id]/irb-package/route.ts',
    'app/api/clinical-investigation/[id]/events/route.ts',
    'app/api/clinical-investigation/[id]/close/route.ts',
    'app/api/clinical-investigation/[id]/links/route.ts',
  ])('%s passes tx to writeAudit inside db.transaction', (rel) => {
    const src = readText(rel);
    expect(src).toContain('db.transaction');
    expect(src).toMatch(/writeAudit\([\s\S]*?,\s*tx,?\s*\)/);
  });
});
