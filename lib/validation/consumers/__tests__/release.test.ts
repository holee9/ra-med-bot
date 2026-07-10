// @MX:NOTE [AUTO] Unit tests for release validation consumer (SPEC-REGULA-VALIDATION-002 M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkGitTagExists, validateReleaseIdFormat } from '../release';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

describe('validateReleaseIdFormat', () => {
  it('should accept stable release format v0.1.0', () => {
    const result = validateReleaseIdFormat('v0.1.0');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should accept release candidate format v0.1.0-rc1', () => {
    const result = validateReleaseIdFormat('v0.1.0-rc1');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should accept release candidate format v1.2.3-rc42', () => {
    const result = validateReleaseIdFormat('v1.2.3-rc42');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should reject invalid-id without v prefix', () => {
    const result = validateReleaseIdFormat('invalid-id');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must match semver pattern');
    expect(result.reason).toContain('invalid-id');
  });

  it('should reject v0.1 missing patch version', () => {
    const result = validateReleaseIdFormat('v0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must match semver pattern');
  });

  it('should reject 0.1.0 missing v prefix', () => {
    const result = validateReleaseIdFormat('0.1.0');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must match semver pattern');
  });

  it('should reject empty string', () => {
    const result = validateReleaseIdFormat('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must match semver pattern');
  });
});

describe('checkGitTagExists (spawnSync mock, coverage 402)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exists:true when `git tag --list` outputs the releaseId', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: 'v0.1.0' } as never);
    const r = checkGitTagExists('v0.1.0');
    expect(r.exists).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it('returns exists:false when the tag is absent (empty stdout)', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '' } as never);
    const r = checkGitTagExists('v9.9.9');
    expect(r.exists).toBe(false);
    expect(r.warning).toBeUndefined();
  });

  it('returns a warning (exists:false) when git exits non-zero (sandbox)', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 128, stdout: '' } as never);
    const r = checkGitTagExists('v0.1.0');
    expect(r.exists).toBe(false);
    expect(r.warning).toContain('git tag command failed');
    expect(r.warning).toContain('128');
  });
});
