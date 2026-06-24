// @MX:NOTE [AUTO] Route-level + domain-level integration tests for labeling.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001~012, AC-01~08)
//
// Two complementary strategies (mirrors change-control.test.ts):
//   1. Source-level: read the route/lib/migration source and assert the control
//      is present (IDOR guard, withPermission RBAC, audit writeAudit, export gate).
//   2. Domain-level: exercise the pure domain functions (validateClaimCitations,
//      detectComparativeClaim, detectSemanticDiff, evaluateChecklist) to drive
//      REQ-003/004/005/007 behavior directly.
//
// AC mapping:
//   AC-01 — jurisdiction checklist 100% coverage (evaluateChecklist)
//   AC-02 — claim without citation → expert_review_required (validateClaimCitations)
//   AC-03 — export blocked on unsupported claim (canExportLabelingDocument source gate)
//   AC-04 — comparative/superiority detection (detectComparativeClaim)
//   AC-05 — KO↔EN translation diff (detectSemanticDiff)
//   AC-06 — change-control linkage (linkLabelingChangeToChangeControl → assessChange)
//   AC-07 — eSubmit forward hook stub (forwardLabelingToESubmit)
//   AC-08 — RBAC: label.approve restricted to ra-lead (PERMISSIONS matrix)

import fs from 'node:fs';
import path from 'node:path';
import type { RetrieverResult } from '@/lib/ai/retrievers/internal-docs';
import { assessChange } from '@/lib/change-control/engine';
import { linkLabelingChangeToChangeControl } from '@/lib/labeling/change-control-link';
import { isUnsupportedClaim, validateClaimCitations } from '@/lib/labeling/claim-validator';
import { detectComparativeClaim } from '@/lib/labeling/comparable-detector';
import { forwardLabelingToESubmit } from '@/lib/labeling/esubmit-bridge';
import {
  ALL_LABELING_JURISDICTIONS,
  REQUIRED_LABEL_ELEMENTS,
  evaluateChecklist,
} from '@/lib/labeling/jurisdiction-checklist';
import { detectSemanticDiff } from '@/lib/labeling/translation-diff';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// AC-01: jurisdiction checklist 100% coverage
// ---------------------------------------------------------------------------
describe('AC-01: jurisdiction checklist coverage (REQ-002, REQ-011)', () => {
  it.each(ALL_LABELING_JURISDICTIONS)(
    '%s has a non-empty required-elements list',
    (jurisdiction) => {
      const list = REQUIRED_LABEL_ELEMENTS[jurisdiction];
      expect(list.length).toBeGreaterThan(0);
    },
  );

  it('returns 100% coverage when all section-types are filled', () => {
    const sections = [
      { sectionType: 'intended_use', content: 'For diagnostic imaging.' },
      { sectionType: 'indication', content: 'Cardiac imaging.' },
      { sectionType: 'contraindication', content: 'Pregnancy.' },
      { sectionType: 'warning', content: 'Radiation exposure.' },
      { sectionType: 'precaution', content: 'Use shielding.' },
    ] as const;
    const result = evaluateChecklist(sections, 'FDA');
    expect(result.coveragePercent).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('returns <100% coverage when a section is empty', () => {
    const sections = [
      { sectionType: 'intended_use', content: 'For diagnostic imaging.' },
      { sectionType: 'indication', content: '' },
      { sectionType: 'contraindication', content: 'Pregnancy.' },
      { sectionType: 'warning', content: 'Radiation exposure.' },
      { sectionType: 'precaution', content: 'Use shielding.' },
    ] as const;
    const result = evaluateChecklist(sections, 'FDA');
    expect(result.coveragePercent).toBeLessThan(100);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02: claim without citation → expert_review_required
// ---------------------------------------------------------------------------
describe('AC-02: claim citation enforcement (REQ-003, REQ-004)', () => {
  it('forces expertReviewRequired when no citations are provided', () => {
    const result = validateClaimCitations([]);
    expect(result.hasGroundedCitation).toBe(false);
    expect(result.expertReviewRequired).toBe(true);
  });

  it('forces expertReviewRequired when all citations have empty excerpts', () => {
    const result = validateClaimCitations([
      { source: 'FDA', excerpt: '   ' },
      { source: 'ISO', excerpt: '' },
    ]);
    expect(result.hasGroundedCitation).toBe(false);
    expect(result.expertReviewRequired).toBe(true);
    expect(result.rejectedCitationCount).toBe(2);
  });

  it('passes when at least one grounded citation is present', () => {
    const result = validateClaimCitations([
      { source: '21 CFR 801.109', excerpt: 'Rx-only designation required.' },
    ]);
    expect(result.hasGroundedCitation).toBe(true);
    expect(result.expertReviewRequired).toBe(false);
    expect(result.groundedCitations).toHaveLength(1);
  });

  it('isUnsupportedClaim returns true when all citations rejected', () => {
    expect(isUnsupportedClaim(3, 3)).toBe(true);
    expect(isUnsupportedClaim(2, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-04: comparative/superiority detection (REQ-005)
// ---------------------------------------------------------------------------
describe('AC-04: comparative/superiority detection (REQ-005)', () => {
  it('detects comparative language', () => {
    const result = detectComparativeClaim('Our device is compared to the predicate.');
    expect(result.isComparative).toBe(true);
    expect(result.claimType).toBe('comparative');
  });

  it('detects superiority language', () => {
    const result = detectComparativeClaim('Our device is more effective than competing products.');
    expect(result.isSuperiority).toBe(true);
    expect(result.claimType).toBe('superiority');
  });

  it('detects Korean comparative/superiority language', () => {
    const comparative = detectComparativeClaim('기존 제품 대비 향상된 성능.');
    expect(comparative.isComparative).toBe(true);
    const superiority = detectComparativeClaim('타사 제품보다 더 효과적입니다.');
    expect(superiority.isSuperiority).toBe(true);
  });

  it('returns supported when no comparative/superiority keywords match', () => {
    const result = detectComparativeClaim('This device is indicated for cardiac imaging.');
    expect(result.claimType).toBe('supported');
    expect(result.isComparative).toBe(false);
    expect(result.isSuperiority).toBe(false);
  });

  it('superiority takes precedence over comparative', () => {
    const result = detectComparativeClaim('Our device is superior and compared to the predicate.');
    expect(result.claimType).toBe('superiority');
  });
});

// ---------------------------------------------------------------------------
// AC-05: KO↔EN translation semantic diff (REQ-007)
// ---------------------------------------------------------------------------
describe('AC-05: translation semantic diff (REQ-007)', () => {
  it('returns match for equivalent source and target', () => {
    const result = detectSemanticDiff(
      'This device is indicated for cardiac imaging.',
      'en',
      'This device is indicated for cardiac imaging.',
      'en',
    );
    expect(result.status).toBe('match');
  });

  it('returns major_diff on numeric mismatch (dosage)', () => {
    const result = detectSemanticDiff('Administer 10 mg daily.', 'en', '1일 20mg 투여.', 'ko');
    expect(result.status).toBe('major_diff');
  });

  it('returns major_diff when a critical term is missing in target', () => {
    const result = detectSemanticDiff(
      'Contraindicated in pregnancy.',
      'en',
      '임신 중 사용 가능합니다.',
      'ko',
    );
    expect(result.status).toBe('major_diff');
    expect(result.details.some((d) => d.type === 'critical_term_divergence')).toBe(true);
  });

  it('returns match when source and target are identical (no divergence possible)', () => {
    // MVP heuristic confirms critical-term groups match when text is identical.
    // Cross-locale critical-term mapping is exercised in the divergence tests above;
    // a true symmetric match across all groups requires the LLM hybrid (Phase 2).
    const result = detectSemanticDiff(
      'Warning: radiation exposure.',
      'en',
      'Warning: radiation exposure.',
      'en',
    );
    expect(result.status).toBe('match');
  });
});

// ---------------------------------------------------------------------------
// AC-06: change-control linkage reuses assessChange with changeType='labeling'
// ---------------------------------------------------------------------------
describe('AC-06: change-control linkage (REQ-008)', () => {
  it('linkLabelingChangeToChangeControl delegates to assessChange with changeType=labeling', async () => {
    // Stub retrieveFn that yields a grounded source (mirrors CC engine test).
    const retrieveFn = async (): Promise<RetrieverResult> => ({
      results: [
        {
          id: 'src-1',
          content: '21 CFR 807.81(a)(3) significant change or modification.',
          score: 0.9,
          documentId: 'doc-fda-807',
          docClass: 'regulation',
          metadata: { source: '21 CFR 807.81', section: '(a)(3)', excerpt: 'significant change' },
        },
      ],
      expertReviewRequired: false,
    });

    const output = await linkLabelingChangeToChangeControl(
      {
        documentId: 'doc-1',
        projectId: 'proj-1',
        changeDescription: 'Updated intended use statement.',
        targetMarkets: ['FDA'],
      },
      { orgId: 'org-1', userId: 'user-1', retrieveFn },
    );

    expect(output.changeType).toBe('labeling');
    expect(output.verdicts.length).toBeGreaterThan(0);
    const fda = output.verdicts.find((v) => v.jurisdiction === 'FDA');
    expect(fda).toBeDefined();
  });

  it('approve route calls linkLabelingChangeToChangeControl on the live path (AC-06 live-call guard)', () => {
    // Source-level guard against the AC-06 dead-code regression: the approve
    // route MUST import and invoke linkLabelingChangeToChangeControl so that
    // REQ-008 actually fires at the route boundary, not only in domain tests.
    const src = readText('app/api/labeling/documents/[id]/approve/route.ts');
    expect(src).toMatch(/from\s+['"]@\/lib\/labeling\/change-control-link['"]/);
    // Call site must be present (not just the import).
    expect(src).toMatch(/linkLabelingChangeToChangeControl\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// AC-07: eSubmit forward hook stub (REQ-009)
// ---------------------------------------------------------------------------
describe('AC-07: eSubmit forward hook stub (REQ-009)', () => {
  it('returns forwarded=false with stub detail (no throw)', async () => {
    const result = await forwardLabelingToESubmit({
      documentId: 'doc-1',
      projectId: 'proj-1',
      orgId: 'org-1',
    });
    expect(result.forwarded).toBe(false);
    expect(result.detail).toBe('esubmit_not_implemented_stub_invoked');
  });
});

// ---------------------------------------------------------------------------
// AC-08: RBAC — label.approve restricted to ra-lead
// ---------------------------------------------------------------------------
describe('AC-08: RBAC matrix (REQ-012)', () => {
  it('permissions.ts restricts label.approve to ra-lead', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'label\.approve':\s*\{\s*minRole:\s*'ra-lead'/);
  });

  it('permissions.ts restricts label.export to ra-lead', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'label\.export':\s*\{\s*minRole:\s*'ra-lead'/);
  });

  it('approve route is wrapped with withPermission(label.approve)', () => {
    const src = readText('app/api/labeling/documents/[id]/approve/route.ts');
    expect(src).toMatch(/withPermission\(\s*['"]label\.approve['"]/);
  });
});

// ---------------------------------------------------------------------------
// Source-level IDOR + audit assertions (mirrors CC security-fix pattern)
// ---------------------------------------------------------------------------
describe('IDOR defense + audit logging (REQ-010, REQ-012)', () => {
  it('documents route calls assertPmsProjectAccess before insert', () => {
    const src = readText('app/api/labeling/documents/route.ts');
    expect(src).toMatch(/import\s+\{\s*assertPmsProjectAccess\s*\}/);
    const guardIdx = src.indexOf('assertPmsProjectAccess(body.projectId');
    const insertIdx = src.indexOf('.insert(labelingDocuments)');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(insertIdx);
  });

  it('documents route audits label.document_created inside the tx', () => {
    const src = readText('app/api/labeling/documents/route.ts');
    expect(src).toMatch(/action:\s*'label\.document_created'/);
    expect(src).toMatch(/writeAudit\([\s\S]*,\s*tx,\s*\)/);
  });

  it('claims route audits claim_validated or claim_citation_rejected', () => {
    const src = readText('app/api/labeling/documents/[id]/claims/route.ts');
    expect(src).toMatch(/label\.claim_validated/);
    expect(src).toMatch(/label\.claim_citation_rejected/);
  });

  it('export route audits label.export_blocked on denial', () => {
    const src = readText('app/api/labeling/documents/[id]/export/route.ts');
    expect(src).toMatch(/label\.export_blocked/);
    expect(src).toMatch(/status:\s*403/);
  });

  it('approve route audits label.approved and calls eSubmit hook', () => {
    const src = readText('app/api/labeling/documents/[id]/approve/route.ts');
    expect(src).toMatch(/label\.approved/);
    expect(src).toMatch(/forwardLabelingToESubmit/);
  });

  it('translations route audits label.translation_diff_detected on major_diff', () => {
    const src = readText('app/api/labeling/documents/[id]/translations/route.ts');
    expect(src).toMatch(/label\.translation_diff_detected/);
  });

  it('all [id] routes resolve params via Promise await (Next.js 15)', () => {
    for (const rel of [
      'app/api/labeling/documents/[id]/route.ts',
      'app/api/labeling/documents/[id]/claims/route.ts',
      'app/api/labeling/documents/[id]/checklist/route.ts',
      'app/api/labeling/documents/[id]/translations/route.ts',
      'app/api/labeling/documents/[id]/approve/route.ts',
      'app/api/labeling/documents/[id]/export/route.ts',
    ]) {
      const src = readText(rel);
      // Must use the Promise-aware params resolution (mirrors CC [assessmentId] route).
      expect(src).toMatch(/'then' in ctx\.params/);
    }
  });
});

// ---------------------------------------------------------------------------
// Migration 0072 schema assertions (enterprise-migrations.test.ts also covers)
// ---------------------------------------------------------------------------
describe('migration 0072 + schema (REQ-001, REQ-003, REQ-010)', () => {
  it('migration file 0072_labeling.sql exists', () => {
    expect(fs.existsSync(path.join(root, 'migrations/0072_labeling.sql'))).toBe(true);
  });

  it('migration creates 5 labeling tables with RLS', () => {
    const sql = readText('migrations/0072_labeling.sql');
    for (const table of [
      'labeling_documents',
      'labeling_sections',
      'labeling_claims',
      'labeling_claim_citations',
      'labeling_translations',
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}`));
      expect(sql).toMatch(new RegExp(`ENABLE ROW LEVEL SECURITY[\\s\\S]*${table}`));
    }
  });

  it('migration enforces excerpt NOT NULL with CHECK on labeling_claim_citations', () => {
    const sql = readText('migrations/0072_labeling.sql');
    expect(sql).toMatch(/excerpt\s+TEXT\s+NOT\s+NULL/i);
    expect(sql).toMatch(/length\(btrim\(excerpt\)\)\s*>\s*0/);
  });
});
