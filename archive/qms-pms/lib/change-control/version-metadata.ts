// @MX:NOTE [AUTO] REQ-010 version metadata for change-control assessments.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-010, AC-08)

// @MX:LEGACY archived from lib
//
// Version metadata is recorded on every change_assessments row so that a past
// assessment can be rolled back / reproduced if a prompt or template update
// degrades output quality. Mirrors the PMS pattern where workflow_runs carry
// version info in audit meta.

import type { VersionMetadata } from './types';

/**
 * Current active versions. These SHOULD be bumped in lock-step with prompt /
// template / model deployments. Read at assessment-creation time and persisted
// onto the change_assessments row (REQ-010).
 */
export const ACTIVE_VERSIONS: VersionMetadata = {
  modelVersion: 'claude-opus-4-7@2026-06',
  promptVersion: 'change-control-v1.0.0',
  templateVersion: 'change-control-report-v1.0.0',
};

/**
 * Resolve version metadata for a new assessment. Callers can override (e.g.
// tests, rollback replay) but by default the ACTIVE_VERSIONS constant is used.
 */
export function resolveVersionMetadata(override?: Partial<VersionMetadata>): VersionMetadata {
  return { ...ACTIVE_VERSIONS, ...override };
}
