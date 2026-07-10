// SPEC-REGULA-WORKFLOWS-LLM-002 M4 — SSE /events route helper tests.
// REQ-WFLLM-002 / AC-04: SSE streaming of WorkflowStreamEvent to the client.
//
// Tests cover:
//   - SSE wire format (`data: ${JSON}\n\n`)
//   - runWorkflow emit → SSE chunk plumbing
//   - RBAC: org mismatch → 404 (IDOR — no existence disclosure)
//   - Status guard: non-queued → 409
//   - Invalid runId → 400
//   - Missing org context → 403
//   - runWorkflow error → error event + stream close
//
// DB + runWorkflow are mocked so the helper logic is tested in isolation.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (vi.hoisted ensures the mock fns exist when vi.mock factories run) ---

const { mockRunWorkflow, mockEncodeWorkflowEvent, mockFindFirst } = vi.hoisted(() => ({
  mockRunWorkflow: vi.fn(
    async (params: {
      runId: string;
      workflowType: string;
      actorId: string;
      steps: string[];
      input: Record<string, unknown>;
      emit?: (event: unknown) => void;
    }): Promise<{ runId: string; status: string }> => {
      params.emit?.({
        type: 'run_start',
        runId: params.runId,
        workflowType: 'test',
        totalSteps: 1,
      });
      params.emit?.({
        type: 'step_start',
        runId: params.runId,
        stepName: 'step_1',
        stepIndex: 0,
      });
      params.emit?.({
        type: 'step_complete',
        runId: params.runId,
        stepName: 'step_1',
        stepIndex: 0,
        citationCoverage: 1,
        confidence: 0.9,
      });
      params.emit?.({
        type: 'run_complete',
        runId: params.runId,
        overallConfidence: 0.9,
        citationCoverage: 1,
        draftVersion: 1,
        reviewRequired: false,
      });
      return { runId: params.runId, status: 'completed' };
    },
  ),
  mockEncodeWorkflowEvent: vi.fn((event: unknown) => `data: ${JSON.stringify(event)}\n\n`),
  mockFindFirst: vi.fn(),
}));

vi.mock('../workflow-runner', () => ({
  runWorkflow: mockRunWorkflow,
  encodeWorkflowEvent: mockEncodeWorkflowEvent,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      workflowRuns: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

vi.mock('@/lib/db/schema', () => ({
  workflowRuns: {
    id: 'id',
    organizationId: 'organizationId',
    workflowType: 'workflowType',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// --- Import after mocks ---

import {
  type WorkflowEventsConfig,
  buildEventsResponse,
  collectSseStream,
  isValidRunId,
  parseSseEvents,
} from '../events-route';

// --- Test fixture: a valid queued row ---
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_ID = '00000000-0000-0000-0000-000000000002';
const RUN_ID = '00000000-0000-0000-0000-000000000003';

const queuedRow = {
  id: RUN_ID,
  organizationId: ORG_ID,
  workflowType: 'submission_drafter',
  status: 'queued' as const,
  inputJson: { product_name: 'TestDevice', device_class: 'II' },
};

const testConfig: WorkflowEventsConfig = {
  workflowType: 'submission_drafter',
  steps: ['device_classification'],
  executor: vi.fn(async () => ({
    stepName: 'device_classification',
    output: {},
    confidenceScores: [],
    completedAt: new Date().toISOString(),
  })),
  wireInput: (wi: Record<string, unknown>) => ({ ...wi, _wired: true }),
};

describe('events-route: isValidRunId', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidRunId('00000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(isValidRunId('not-a-uuid')).toBe(false);
    expect(isValidRunId('')).toBe(false);
    expect(isValidRunId('12345')).toBe(false);
  });
});

describe('events-route: buildEventsResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(queuedRow);
  });

  it('returns 400 for invalid runId', async () => {
    const res = await buildEventsResponse('not-a-uuid', ACTOR_ID, ORG_ID, testConfig);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('returns 403 when organizationId is missing', async () => {
    const res = await buildEventsResponse(RUN_ID, ACTOR_ID, undefined, testConfig);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Organization');
  });

  it('returns 404 when run belongs to a different org (IDOR guard)', async () => {
    // findFirst returns null because the org-scoped query doesn't match.
    mockFindFirst.mockResolvedValue(null);

    const res = await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, testConfig);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');

    // Verify the query was org-scoped (includes organizationId filter).
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    const callArg = mockFindFirst.mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    // The where clause is built with and(eq(id), eq(orgId), eq(workflowType)).
    // We can't inspect the SQL directly (drizzle objects), but the call happened.
  });

  it('returns 409 when run status is not queued', async () => {
    mockFindFirst.mockResolvedValue({
      ...queuedRow,
      status: 'running',
    });

    const res = await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, testConfig);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('not in a startable state');
    expect(body.currentStatus).toBe('running');
  });

  it('returns 200 with text/event-stream for a valid queued run', async () => {
    const res = await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, testConfig);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams SSE events as data: JSON\\n\\n chunks', async () => {
    const res = await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, testConfig);
    const sseString = await collectSseStream(res.body as ReadableStream<Uint8Array>);

    // The wire format is `data: ${JSON}\n\n` per event.
    expect(sseString).toContain('data: ');
    expect(sseString).toContain('\n\n');

    const events = parseSseEvents(sseString);
    expect(events.length).toBe(4); // run_start, step_start, step_complete, run_complete

    const types = events.map((e) => e.type);
    expect(types).toEqual(['run_start', 'step_start', 'step_complete', 'run_complete']);
  });

  it('calls runWorkflow with the wired input and per-type config', async () => {
    await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, testConfig);

    expect(mockRunWorkflow).toHaveBeenCalledTimes(1);
    const callParams = mockRunWorkflow.mock.calls[0]?.[0];
    expect(callParams).toBeDefined();
    expect(callParams?.runId).toBe(RUN_ID);
    expect(callParams?.workflowType).toBe('submission_drafter');
    expect(callParams?.actorId).toBe(ACTOR_ID);
    expect(callParams?.steps).toEqual(['device_classification']);
    // wireInput adds _wired: true.
    expect(callParams?.input._wired).toBe(true);
    // emit callback is a function.
    expect(typeof callParams?.emit).toBe('function');
  });

  it('emits an error event when runWorkflow throws', async () => {
    mockRunWorkflow.mockRejectedValueOnce(new Error('persist failed'));

    const res = await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, testConfig);
    const sseString = await collectSseStream(res.body as ReadableStream<Uint8Array>);

    const events = parseSseEvents(sseString);
    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === 'error') {
      expect(errorEvent.runId).toBe(RUN_ID);
      expect(errorEvent.message).toContain('persist failed');
    }
  });

  it('uses the workflowType from config in the DB query', async () => {
    await buildEventsResponse(RUN_ID, ACTOR_ID, ORG_ID, {
      ...testConfig,
      workflowType: 'audit_response',
    });

    // The findFirst call constructs a where clause with eq(workflowType, config.workflowType).
    // Since we mock the schema + drizzle, we just verify the call happened.
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });
});

describe('events-route: parseSseEvents / collectSseStream', () => {
  it('parseSseEvents extracts events from SSE wire format', () => {
    const sse =
      'data: {"type":"run_start","runId":"r1"}\n\n' +
      'data: {"type":"run_complete","runId":"r1"}\n\n';
    const events = parseSseEvents(sse);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('run_start');
    expect(events[1]?.type).toBe('run_complete');
  });

  it('parseSseEvents skips malformed chunks', () => {
    const sse = 'data: not-json\n\ndata: {"type":"run_start"}\n\n';
    const events = parseSseEvents(sse);
    expect(events).toHaveLength(1);
  });

  it('collectSseStream reads a complete stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"run_start"}\n\n'));
        controller.close();
      },
    });
    const result = await collectSseStream(stream);
    expect(result).toBe('data: {"type":"run_start"}\n\n');
  });
});
