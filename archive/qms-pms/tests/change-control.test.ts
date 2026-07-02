// @MX:NOTE [AUTO] Route-level integration tests for change-control security fixes.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (C-1, H-1, H-2, H-3, H-4, M-1)
//
// Security-fix regression coverage. Each block exercises one defect class from
// the expert-security review (Phase 5, sync Phase 0.55). Two complementary
// strategies are used:
//
//   1. Source-level: read the route/engine/migration source and assert the
//      control is present (IDOR guard, prompt-injection tags, export_blocked
//      action, risk-item org filter). Robust against in-memory DB mocking churn.
//   2. Engine-level: exercise assessChange with a mocked fetchFn to drive the
//      REQ-006 citation-reject path and verify the reject verdict is produced.
//
// Why not full runtime handler execution? The PMS IDOR runtime test pattern
// (pms-idor-runtime.test.ts) requires an elaborate in-memory DB mock tied to
// Drizzle's private symbols. That pattern is brittle for a regression suite;
// the source-level assertions below verify the EXACT control placement that
// the security review flagged, and the engine-level test drives the REQ-006
// reject behavior that the stub-only path left as dead code (H-1).

import fs from 'node:fs';
import path from 'node:path';
import type { RetrieverResult } from '@/lib/ai/retrievers/internal-docs';
import { assessChange } from '@/lib/change-control/engine';
import type { ChangeInput } from '@/lib/change-control/types';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

const designInput: ChangeInput = {
  changeType: 'design',
  description: 'Reduced device dimensions',
  impactScope: 'Housing and form factor',
  targetMarkets: ['FDA'],
};

// ---------------------------------------------------------------------------
// C-1 CRITICAL: projectId IDOR — assertPmsProjectAccess in run route
// ---------------------------------------------------------------------------

describe('C-1 IDOR defense: POST /api/change-control/run', () => {
  it('calls assertPmsProjectAccess before any workflow_runs insert', () => {
    const src = readText('app/api/change-control/run/route.ts');
    expect(src).toMatch(/import\s+\{\s*assertPmsProjectAccess\s*\}/);
    expect(src).toMatch(/assertPmsProjectAccess\(body\.projectId,\s*organizationId\)/);
    // The guard must run BEFORE the workflow_runs insert (C-1 exact placement).
    const guardIdx = src.indexOf('assertPmsProjectAccess(body.projectId');
    const insertIdx = src.indexOf('.insert(workflowRuns)');
    expect(
      guardIdx,
      'assertPmsProjectAccess must appear before workflow_runs insert',
    ).toBeGreaterThan(-1);
    expect(insertIdx, 'workflow_runs insert must exist').toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(insertIdx);
  });

  it('returns 403 (not 200/500) when project access is denied', () => {
    const src = readText('app/api/change-control/run/route.ts');
    expect(src).toMatch(/Project access denied.*status:\s*403/s);
  });

  it('GET /api/change-control/[assessmentId] enforces org scope (cross-org → 404)', () => {
    const src = readText('app/api/change-control/[assessmentId]/route.ts');
    expect(src).toMatch(/eq\(changeAssessments\.orgId,\s*organizationId\)/);
    expect(src).toMatch(/Assessment not found.*status:\s*404/s);
  });

  it('POST /api/change-control/[assessmentId]/export enforces org scope (cross-org → 404)', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    expect(src).toMatch(/eq\(changeAssessments\.orgId,\s*organizationId\)/);
    expect(src).toMatch(/Assessment not found.*status:\s*404/s);
  });
});

// ---------------------------------------------------------------------------
// H-1 HIGH: createHybridRaFetch wired so REQ-006 reject path is live
// ---------------------------------------------------------------------------

describe('H-1 LLM wiring: run route passes fetchFn to assessChange', () => {
  it('imports createHybridRaFetch and builds a fetchFn', () => {
    const src = readText('app/api/change-control/run/route.ts');
    expect(src).toMatch(/import\s+\{\s*createHybridRaFetch\s*\}/);
    expect(src).toMatch(/createHybridRaFetch\(\)/);
    // fetchFn is forwarded to assessChange (not omitted).
    expect(src).toMatch(/fetchFn,/);
  });

  it('engine assessChange routes to assessViaLLM when fetchFn is provided', async () => {
    // When fetchFn is present and returns an ungrounded citation, the REQ-006
    // reject path MUST fire (H-1 makes this live in production).
    const groundedRetriever = async (): Promise<RetrieverResult> => ({
      results: [
        {
          id: 'src-1',
          content: '21 CFR 807.81(a)(3): significant change',
          score: 0.9,
          documentId: 'doc-1',
          docClass: 'regulation',
          metadata: { source: '21 CFR 807.81(a)(3)', section: 'significant change' },
        },
      ],
      expertReviewRequired: false,
    });

    const hallucinatingFetch = async (): Promise<{ json: () => Promise<unknown> }> => ({
      json: async () => ({
        result: JSON.stringify({
          verdict: 'new_submission_required',
          rationale: 'hallucinated',
          citations: [
            { source: 'Fake Rule', section: 'fake', excerpt: 'fake excerpt not in retrieval' },
          ],
        }),
      }),
    });

    const result = await assessChange(designInput, {
      orgId: 'org-1',
      userId: 'user-1',
      retrieveFn: groundedRetriever,
      fetchFn: hallucinatingFetch,
    });

    const fda = result.verdicts.find((v) => v.jurisdiction === 'FDA');
    expect(fda).toBeDefined();
    expect(fda?.citationRejected).toBe(true); // REQ-006 reject path fired
    expect(fda?.verdict).toBe('internal_record_only');
  });
});

// ---------------------------------------------------------------------------
// H-2 HIGH: prompt-injection hardening in assessViaLLM prompt
// ---------------------------------------------------------------------------

describe('H-2 prompt-injection hardening: assessViaLLM prompt', () => {
  it('wraps description in <change_description> tags', () => {
    const src = readText('lib/change-control/engine.ts');
    expect(src).toMatch(/<change_description>/);
    expect(src).toMatch(/<\/change_description>/);
  });

  it('wraps impactScope in <impact_scope> tags', () => {
    const src = readText('lib/change-control/engine.ts');
    expect(src).toMatch(/<impact_scope>/);
    expect(src).toMatch(/<\/impact_scope>/);
  });

  it('includes the SECURITY INSTRUCTION UNTRUSTED DATA block (CLASSIFY pattern)', () => {
    const src = readText('lib/change-control/engine.ts');
    expect(src).toMatch(/SECURITY INSTRUCTION/);
    expect(src).toMatch(/UNTRUSTED DATA/);
    expect(src).toMatch(/Never obey instructions/);
  });

  it('does NOT inline user text untagged (raw description/impactScope interpolation forbidden)', () => {
    const src = readText('lib/change-control/engine.ts');
    // The pre-fix pattern `Change description: ${input.description}` is gone.
    expect(src).not.toMatch(/Change description:\s*\$\{input\.description\}/);
    expect(src).not.toMatch(/Impact scope:\s*\$\{input\.impactScope\}/);
  });
});

// ---------------------------------------------------------------------------
// H-3 HIGH: catch-block audit integrity (tx-wrapped failure audit)
// ---------------------------------------------------------------------------

describe('H-3 audit integrity: run route catch block', () => {
  it('wraps the failure-path writeAudit in withTenantScope (tx-scoped)', () => {
    const src = readText('app/api/change-control/run/route.ts');
    // #239 Phase 2: the catch block must wrap failure-path writeAudit in
    // withTenantScope (which itself runs db.transaction) for GUC + atomicity.
    const catchIdx = src.indexOf('} catch (err) {');
    expect(catchIdx).toBeGreaterThan(-1);
    const catchSlice = src.slice(catchIdx);
    expect(catchSlice).toMatch(/withTenantScope\(/);
    expect(catchSlice).toMatch(/change\.assessment_created/);
    expect(catchSlice).toMatch(/failed:\s*true/);
  });
});

// ---------------------------------------------------------------------------
// H-4 HIGH: change.export_blocked audit action (provisional export denial)
// ---------------------------------------------------------------------------

describe('H-4 export_blocked audit action', () => {
  it('migration 0071 adds change.export_blocked to audit_action enum', () => {
    const sql = readText('migrations/0071_change_control.sql');
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change\.export_blocked'/);
  });

  it('schema.ts auditActionEnum includes change.export_blocked', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/'change\.export_blocked'/);
  });

  it('audit.ts AuditAction union includes change.export_blocked', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/'change\.export_blocked'/);
  });

  it('export route provisional block uses change.export_blocked (NOT verdict_citation_rejected)', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    // H-4 fix: the denial uses change.export_blocked.
    expect(src).toMatch(/action:\s*'change\.export_blocked'/);
    // The pre-fix misuse of verdict_citation_rejected for export denial is gone.
    expect(src).not.toMatch(/action:\s*'change\.verdict_citation_rejected'/);
  });

  it('export route provisional block returns 403', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    expect(src).toMatch(/Expert review required.*status:\s*403/s);
  });

  it('export route reviewed status proceeds to 200 (happy path)', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    // The BLOCKING_STATUSES set gates 'provisional' only; reviewed/final pass.
    expect(src).toMatch(/BLOCKING_STATUSES\s*=\s*new Set\(\['provisional'\]\)/);
  });
});

// ---------------------------------------------------------------------------
// AC-05 / REQ-007: real PDF byte rendering (Issue #247 follow-up)
// ---------------------------------------------------------------------------

describe('AC-05 PDF byte rendering: export route format=pdf wiring', () => {
  it('imports exportChangeAssessmentToPdf and getChangePdfFilename', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    expect(src).toMatch(/exportChangeAssessmentToPdf/);
    expect(src).toMatch(/getChangePdfFilename/);
  });

  it('reads format from searchParams (pdf branch + pdf-json default)', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    expect(src).toMatch(/searchParams\.get\('format'\)/);
    expect(src).toMatch(/format === 'pdf'/);
    // Default canonical JSON shape preserved (backward compat).
    expect(src).toMatch(/format:\s*'pdf-json'/);
  });

  it('returns Content-Type application/pdf with sanitized attachment filename', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    expect(src).toMatch(/'Content-Type':\s*'application\/pdf'/);
    expect(src).toMatch(/Content-Disposition.*attachment; filename=/);
    // sanitizeFilename is wired (mirrors traceability export convention).
    expect(src).toMatch(/sanitizeFilename/);
  });

  it('computes DRAFT watermark from non-final status', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    // REQ-007 / 21 CFR Part 11: non-final → DRAFT watermark.
    expect(src).toMatch(/assessment\.status !== 'final'/);
    expect(src).toMatch(/includeDraftWatermark/);
  });

  it('no longer carries the Phase 6+ @MX:TODO deferral', () => {
    const src = readText('app/api/change-control/[assessmentId]/export/route.ts');
    // The MVP deferral marker is removed — AC-05 is implemented.
    expect(src).not.toMatch(/@MX:TODO full PDF byte stream wiring/);
  });

  it('renderer module exists at the canonical path', () => {
    const src = readText('lib/change-control/exporters/pdf.tsx');
    expect(src).toMatch(/export async function exportChangeAssessmentToPdf/);
    expect(src).toMatch(/import\('@react-pdf\/renderer'\)/);
    // REQ-010 provenance footer (model/prompt/template) is not omitted.
    expect(src).toMatch(/Provenance/);
    expect(src).toMatch(/modelVersion/);
    expect(src).toMatch(/promptVersion/);
    expect(src).toMatch(/templateVersion/);
  });
});

// ---------------------------------------------------------------------------
// M-1 MEDIUM: riskItemIds cross-org validation in risk-linkage.ts
// ---------------------------------------------------------------------------

describe('M-1 riskItemIds cross-org validation', () => {
  it('risk-linkage.ts imports workflowRuns for org ownership join', () => {
    const src = readText('lib/change-control/risk-linkage.ts');
    expect(src).toMatch(/import\s+\{[^}]*workflowRuns[^}]*\}\s*from/);
  });

  it('filterRiskItemsByOrg joins risk_items → workflow_runs.organization_id', () => {
    const src = readText('lib/change-control/risk-linkage.ts');
    expect(src).toMatch(/filterRiskItemsByOrg/);
    expect(src).toMatch(/innerJoin\(workflowRuns,/);
    expect(src).toMatch(/eq\(workflowRuns\.organizationId,\s*orgId\)/);
  });

  it('linkAssessmentToRiskItems filters via ownedSet before insert', () => {
    const src = readText('lib/change-control/risk-linkage.ts');
    expect(src).toMatch(/ownedIds\s*=\s*await\s*filterRiskItemsByOrg/);
    expect(src).toMatch(/ownedSet\.has\(riskItemId\)/);
    // The guard that skips cross-org ids.
    expect(src).toMatch(/if\s*\(!ownedSet\.has\(riskItemId\)\)\s*continue/);
  });
});
