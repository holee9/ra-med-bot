/**
 * SPEC-REGULA-WORKFLOWS-LLM-002 M0 — shared workflow-engine infrastructure.
 *
 * Barrel for the _shared modules. Consumers (M1-M3 route handlers + executors)
 * import from here so the dependency graph stays shallow.
 *
 * @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (M0-0..M0-5)
 */
export {
  runWorkflow,
  encodeSse,
  encodeWorkflowEvent,
} from './workflow-runner';
export type {
  RunWorkflowParams,
  RunWorkflowResult,
  StepExecutor,
  StepResult,
  StepExecutionContext,
  WorkflowStreamEvent,
} from './workflow-runner';

export {
  streamSection,
  judgeStructured,
  WorkflowLlmError,
  DEFAULT_STREAM_TIMEOUT_MS,
} from './streaming-chain';
export type {
  StreamSectionParams,
  StreamSectionResult,
  DeltaEmitter,
} from './streaming-chain';

export {
  computeCoverage,
  aggregateCoverage,
  enforceSectionCitations,
  countSentences,
  countCitedSup,
  CITATION_COVERAGE_THRESHOLD,
} from './citation-enforcer';
export type { CitationCoverageResult } from './citation-enforcer';

export {
  assertExportAllowed,
  shouldFlagForExpertReview,
} from './review-gate';
export type { ReviewGateResult } from './review-gate';

export { wireSubmissionDrafterInput, wireIndicationImpactInput } from './input-wiring';
export type {
  WiringContext,
  PredicateSearchOutput,
  CerBuilderOutput,
  PccpBuilderOutput,
  SubmissionDrafterStepInput,
  IndicationImpactStepInput,
} from './input-wiring';
