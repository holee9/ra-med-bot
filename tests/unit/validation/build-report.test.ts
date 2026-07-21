// @MX:NOTE [AUTO] Unit tests for build-report.ts Markdown assembly (SPEC-REGULA-VALIDATION-001 M5).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-010, AC-6, Issue #49)
// @MX:REASON AC-6 gate: report must contain at least 8 sections (## headings).
//   Tests cover section count + presence of each canonical heading.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist-safe mock state — vi.mock factories run before top-level const inits.
const selectFromWhereMock = vi.hoisted(() => vi.fn());
const evaluateRerunGateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectFromWhereMock })) })),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
  inArray: (a: unknown, b: unknown[]) => ({ type: 'inArray', a, b }),
}));

vi.mock('@/lib/kernel/db/schema', () => ({
  validationEvidence: {
    releaseId: 'release_id',
    qualificationType: 'qualification_type',
    testCommand: 'test_command',
    commitSha: 'commit_sha',
    ciRunId: 'ci_run_id',
    artifactPath: 'artifact_path',
    result: 'result',
  },
  changeControl: {
    releaseId: 'release_id',
    changeAxis: 'change_axis',
    impactLevel: 'impact_level',
    rerunRequired: 'rerun_required',
    residualRisk: 'residual_risk',
    exceptionNote: 'exception_note',
  },
}));

vi.mock('@/lib/validation/rerun-gate', () => ({
  evaluateRerunGate: evaluateRerunGateMock,
}));

// M3: consumer snapshots mocked to real-shaped data (AC-4/5 real-data sections).
const snapshotTraceabilityMock = vi.hoisted(() => vi.fn());
const snapshotSourceGovernanceMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/validation/consumers/index', () => ({
  snapshotTraceability: snapshotTraceabilityMock,
  snapshotSourceGovernance: snapshotSourceGovernanceMock,
  checkGitTagExists: vi.fn(() => ({ exists: true })),
  validateReleaseIdFormat: vi.fn(() => ({ valid: true })),
}));

import { buildReleaseReportMarkdown } from '@/scripts/validation/build-report';

describe('Release Validation Report builder (M5, AC-6)', () => {
  beforeEach(() => {
    selectFromWhereMock.mockReset();
    evaluateRerunGateMock.mockReset();
    snapshotTraceabilityMock.mockReset();
    snapshotSourceGovernanceMock.mockReset();
    // M3: REGULA_ORG_ID required by render*Section (empty → snapshot unavailable).
    process.env.REGULA_ORG_ID = '00000000-0000-0000-0000-000000000001';
    // Default: realistic snapshots so AC-4/5 render real counts.
    snapshotTraceabilityMock.mockResolvedValue({ totalRows: 5, withGaps: 2, stale: 1 });
    snapshotSourceGovernanceMock.mockResolvedValue({
      counts: { approved: 10, pendingReview: 3, stale: 1, superseded: 2 },
      reviewDue: [],
      staleCitationArtifacts: [],
    });
  });

  it('AC-6: emits at least 8 "## " section headings', async () => {
    // First selectFromWhere (evidence) — second (change_control)
    selectFromWhereMock.mockResolvedValueOnce([
      {
        qualificationType: 'iq',
        testCommand: 'pnpm ci:migrations',
        commitSha: 'abc1234567',
        ciRunId: 42,
        artifactPath: null,
        result: 'pass',
      },
    ]);
    selectFromWhereMock.mockResolvedValueOnce([
      {
        changeAxis: 'model',
        impactLevel: 'high',
        rerunRequired: true,
        residualRisk: 'mitigated by OQ evidence',
        exceptionNote: null,
      },
    ]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    const md = await buildReleaseReportMarkdown('v0.1.0-rc1');
    const sectionCount = (md.match(/^## /gm) ?? []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(8);
  });

  it('contains all canonical section headings', async () => {
    selectFromWhereMock.mockResolvedValueOnce([]);
    selectFromWhereMock.mockResolvedValueOnce([]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    const md = await buildReleaseReportMarkdown('v0.1.0-rc1');
    expect(md).toContain('# Release Validation Report — v0.1.0-rc1');
    expect(md).toContain('## Intended Use');
    expect(md).toContain('## IQ Evidence');
    expect(md).toContain('## OQ Evidence');
    expect(md).toContain('## PQ Evidence');
    expect(md).toContain('## Change Control');
    expect(md).toContain('## Release Scope Status (#31-#34)');
    expect(md).toContain('## Traceability Status (#47)');
    expect(md).toContain('## Sign-off Checklist');
  });

  it('renders evidence rows in IQ/OQ/PQ tables', async () => {
    selectFromWhereMock.mockResolvedValueOnce([
      {
        qualificationType: 'iq',
        testCommand: 'pnpm ci:migrations',
        commitSha: 'deadbeef',
        ciRunId: 100,
        artifactPath: null,
        result: 'pass',
      },
      {
        qualificationType: 'oq',
        testCommand: 'pnpm ci:test',
        commitSha: 'deadbeef',
        ciRunId: 101,
        artifactPath: 'logs/vitest.xml',
        result: 'pass',
      },
    ]);
    selectFromWhereMock.mockResolvedValueOnce([]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    const md = await buildReleaseReportMarkdown('v0.1.0-rc1');
    expect(md).toContain('pnpm ci:migrations');
    expect(md).toContain('pnpm ci:test');
    expect(md).toContain('logs/vitest.xml');
  });

  it('reports rerun-gate blocked state in Change Control section', async () => {
    selectFromWhereMock.mockResolvedValueOnce([]);
    selectFromWhereMock.mockResolvedValueOnce([
      {
        changeAxis: 'prompt',
        impactLevel: 'high',
        rerunRequired: true,
        residualRisk: 'pending rerun',
        exceptionNote: null,
      },
    ]);
    evaluateRerunGateMock.mockResolvedValueOnce({
      passed: false,
      failed: [{ axis: 'prompt', reason: 'change_control:prompt:rerun_required' }],
    });

    const md = await buildReleaseReportMarkdown('v0.1.0-rc1');
    expect(md).toContain('Rerun gate: **blocked**');
    expect(md).toContain('prompt');
  });

  it('checklist section reflects unmet items when evidence missing', async () => {
    selectFromWhereMock.mockResolvedValueOnce([]); // no evidence
    selectFromWhereMock.mockResolvedValueOnce([]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    const md = await buildReleaseReportMarkdown('v0.1.0-rc1');
    expect(md).toContain('Sign-off Checklist');
    // Three evidence rows + changes + report (reportExported always true since
    // build-report is the writer).
    expect(md).toContain('iq:pass');
    expect(md).toContain('oq:pass');
    expect(md).toContain('pq:pass');
    expect(md).toContain('unmet');
  });

  it('AC-4/5/6/7: real-data sections (no Stub), Review Ops not implemented + #36', async () => {
    selectFromWhereMock.mockResolvedValueOnce([
      {
        qualificationType: 'iq',
        testCommand: 'pnpm ci:typecheck',
        commitSha: 'abc',
        ciRunId: 1,
        artifactPath: null,
        result: 'pass',
      },
      {
        qualificationType: 'oq',
        testCommand: 'pnpm ci:test',
        commitSha: 'abc',
        ciRunId: 2,
        artifactPath: null,
        result: 'pass',
      },
      {
        qualificationType: 'pq',
        testCommand: 'pnpm test:e2e',
        commitSha: 'abc',
        ciRunId: 3,
        artifactPath: null,
        result: 'pass',
      },
    ]);
    selectFromWhereMock.mockResolvedValueOnce([]);
    evaluateRerunGateMock.mockResolvedValueOnce({ passed: true, failed: [] });

    const md = await buildReleaseReportMarkdown('v0.1.0-rc1');
    // AC-4: Traceability section — real snapshot counts.
    expect(md).toContain('totalRows');
    expect(md).toContain('withGaps');
    expect(md).toContain('stale');
    // AC-5: Source Governance section — dashboard counts.
    expect(md).toContain('approved');
    expect(md).toContain('superseded');
    // AC-6: Release Scope section — IQ/OQ/PQ evidence labels.
    expect(md).toContain('IQ evidence');
    expect(md).toContain('OQ evidence');
    expect(md).toContain('PQ evidence');
    // AC-7: Review Ops section — "not implemented" + #36.
    expect(md).toContain('not implemented');
    expect(md).toContain('#36');
    // DoD §8: "**Stub**" must not appear.
    expect(md).not.toContain('**Stub**');
  });
});
