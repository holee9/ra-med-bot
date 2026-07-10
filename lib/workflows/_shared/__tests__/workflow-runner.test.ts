// SPEC-REGULA-WORKFLOWS-LLM-002 M0-0 — workflow-runner unit tests.
// REQ-WFLLM-001/002/008/010 / AC-04/10: orchestration + SSE + partial-draft.
//
// DB + audit are mocked so the runner logic is tested in isolation. The
// persistRunResult path is exercised via the mock db.transaction callback.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB client + schema + audit BEFORE importing the runner.
const mockReturning = vi.fn(() => [{ draftVersion: 1 }]);

vi.mock('@/lib/db/client', () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })),
        })),
      }),
    ),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  workflowRuns: {
    id: 'id',
    draftVersion: 'draftVersion',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(async () => undefined),
}));

vi.mock('@/lib/workflows/common/confidence-aggregator', () => ({
  aggregateScores: vi.fn(() => 0.85),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// streaming-chain is mocked so the runner test does NOT hit gx10. The mock
// invokes onDelta so step_delta SSE events are still emitted (exercising the
// runner's wiring without a real gx10 call).
vi.mock('../streaming-chain', () => ({
  streamSection: vi.fn(async (params: { onDelta?: (d: string) => void }) => {
    params.onDelta?.('Generated section.<sup class="cite">1</sup>');
    return {
      text: 'Generated section.<sup class="cite">1</sup>',
      status: 'ok',
    };
  }),
  DEFAULT_STREAM_TIMEOUT_MS: 30_000,
  WorkflowLlmError: class WorkflowLlmError extends Error {
    readonly kind: 'timeout' | 'runtime' | 'schema';
    readonly stepName: string;
    constructor(kind: 'timeout' | 'runtime' | 'schema', stepName: string, message: string) {
      super(message);
      this.name = 'WorkflowLlmError';
      this.kind = kind;
      this.stepName = stepName;
    }
  },
}));

import { writeAudit } from '@/lib/audit';
import { encodeWorkflowEvent, runWorkflow } from '../workflow-runner';
import type { StepExecutor } from '../workflow-runner';

describe('workflow-runner: runWorkflow (mock executor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loops steps, emits SSE events, and returns aggregated results', async () => {
    const executor: StepExecutor = vi.fn(async (step) => ({
      stepName: step,
      output: { classification: 'Class II' },
      confidenceScores: [{ source: 'llm', score: 0.9, weight: 1 }],
      completedAt: new Date().toISOString(),
    }));

    const events: unknown[] = [];
    const result = await runWorkflow({
      runId: 'run-1',
      workflowType: 'submission_drafter',
      actorId: 'user-1',
      steps: ['device_classification', 'predicate_search'],
      executor,
      input: { product_name: 'Dev' },
      emit: (e) => events.push(e),
    });

    expect(executor).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.status).toBe('completed');
    expect(result.overallConfidence).toBe(0.85); // mocked aggregateScores

    // SSE events: run_start, 2x(step_start + step_complete), run_complete.
    const types = (events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toEqual([
      'run_start',
      'step_start',
      'step_complete',
      'step_start',
      'step_complete',
      'run_complete',
    ]);
  });

  it('continues on step error and records partial status (REQ-WFLLM-010)', async () => {
    const executor: StepExecutor = vi.fn(async (step) => {
      if (step === 'failing_step') throw new Error('boom');
      return {
        stepName: step,
        output: {},
        confidenceScores: [{ source: 'llm', score: 0.8, weight: 1 }],
        completedAt: new Date().toISOString(),
      };
    });

    const events: unknown[] = [];
    const result = await runWorkflow({
      runId: 'run-2',
      workflowType: 'audit_response',
      actorId: 'user-1',
      steps: ['ok_step', 'failing_step', 'recovery_step'],
      executor,
      input: {},
      emit: (e) => events.push(e),
    });

    expect(result.status).toBe('partial'); // some steps succeeded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.stepName).toBe('failing_step');
    expect(result.results).toHaveLength(2); // 2 of 3 succeeded

    const types = (events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain('step_failed');
  });

  it('persists results + writes audit rows in one transaction (21 CFR Part 11)', async () => {
    const executor: StepExecutor = vi.fn(async (step) => ({
      stepName: step,
      output: {},
      confidenceScores: [{ source: 'llm', score: 0.9, weight: 1 }],
      completedAt: new Date().toISOString(),
    }));

    await runWorkflow({
      runId: 'run-3',
      workflowType: 'indication_impact',
      actorId: 'user-1',
      steps: ['axis1'],
      executor,
      input: {},
    });

    // writeAudit is called for draft_version + llm_call (+ expert_flagged if
    // coverage/review trips). At least the two mandatory rows.
    expect(writeAudit).toHaveBeenCalled();
    const actions = vi.mocked(writeAudit).mock.calls.map((c) => c[0]?.action);
    expect(actions).toContain('workflow.draft_version');
    expect(actions).toContain('workflow.llm_call');
  });

  it('streams prose sections via streaming-chain when streamingSteps provided', async () => {
    const executor: StepExecutor = vi.fn();
    const events: unknown[] = [];

    const result = await runWorkflow({
      runId: 'run-4',
      workflowType: 'submission_drafter',
      actorId: 'user-1',
      steps: ['substantial_equivalence'],
      executor,
      input: {},
      emit: (e) => events.push(e),
      streamingSteps: new Map([
        ['substantial_equivalence', { systemPrompt: 'sys', prompt: 'Evaluate SE.' }],
      ]),
    });

    expect(executor).not.toHaveBeenCalled(); // streaming path used instead
    expect(result.sectionTexts.substantial_equivalence).toContain('Generated section');
    const types = (events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain('step_delta');
  });
});

describe('workflow-runner: encodeWorkflowEvent', () => {
  it('encodes events as SSE wire chunks (data: JSON\\n\\n)', () => {
    const encoded = encodeWorkflowEvent({
      type: 'run_start',
      runId: 'r',
      workflowType: 'submission_drafter',
      totalSteps: 3,
    });
    expect(encoded).toBe(
      `data: ${JSON.stringify({ type: 'run_start', runId: 'r', workflowType: 'submission_drafter', totalSteps: 3 })}\n\n`,
    );
  });
});
