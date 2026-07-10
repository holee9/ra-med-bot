// @MX:NOTE [AUTO] Input wiring — maps dependency outputs → StepExecutionContext.input.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (M0-5, REQ-WFLLM-001/003/005)
//
// This module defines the input contract for each workflow's executeStep and
// provides an explicit stub fallback when a dependency (#22 predicate search,
// #23 CER builder, #24 PCCP builder) has not produced real output yet. The
// stub is LOGGED so the audit trail records when a workflow ran on synthetic
// input (21 CFR Part 11 transparency).

import type { logger as loggerInstance } from '@/lib/observability/logger';

/**
 * The wiring context: what the runner knows about the run before invoking
 * executeStep. The mapper translates this into the `input` field that
 * StepExecutionContext expects.
 */
export interface WiringContext {
  /** Validated workflow input from the route (SubmissionDrafterInput etc.). */
  workflowInput: Record<string, unknown>;
  /** Outputs from predicate search (#22), if available. */
  predicateResults?: PredicateSearchOutput | null;
  /** Outputs from CER builder (#23), if available. */
  cerResults?: CerBuilderOutput | null;
  /** Outputs from PCCP builder (#24), if available. */
  pccpResults?: PccpBuilderOutput | null;
  /** Logger for stub-fallback warnings (21 CFR Part 11 transparency). */
  logger?: Pick<typeof loggerInstance, 'warn' | 'info' | 'debug'>;
}

// ── Dependency output contracts (forward-declared) ────────────────────────
// These match the shapes produced by #22/#23/#24. If those dependencies are
// still stubs, `wireInput` falls back to explicit synthetic input and logs it.

export interface PredicateSearchOutput {
  predicateDevices: Array<{
    kNumber: string;
    deviceName: string;
    productCode: string;
    similarityScore: number;
  }>;
  searchStrategy: string;
}

export interface CerBuilderOutput {
  cerId: string;
  clinicalEvidenceSummary: string;
  literatureReferences: Array<{ pmid: string; title: string }>;
}

export interface PccpBuilderOutput {
  pccpVersionId: string;
  algorithmDescription: string;
  modificationProtocol: string;
}

// ── Per-workflow input contracts ──────────────────────────────────────────

export interface SubmissionDrafterStepInput {
  product_name: string;
  device_class: string;
  indications_for_use: string;
  target_jurisdiction: string;
  predicate_k_numbers?: string[];
  /** Predicate search results from #22. `isStub` flags synthetic fallback. */
  predicateResults: PredicateSearchOutput | { isStub: true };
}

export interface AuditResponseStepInput {
  input_type: string;
  input_content: string;
  establishment_fei?: string;
  /** CER context from #23 (optional — audit-response may run without). */
  cerContext?: CerBuilderOutput | { isStub: true };
}

export interface IndicationImpactStepInput {
  current_indication: string;
  proposed_indication: string;
  target_markets: string[];
  /** PCCP context from #24 (optional). */
  pccpContext?: PccpBuilderOutput | { isStub: true };
}

/**
 * Map a WiringContext to the `input` for a submission-drafter step.
 * Falls back to a stub predicate result (logged) when #22 has not produced
 * output — the workflow can still produce a draft, but the audit trail
 * records that the predicate input was synthetic.
 */
export function wireSubmissionDrafterInput(ctx: WiringContext): SubmissionDrafterStepInput {
  const wi = ctx.workflowInput;
  const predicateResults = ctx.predicateResults ?? stubPredicateResults(ctx, 'submission_drafter');

  return {
    product_name: String(wi.product_name ?? ''),
    device_class: String(wi.device_class ?? ''),
    indications_for_use: String(wi.indications_for_use ?? ''),
    target_jurisdiction: String(wi.target_jurisdiction ?? ''),
    predicate_k_numbers: Array.isArray(wi.predicate_k_numbers)
      ? (wi.predicate_k_numbers as string[])
      : undefined,
    predicateResults,
  };
}

export function wireAuditResponseInput(ctx: WiringContext): AuditResponseStepInput {
  const wi = ctx.workflowInput;
  const cerContext = ctx.cerResults ?? undefined; // CER context is optional for audit-response

  return {
    input_type: String(wi.input_type ?? ''),
    input_content: String(wi.input_content ?? ''),
    establishment_fei: typeof wi.establishment_fei === 'string' ? wi.establishment_fei : undefined,
    cerContext,
  };
}

export function wireIndicationImpactInput(ctx: WiringContext): IndicationImpactStepInput {
  const wi = ctx.workflowInput;
  const pccpContext = ctx.pccpResults ?? undefined; // PCCP context optional for indication-impact

  return {
    current_indication: String(wi.current_indication ?? ''),
    proposed_indication: String(wi.proposed_indication ?? ''),
    target_markets: Array.isArray(wi.target_markets) ? (wi.target_markets as string[]) : [],
    pccpContext,
  };
}

/**
 * Build an explicit stub predicate result and log a warning. The `isStub`
 * flag lets downstream consumers (executor, audit trail) distinguish
 * synthetic input from real #22 output. REQ-WFLLM-001 expects real predicate
 * input once #22 lands — until then the stub keeps the pipeline runnable.
 */
function stubPredicateResults(ctx: WiringContext, workflowType: string): { isStub: true } {
  ctx.logger?.warn('Predicate search results unavailable — using stub input', {
    workflowType,
    dependency: 'predicate_search',
    specRef: 'SPEC-REGULA-PREDICATE-001 (#22)',
  });
  return { isStub: true };
}
