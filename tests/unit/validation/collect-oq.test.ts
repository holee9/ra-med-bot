// @MX:NOTE [AUTO] Unit tests for M2 OQ aggregator (SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M2, AC-3, Issue #49)
// @MX:REASON AC-3 gate: OQ evidence ci_run_id MUST equal GitHub Actions databaseId.

import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('@/lib/validation/evidence-writer', () => ({
  insertEvidenceBundle: vi.fn().mockResolvedValue(['id-1', 'id-2', 'id-3']),
  insertValidationEvidence: vi.fn(),
}));

const mockedSpawnSync = vi.mocked(spawnSync);

describe('M2 OQ aggregator — collect-oq', () => {
  beforeEach(() => {
    vi.resetModules();
    mockedSpawnSync.mockReset();
    // Default: git rev-parse HEAD succeeds.
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: 0,
          stdout: 'abc1234\n',
          stderr: '',
          pid: 1,
          output: ['abc1234\n'],
          signal: null,
        }) as never,
    );
  });

  describe('parseArgs', async () => {
    const { parseArgs } = await import('@/scripts/validation/collect-oq');

    it('returns releaseId when provided', () => {
      expect(parseArgs(['node', 'collect-oq.ts', 'v0.1.0-rc1'])).toEqual({
        releaseId: 'v0.1.0-rc1',
      });
    });

    it('exits when releaseId missing', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });
      expect(() => parseArgs(['node', 'collect-oq.ts'])).toThrow();
      exitSpy.mockRestore();
    });
  });

  describe('mapConclusion', async () => {
    const { mapConclusion } = await import('@/scripts/validation/collect-oq');

    it('maps success → pass', () => {
      expect(mapConclusion('success')).toBe('pass');
    });

    it('maps failure → fail', () => {
      expect(mapConclusion('failure')).toBe('fail');
    });

    it('maps cancelled → fail', () => {
      expect(mapConclusion('cancelled')).toBe('fail');
    });

    it('maps timed_out → fail', () => {
      expect(mapConclusion('timed_out')).toBe('fail');
    });

    it('maps null/unknown → skip', () => {
      expect(mapConclusion(null)).toBe('skip');
      expect(mapConclusion(undefined)).toBe('skip');
      expect(mapConclusion('weird-state')).toBe('skip');
    });
  });

  describe('collectCiRunEvidence (AC-3)', async () => {
    const { collectCiRunEvidence } = await import('@/scripts/validation/collect-oq');

    it('records ci_run_id from GitHub Actions databaseId when CI run found', () => {
      const evidence = collectCiRunEvidence('v0.1.0-rc1', 'abc123', {
        databaseId: 9876543210,
        headSha: 'abc123',
        conclusion: 'success',
        htmlUrl: 'https://github.com/o/r/actions/runs/9876543210',
      });
      // AC-3: ci_run_id MUST equal the GitHub Actions databaseId.
      expect(evidence.ciRunId).toBe(9876543210);
      expect(evidence.result).toBe('pass');
      expect(evidence.artifactPath).toContain('9876543210');
    });

    it('records skip when CI run unavailable (local dev)', () => {
      const evidence = collectCiRunEvidence('v0.1.0-rc1', 'abc123', null);
      expect(evidence.ciRunId).toBeNull();
      expect(evidence.result).toBe('skip');
    });

    it('records fail when CI conclusion is failure', () => {
      const evidence = collectCiRunEvidence('v0.1.0-rc1', 'abc123', {
        databaseId: 12345,
        headSha: 'abc123',
        conclusion: 'failure',
        htmlUrl: 'https://github.com/o/r/actions/runs/12345',
      });
      expect(evidence.result).toBe('fail');
    });
  });

  describe('collectRbacEvidence', async () => {
    const { collectRbacEvidence } = await import('@/scripts/validation/collect-oq');

    it('returns pass when ci:rbac exits 0', () => {
      mockedSpawnSync.mockImplementation((_cmd, _args) => {
        const args = _args as string[];
        if (args.includes('ci:rbac')) {
          return { status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null } as never;
        }
        return { status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null } as never;
      });
      const evidence = collectRbacEvidence('v0.1.0-rc1', 'abc123', null);
      expect(evidence.result).toBe('pass');
      expect(evidence.testCommand).toBe('pnpm ci:rbac');
    });

    it('attaches ci_run_id when available', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const evidence = collectRbacEvidence('v0.1.0-rc1', 'abc123', {
        databaseId: 777,
        headSha: 'abc',
        conclusion: 'success',
        htmlUrl: 'https://example.com/runs/777',
      });
      expect(evidence.ciRunId).toBe(777);
    });
  });
});
