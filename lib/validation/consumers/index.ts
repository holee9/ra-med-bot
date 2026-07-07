// @MX:NOTE [AUTO] Consumer wrappers barrel export for validation workflows (SPEC-REGULA-VALIDATION-002 M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

// Model-governance consumer
export {
  fetchWindowScopedChangeRequests,
  type ChangeRequestRow,
} from './model-governance';

// Traceability consumer
export {
  snapshotTraceability,
  type MatrixSummary,
} from './traceability';

// Source-governance consumer
export {
  snapshotSourceGovernance,
  type GovernanceDashboard,
} from './source-governance';

// Release validation consumer
export {
  validateReleaseIdFormat,
  checkGitTagExists,
  type ReleaseIdValidationResult,
  type GitTagExistenceResult,
} from './release';
