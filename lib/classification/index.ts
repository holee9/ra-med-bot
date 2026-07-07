// Barrel export for classification domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { classifyDevice } from './classification-engine';
export { parseDeviceIntent } from './intent-parser';

export type {
  ClassificationResult,
  DeviceInput,
  JurisdictionResult,
} from './classification-engine';
