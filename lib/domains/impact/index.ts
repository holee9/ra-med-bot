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

// SPEC-V3-IMPACT-001 M9: Audit logger exports
export {
  logImpactCheck,
  logTicketCreate,
  logCriticalDetected,
} from './audit-logger';
export type { ImpactCheckContext, TicketCreateContext, CriticalDetectedContext } from './audit-logger';

// SPEC-V3-IMPACT-001 exports
export { RETEST_MATRIX, type RetestMatrixCell, type RetestMatrixData } from './retest-matrix-data';
export { lookupRetestMatrix, calculateSignal } from './layer1-matrix-lookup';
export { classifyChangeCategory, type ClassificationResult } from './layer2-llm-classifier';
export { createImpactTicket, type TicketInput } from './layer3-ticket-creator';
export { findSimilarCases, type SimilarCaseInput, type SimilarCasesResult } from './layer4-rag-similar-cases';
