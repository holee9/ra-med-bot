// @MX:NOTE [AUTO] Unit tests for M4 change-control impact assessment (SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M4, AC-5, Issue #49)
// @MX:REASON AC-5: high-impact + rerun 부재 시 차단. Tests cover classifier
//   impact_level + rerun_required logic + rerun-gate evaluation.

import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'cc-1' }]),
      })),
    })),
  },
}));

const mockedSpawnSync = vi.mocked(spawnSync);

describe('M4 change-control — classify-changes', () => {
  beforeEach(() => {
    vi.resetModules();
    mockedSpawnSync.mockReset();
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
    const { parseArgs } = await import('@/scripts/validation/classify-changes');

    it('returns releaseId + undefined previousRef when only releaseId given', () => {
      expect(parseArgs(['node', 'classify.ts', 'v0.1.0-rc1'])).toEqual({
        releaseId: 'v0.1.0-rc1',
        previousRef: undefined,
      });
    });

    it('returns previousRef when provided', () => {
      expect(parseArgs(['node', 'classify.ts', 'v0.1.0-rc1', 'v0.1.0-rc0'])).toEqual({
        releaseId: 'v0.1.0-rc1',
        previousRef: 'v0.1.0-rc0',
      });
    });

    it('exits when releaseId missing', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });
      expect(() => parseArgs(['node', 'classify.ts'])).toThrow();
      exitSpy.mockRestore();
    });
  });

  describe('classifyGitDiffAxis', async () => {
    const { classifyGitDiffAxis } = await import('@/scripts/validation/classify-changes');

    it('returns low when no commits found (no previousRef)', () => {
      const result = classifyGitDiffAxis('retrieval', undefined, ['lib/ai/retrievers/']);
      expect(result.impactLevel).toBe('low');
      expect(result.rerunRequired).toBe(false);
    });

    it('returns low when 0 commits in diff', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '0\n', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const result = classifyGitDiffAxis('retrieval', 'v0.1.0-rc0', ['lib/ai/retrievers/']);
      expect(result.impactLevel).toBe('low');
    });

    it('returns medium when 1-2 commits', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '2\n', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const result = classifyGitDiffAxis('export', 'v0.1.0-rc0', ['lib/export/']);
      expect(result.impactLevel).toBe('medium');
      expect(result.rerunRequired).toBe(false);
    });

    it('returns high + rerunRequired when >= 3 commits', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '5\n', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const result = classifyGitDiffAxis('review_workflow', 'v0.1.0-rc0', ['lib/ai/expert-review']);
      expect(result.impactLevel).toBe('high');
      expect(result.rerunRequired).toBe(true);
    });
  });

  describe('classifySchemaAxis', async () => {
    const { classifySchemaAxis } = await import('@/scripts/validation/classify-changes');

    it('returns high + rerunRequired when new migrations present', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '3\n', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const result = classifySchemaAxis('v0.1.0-rc0');
      expect(result.impactLevel).toBe('high');
      expect(result.rerunRequired).toBe(true);
    });

    it('returns low when no migration diff', () => {
      mockedSpawnSync.mockImplementation(
        () => ({ status: 0, stdout: '0\n', stderr: '', pid: 1, output: [], signal: null }) as never,
      );
      const result = classifySchemaAxis('v0.1.0-rc0');
      expect(result.impactLevel).toBe('low');
    });
  });
});
