// Barrel export for standards domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { checkRecognition } from './recognition-check';
export { detectRevisions, resolveDetectionContext } from './revision-detector';
export { emitStandardsAlert } from './alert-pipeline';
export { identifyAffectedProducts } from './impact-analyzer';
export { mapApplicableStandards } from './mapping-engine';
export { getApplicableStandards } from './applicability-engine';

export type {
  AffectedProduct,
  ImpactAnalysisResult,
} from './impact-analyzer';
export type {
  ApplicableStandardResult,
  MappingOutcome,
} from './mapping-engine';
export type { DetectionContext } from './revision-detector';
export type { DeviceProfile } from './applicability-engine';
