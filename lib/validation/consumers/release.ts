// @MX:NOTE [AUTO] Release ID validation and git tag checks (REQ-RELEASE-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { spawnSync } from 'node:child_process';

/**
 * Result of release ID format validation.
 */
export interface ReleaseIdValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Result of git tag existence check.
 */
export interface GitTagExistenceResult {
  exists: boolean;
  warning?: string;
}

/**
 * Validate release ID format against semver pattern.
 *
 * Accepts:
 * - v0.1.0 (stable release)
 * - v0.1.0-rc1 (release candidate)
 *
 * Rejects:
 * - invalid-id (no 'v' prefix)
 * - v0.1 (missing patch version)
 * - 0.1.0 (missing 'v' prefix)
 *
 * @param releaseId - Release ID to validate
 * @returns Validation result with valid flag and optional reason
 */
export function validateReleaseIdFormat(releaseId: string): ReleaseIdValidationResult {
  // Regex: v<Major>.<Minor>.<Patch> (-rc<N>)?
  const pattern = /^v\d+\.\d+\.\d+(-rc\d+)?$/;

  if (pattern.test(releaseId)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Release ID must match semver pattern v<Major>.<Minor>.<Patch> (-rc<N>)?, got: ${releaseId}`,
  };
}

/**
 * Check if a git tag exists in the repository.
 *
 * Uses `git tag --list <releaseId>` to check for local tag existence.
 * If the command fails (e.g., sandbox restrictions), returns a warning
 * instead of throwing — the validation framework continues with exit 0.
 *
 * @param releaseId - Release ID to check (assumed to be validated by validateReleaseIdFormat first)
 * @returns Existence result with exists flag and optional warning
 */
export function checkGitTagExists(releaseId: string): GitTagExistenceResult {
  // Spawn git tag --list to check if the tag exists.
  const result = spawnSync('git', ['tag', '--list', releaseId], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  // If git command failed (e.g., sandbox), warn but don't block.
  if (result.status !== 0) {
    return {
      exists: false,
      warning: `git tag command failed (exit code ${result.status}), possibly due to sandbox restrictions. Tag existence could not be verified.`,
    };
  }

  // If output contains the tag name, it exists.
  const stdout = result.stdout.toString('utf-8').trim();
  const exists = stdout === releaseId;

  return { exists };
}
