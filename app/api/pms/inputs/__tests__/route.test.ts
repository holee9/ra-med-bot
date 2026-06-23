// @MX:NOTE [AUTO] Source-level security structure tests for PMS API routes.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-006, REQ-PMS-008, REQ-PMS-009, REQ-PMS-010, REQ-PMS-012)
//
// These tests assert the error-handling and audit STRUCTURE that the security
// review required (same pattern as classify/run/__tests__/route.test.ts):
//   H2 — mutation + writeAudit ride the same db.transaction.
//   IDOR — org ownership enforced via withPermission + organizationId check.
//   REQ-PMS-012 — validation errors return 400 with safe messages.
//   REQ-PMS-010 — every mutation writes an audit_log row.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRoute(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('PMS inputs route — security structure (H2, IDOR, REQ-PMS-010/012)', () => {
  const src = readRoute('../route.ts');

  it('wraps mutation + audit in db.transaction (H2 atomicity)', () => {
    const txIdx = src.indexOf('db.transaction');
    const insertIdx = src.indexOf('.insert(pmsInputs)');
    const auditIdx = src.indexOf("action: 'pms.input_uploaded'");
    expect(txIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(txIdx);
    expect(auditIdx).toBeGreaterThan(insertIdx);
    // writeAudit must receive tx as the second argument — match the multiline
    // call from the action key to the standalone `tx,` closing argument.
    const auditCallBlock = src.slice(auditIdx);
    expect(auditCallBlock).toMatch(/action:\s*'pms.input_uploaded'[\s\S]*?tx,\s*\)/);
  });

  it('enforces organizationId before any mutation (IDOR defense)', () => {
    const orgCheckIdx = src.indexOf('session.user.organizationId');
    const insertIdx = src.indexOf('.insert(pmsInputs)');
    expect(orgCheckIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(orgCheckIdx);
    expect(src).toMatch(/Organization context required/);
  });

  it('validates project ownership before inserting PMS input', () => {
    const accessIdx = src.indexOf('assertPmsProjectAccess');
    const insertIdx = src.indexOf('.insert(pmsInputs)');
    expect(accessIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(accessIdx);
  });

  it('wraps the transaction in try/catch (audit failure = 500)', () => {
    const txIdx = src.indexOf('db.transaction');
    const catchIdx = src.indexOf('} catch (err)');
    expect(catchIdx).toBeGreaterThan(txIdx);
    const afterCatch = src.slice(catchIdx);
    expect(afterCatch).toMatch(/status:\s*500/);
  });

  it('returns 400 on validation failure (REQ-PMS-012)', () => {
    expect(src).toMatch(/Validation failed/);
    expect(src).toMatch(/status:\s*400/);
  });

  it('uses withPermission wrapper (RBAC enforcement)', () => {
    expect(src).toMatch(/withPermission\(/);
    expect(src).toMatch(/workflow\.execute/);
  });

  it('meta_json does NOT contain free-form complaint text (PII guard)', () => {
    // The audit meta must only carry structural fields, not raw payload.
    const metaStart = src.indexOf('meta_json: {');
    const metaEnd = src.indexOf('},', metaStart);
    const metaBlock = src.slice(metaStart, metaEnd);
    expect(metaBlock).not.toMatch(/payload/);
    expect(metaBlock).toMatch(/source/);
  });
});

describe('PMS report route — citation + CER linkage + audit (REQ-PMS-002/004/008/010)', () => {
  const src = readRoute('../../../workflows/pms-report/run/route.ts');

  it('calls executePmsReport with a retriever (citation grounding path)', () => {
    expect(src).toMatch(/executePmsReport/);
    expect(src).toMatch(/retrieveFn: retrievePmsReportSources/);
    expect(src).toMatch(/hybridSearch/);
  });

  it('validates project ownership before report execution and inserts', () => {
    const accessIdx = src.indexOf('assertPmsProjectAccess');
    const executeIdx = src.indexOf('executePmsReport');
    const insertIdx = src.indexOf('.insert(workflowRuns)');
    expect(accessIdx).toBeGreaterThanOrEqual(0);
    expect(executeIdx).toBeGreaterThan(accessIdx);
    expect(insertIdx).toBeGreaterThan(accessIdx);
  });

  it('writes pms.report_created audit inside the transaction', () => {
    expect(src).toMatch(/db\.transaction/);
    expect(src).toMatch(/action: 'pms.report_created'/);
  });

  it('writes pms.cer_linked audit when CER is linked (REQ-PMS-004)', () => {
    expect(src).toMatch(/action: 'pms.cer_linked'/);
    expect(src).toMatch(/result\.cerLinked/);
  });

  it('enforces organizationId before execution (IDOR)', () => {
    expect(src).toMatch(/Organization context required/);
  });

  it('wraps transaction in try/catch with 500 on failure', () => {
    const catchIdx = src.indexOf('} catch (err)');
    expect(catchIdx).toBeGreaterThan(0);
    expect(src.slice(catchIdx)).toMatch(/status:\s*500/);
  });
});

describe('PMCF plan route — checklist + audit (REQ-PMS-003/010)', () => {
  const src = readRoute('../../../workflows/pmcf-plan/run/route.ts');

  it('calls executePmcfPlan', () => {
    expect(src).toMatch(/executePmcfPlan/);
  });

  it('writes pmcf.plan_created audit inside the transaction', () => {
    expect(src).toMatch(/db\.transaction/);
    expect(src).toMatch(/action: 'pmcf.plan_created'/);
  });

  it('enforces organizationId (IDOR)', () => {
    expect(src).toMatch(/Organization context required/);
  });

  it('validates project ownership before PMCF plan execution and inserts', () => {
    const accessIdx = src.indexOf('assertPmsProjectAccess');
    const executeIdx = src.indexOf('executePmcfPlan');
    const insertIdx = src.indexOf('.insert(workflowRuns)');
    expect(accessIdx).toBeGreaterThanOrEqual(0);
    expect(executeIdx).toBeGreaterThan(accessIdx);
    expect(insertIdx).toBeGreaterThan(accessIdx);
  });
});

describe('PMCF evaluation route — assessment + audit (REQ-PMS-011/010)', () => {
  const src = readRoute('../../../workflows/pmcf-evaluation/run/route.ts');

  it('calls executePmcfEvaluation', () => {
    expect(src).toMatch(/executePmcfEvaluation/);
  });

  it('writes pmcf.evaluation_drafted audit inside the transaction', () => {
    expect(src).toMatch(/db\.transaction/);
    expect(src).toMatch(/action: 'pmcf.evaluation_drafted'/);
  });

  it('validates project ownership before PMCF evaluation execution and inserts', () => {
    const accessIdx = src.indexOf('assertPmsProjectAccess');
    const executeIdx = src.indexOf('executePmcfEvaluation');
    const insertIdx = src.indexOf('.insert(workflowRuns)');
    expect(accessIdx).toBeGreaterThanOrEqual(0);
    expect(executeIdx).toBeGreaterThan(accessIdx);
    expect(insertIdx).toBeGreaterThan(accessIdx);
  });
});

describe('Compliance route — Article 83-86 check + audit (REQ-PMS-007/010)', () => {
  const src = readRoute('../../[projectId]/compliance/route.ts');

  it('calls checkArticle83to86', () => {
    expect(src).toMatch(/checkArticle83to86/);
  });

  it('writes pms.compliance_checked audit', () => {
    expect(src).toMatch(/action: 'pms.compliance_checked'/);
  });

  it('enforces org-scoped query (IDOR via RLS + double-check)', () => {
    expect(src).toMatch(/eq\(pmsDocuments\.orgId, organizationId\)/);
    expect(src).toMatch(/eq\(pmsInputs\.orgId, organizationId\)/);
  });
});

describe('PMS project page — notFound control flow (IDOR)', () => {
  const src = readRoute('../../../../(app)/pms/[projectId]/page.tsx');

  it('does not call notFound inside the DB-unavailable catch block', () => {
    const lookupStart = src.indexOf('const projectRow = await db');
    const guardIdx = src.indexOf('if (!projectLookupFailed && !projectVisible)');
    expect(lookupStart).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeGreaterThan(lookupStart);
    expect(src.slice(lookupStart, guardIdx)).not.toMatch(/notFound\(\)/);
    expect(src.slice(guardIdx)).toMatch(/notFound\(\)/);
  });
});

describe('Registry — 3 PMS workflow entries (TASK-009)', () => {
  const src = readRoute('../../../../../lib/workflows/registry.ts');

  it('includes pms-report entry', () => {
    expect(src).toMatch(/id: 'pms-report'/);
    expect(src).toMatch(/MDCG 2022-21/);
  });

  it('includes pmcf-plan entry', () => {
    expect(src).toMatch(/id: 'pmcf-plan'/);
    expect(src).toMatch(/Annex XIV Part B/);
  });

  it('includes pmcf-evaluation entry', () => {
    expect(src).toMatch(/id: 'pmcf-evaluation'/);
  });
});
