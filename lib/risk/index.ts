// Barrel export for risk domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { identifyHazards } from './hazard-identification';
export { recommendControls, validateControlHierarchy } from './control-recommendation';
export { evaluateResidualRisk, type ResidualRiskResult } from './residual-risk';
export { buildRiskReport } from './report-builder';
export { evaluateRiskLevel, validateScale } from './risk-evaluation';

export type {
  HazardCitation,
  HazardItem,
  ParsedHazardResponse,
} from './hazard-identification';
export type { ControlTier } from './control-recommendation';
export type {
  RiskControlPayload,
  RiskItemPayload,
  GsprMappingPayload,
  RiskRunPayload,
} from './report-builder';
