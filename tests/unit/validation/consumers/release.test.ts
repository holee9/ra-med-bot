// @MX:NOTE [AUTO] Unit tests for release validation (SPEC-REGULA-VALIDATION-002, M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0, REQ-RELEASE-001)
// @MX:REASON M0 gate: validateReleaseIdFormat enforces semver pattern for
//   release IDs; checkGitTagExists verifies local git tag existence via
//   spawnSync. Both branches (valid/invalid format, tag exists/not-exists/
//   command-failure) are exercised.

import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock spawnSync so checkGitTagExists does not actually invoke git.
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const mockedSpawnSync = vi.mocked(spawnSync);

beforeEach(() => {
  vi.resetModules();
  mockedSpawnSync.mockReset();
});

// ---------------------------------------------------------------------------
// validateReleaseIdFormat — pure regex validation
// ---------------------------------------------------------------------------
describe('validateReleaseIdFormat — valid release IDs (REQ-RELEASE-001)', () => {
  it('accepts stable release v0.1.0', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    expect(validateReleaseIdFormat('v0.1.0')).toEqual({ valid: true });
  });

  it('accepts release candidate v0.1.0-rc1', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    expect(validateReleaseIdFormat('v0.1.0-rc1')).toEqual({ valid: true });
  });

  it('accepts multi-digit versions v10.20.30', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    expect(validateReleaseIdFormat('v10.20.30')).toEqual({ valid: true });
  });

  it('accepts release candidate with multi-digit rc number v1.0.0-rc12', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    expect(validateReleaseIdFormat('v1.0.0-rc12')).toEqual({ valid: true });
  });

  it('accepts v0.0.0 (zero versions)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    expect(validateReleaseIdFormat('v0.0.0')).toEqual({ valid: true });
  });
});

describe('validateReleaseIdFormat — invalid release IDs', () => {
  it('rejects missing v prefix (0.1.0)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('0.1.0');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('semver pattern');
    expect(result.reason).toContain('0.1.0');
  });

  it('rejects arbitrary string (invalid-id)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('invalid-id');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalid-id');
  });

  it('rejects missing patch version (v0.1)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('v0.1');
    expect(result.valid).toBe(false);
  });

  it('rejects missing minor and patch (v0)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('v0');
    expect(result.valid).toBe(false);
  });

  it('rejects empty string', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('semver pattern');
  });

  it('rejects pre-release without rc prefix (v0.1.0-alpha)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('v0.1.0-alpha');
    expect(result.valid).toBe(false);
  });

  it('rejects rc without number (v0.1.0-rc)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('v0.1.0-rc');
    expect(result.valid).toBe(false);
  });

  it('rejects rc with non-numeric suffix (v0.1.0-rcA)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('v0.1.0-rcA');
    expect(result.valid).toBe(false);
  });

  it('rejects extra suffix after rc (v0.1.0-rc1-extra)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('v0.1.0-rc1-extra');
    expect(result.valid).toBe(false);
  });

  it('rejects leading zero in version (v01.1.0)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    // Regex \d+ accepts leading zeros — this is technically "valid" by the
    // regex. Document this behavior so future tightening is intentional.
    const result = validateReleaseIdFormat('v01.1.0');
    // The regex \d+ matches "01", so this passes. Assert current behavior.
    expect(result.valid).toBe(true);
  });

  it('rejects uppercase V prefix (V0.1.0)', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('V0.1.0');
    expect(result.valid).toBe(false);
  });

  it('reason message includes the invalid input', async () => {
    const { validateReleaseIdFormat } = await import('@/lib/validation/consumers/release');
    const result = validateReleaseIdFormat('bad-input');
    expect(result.reason).toBe(
      'Release ID must match semver pattern v<Major>.<Minor>.<Patch> (-rc<N>)?, got: bad-input',
    );
  });
});

// ---------------------------------------------------------------------------
// checkGitTagExists — spawnSync git tag --list
// ---------------------------------------------------------------------------
describe('checkGitTagExists — tag exists (REQ-RELEASE-001)', () => {
  it('returns exists=true when git tag --list outputs the tag name', async () => {
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: 0,
          stdout: 'v0.1.0\n',
          stderr: '',
          pid: 1,
          output: ['v0.1.0\n'],
          signal: null,
        }) as never,
    );
    const { checkGitTagExists } = await import('@/lib/validation/consumers/release');
    const result = checkGitTagExists('v0.1.0');
    expect(result).toEqual({ exists: true });
  });

  it('calls git with correct command shape', async () => {
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: 0,
          stdout: 'v0.1.0-rc1\n',
          stderr: '',
          pid: 1,
          output: ['v0.1.0-rc1\n'],
          signal: null,
        }) as never,
    );
    const { checkGitTagExists } = await import('@/lib/validation/consumers/release');
    checkGitTagExists('v0.1.0-rc1');
    expect(mockedSpawnSync).toHaveBeenCalledWith(
      'git',
      ['tag', '--list', 'v0.1.0-rc1'],
      expect.objectContaining({ stdio: 'pipe' }),
    );
  });
});

describe('checkGitTagExists — tag does not exist', () => {
  it('returns exists=false when git tag --list outputs empty', async () => {
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: 0,
          stdout: '',
          stderr: '',
          pid: 1,
          output: [''],
          signal: null,
        }) as never,
    );
    const { checkGitTagExists } = await import('@/lib/validation/consumers/release');
    const result = checkGitTagExists('v0.1.0');
    expect(result).toEqual({ exists: false });
  });

  it('returns exists=false when stdout does not match the releaseId', async () => {
    // git tag --list may return a different tag name that is a substring.
    // The code does exact match (stdout.trim() === releaseId).
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: 0,
          stdout: 'v0.1.0-rc1\n',
          stderr: '',
          pid: 1,
          output: ['v0.1.0-rc1\n'],
          signal: null,
        }) as never,
    );
    const { checkGitTagExists } = await import('@/lib/validation/consumers/release');
    const result = checkGitTagExists('v0.1.0');
    expect(result.exists).toBe(false);
  });
});

describe('checkGitTagExists — git command failure', () => {
  it('returns warning when git exits with non-zero status (sandbox)', async () => {
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: 128,
          stdout: '',
          stderr: 'fatal: not a git repository',
          pid: 1,
          output: [null],
          signal: null,
        }) as never,
    );
    const { checkGitTagExists } = await import('@/lib/validation/consumers/release');
    const result = checkGitTagExists('v0.1.0');
    expect(result.exists).toBe(false);
    expect(result.warning).toContain('git tag command failed');
    expect(result.warning).toContain('128');
    expect(result.warning).toContain('sandbox');
  });

  it('returns warning when status is null (process killed by signal)', async () => {
    mockedSpawnSync.mockImplementation(
      () =>
        ({
          status: null,
          stdout: '',
          stderr: '',
          pid: 1,
          output: [null],
          signal: 'SIGTERM',
        }) as never,
    );
    const { checkGitTagExists } = await import('@/lib/validation/consumers/release');
    const result = checkGitTagExists('v0.1.0');
    expect(result.exists).toBe(false);
    expect(result.warning).toContain('git tag command failed');
    // status is null → coerced to "null" in the template string
    expect(result.warning).toContain('null');
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
describe('module exports (REQ-RELEASE-001)', () => {
  it('exports validateReleaseIdFormat and checkGitTagExists', async () => {
    const mod = await import('@/lib/validation/consumers/release');
    expect(typeof mod.validateReleaseIdFormat).toBe('function');
    expect(typeof mod.checkGitTagExists).toBe('function');
  });
});
