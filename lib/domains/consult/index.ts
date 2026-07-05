/**
 * @MX:NOTE [AUTO] CONSULT public API exports — RA Power Chat (v3 Phase C-5)
 *
 * Public API for the CONSULT domain. Exports runConsult and types.
 *
 * @MX:SPEC SPEC-V3-CONSULT-001 (Issue 341)
 */

export { runConsult } from './run-consult';
export type {
  ConsultCitation,
  ConsultError,
  ConsultInput,
  ConsultResult,
  ConsultSource,
} from './types';
