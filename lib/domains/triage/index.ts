/**
 * @MX:NOTE [AUTO] T-002 — TRIAGE public API exports
 *
 * Public API for TRIAGE domain. Exports runTriage function.
 *
 * @MX:SPEC SPEC-V3-TRIAGE-001
 */

export { runTriage } from './run-triage';
export type { TriageResult, AutoAnswer, RagPipelineInput } from './types';
