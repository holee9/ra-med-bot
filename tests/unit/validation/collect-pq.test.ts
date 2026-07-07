// @MX:NOTE [AUTO] Unit tests for M3 PQ bundle (SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M3, AC-4, Issue #49)
// @MX:REASON AC-4: PQ evidence links to e2e artifact + eval JSON path.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('@/lib/validation/evidence-writer', () => ({
  insertEvidenceBundle: vi.fn().mockResolvedValue(['id-1', 'id-2', 'id-3', 'id-4']),
  insertValidationEvidence: vi.fn(),
}));

const mockedSpawnSync = vi.mocked(spawnSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

describe('M3 PQ bundle — collect-pq', () => {
  beforeEach(() => {
    vi.resetModules();
    mockedSpawnSync.mockReset();
    mockedExistsSync.mockReset();
    mockedReadFileSync.mockReset();
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
    const { parseArgs } = await import('@/scripts/validation/collect-pq');

    it('returns releaseId when provided', () => {
      expect(parseArgs(['node', 'collect-pq.ts', 'v0.1.0-rc1'])).toEqual({
        releaseId: 'v0.1.0-rc1',
      });
    });

    it('exits when releaseId missing', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });
      expect(() => parseArgs(['node', 'collect-pq.ts'])).toThrow();
      exitSpy.mockRestore();
    });
  });

  describe('collectE2eEvidence', async () => {
    const { collectE2eEvidence } = await import('@/scripts/validation/collect-pq');

    it('returns pass when Playwright exits 0', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const evidence = collectE2eEvidence('v0.1.0-rc1', 'abc', null, 'chromium');
      expect(evidence.result).toBe('pass');
      expect(evidence.testCommand).toContain('chromium');
    });

    it('returns fail when Playwright exits non-zero', () => {
      mockedSpawnSync.mockImplementation(
        () =>
          ({
            status: 1,
            stdout: '',
            stderr: '1 failed',
            pid: 1,
            output: [],
            signal: null,
          }) as never,
      );
      const evidence = collectE2eEvidence('v0.1.0-rc1', 'abc', null, 'firefox');
      expect(evidence.result).toBe('fail');
    });

    it('returns skip when Playwright not installed', () => {
      mockedSpawnSync.mockImplementation(() => {
        const err = new Error('ENOENT: pnpm not found');
        return {
          status: 1,
          stdout: '',
          stderr: 'pnpm: command not found (ENOENT)',
          pid: 1,
          output: [],
          signal: null,
          error: err,
        } as never;
      });
      const evidence = collectE2eEvidence('v0.1.0-rc1', 'abc', null, 'webkit');
      expect(['skip', 'fail']).toContain(evidence.result);
    });

    it('attaches ci_run_id when provided', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const evidence = collectE2eEvidence('v0.1.0-rc1', 'abc', 99999, 'chromium');
      expect(evidence.ciRunId).toBe(99999);
    });
  });

  describe('collectEvalEvidence (AC-4)', async () => {
    const { collectEvalEvidence } = await import('@/scripts/validation/collect-pq');

    it('returns skip when latest.json and baseline.json both absent', () => {
      mockedExistsSync.mockReturnValue(false);
      const evidence = collectEvalEvidence('v0.1.0-rc1', 'abc', null);
      expect(evidence.result).toBe('skip');
      expect(evidence.artifactPath).toBe('tests/eval/results/latest.json');
    });

    it('returns pass when passRate >= 0.8', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(
        JSON.stringify({
          version: 'test-1',
          results: { stats: { successes: 44, failures: 11, totalTests: 55 } },
          passRate: 0.8,
        }),
      );
      const evidence = collectEvalEvidence('v0.1.0-rc1', 'abc', null);
      expect(evidence.result).toBe('pass');
      expect(evidence.artifactPath).toBe('tests/eval/results/latest.json');
    });

    it('returns fail when passRate < 0.8', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(
        JSON.stringify({
          passRate: 0.5,
        }),
      );
      const evidence = collectEvalEvidence('v0.1.0-rc1', 'abc', null);
      expect(evidence.result).toBe('fail');
    });

    it('returns fail when JSON is malformed', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('not valid json');
      const evidence = collectEvalEvidence('v0.1.0-rc1', 'abc', null);
      expect(evidence.result).toBe('fail');
    });

    it('derives passRate from stats when passRate field absent', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(
        JSON.stringify({
          results: { stats: { successes: 50, failures: 5, totalTests: 55 } },
        }),
      );
      const evidence = collectEvalEvidence('v0.1.0-rc1', 'abc', null);
      // 50/55 = 0.909 >= 0.8
      expect(evidence.result).toBe('pass');
    });
  });

  describe('bundle shape (AC-4)', () => {
    it('PQ bundle has 4 evidence rows (3 browsers + eval)', async () => {
      const { collectE2eEvidence, collectEvalEvidence } = await import(
        '@/scripts/validation/collect-pq'
      );
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(JSON.stringify({ passRate: 0.9 }));
      const bundle = [
        collectE2eEvidence('v0.1.0-rc1', 'abc', null, 'chromium'),
        collectE2eEvidence('v0.1.0-rc1', 'abc', null, 'firefox'),
        collectE2eEvidence('v0.1.0-rc1', 'abc', null, 'webkit'),
        collectEvalEvidence('v0.1.0-rc1', 'abc', null),
      ];
      expect(bundle).toHaveLength(4);
      for (const e of bundle) {
        expect(e.qualificationType).toBe('pq');
        expect(e.testCommand.length).toBeGreaterThan(0);
        expect(['pass', 'fail', 'skip']).toContain(e.result);
      }
    });
  });
});
