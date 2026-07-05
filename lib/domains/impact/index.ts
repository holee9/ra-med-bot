// @MX:NOTE [AUTO] Re-export layer for backward compatibility with lib/impact/.
// @MX:SPEC SPEC-V3-IMPACT-001 (M1 Foundation)

// Types
export type {
  ImpactLevel,
  ActionItemStatus,
  AffectedSection,
  ImpactAssessment,
  ImpactActionItem,
  ScanResult,
} from './types';

// Analysis
export {
  analyzeImpact,
  listAssessmentsForOrg,
  type AnalysisRequest,
  type AnalysisResult,
} from './analyzer';

// Scanning
export { scanPortfolio } from './portfolio-scanner';

// Section mapping
export { mapSections as mapAffectedSections } from './section-mapper';

// Action queue
export { enqueueActionItems } from './action-queue';

// Audit wiring
export {
  auditAssessmentCreated,
  auditCriticalDetected,
  auditActionItemCreated,
} from './audit-wiring';

// SPEC-V3-IMPACT-001 exports
export { RETEST_MATRIX, type RetestMatrixCell, type RetestMatrixData } from './retest-matrix-data';
export { lookupRetestMatrix, calculateSignal } from './layer1-matrix-lookup';
export { classifyChangeCategory, type ClassificationResult } from './layer2-llm-classifier';
export { createImpactTicket, type TicketInput } from './layer3-ticket-creator';
