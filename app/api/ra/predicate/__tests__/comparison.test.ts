// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — predicate comparison Route Handlers.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-011, REQ-PRE-016, REQ-PRE-017,
//   REQ-PRE-018, REQ-PRE-019, REQ-PRE-020, REQ-PRE-024, REQ-PRE-029)
//
// Covers: POST create comparison (department RBAC RA/Dev allow, Exec/External
// deny, max-3 predicate enforcement, workflow_runs INSERT, audit logging),
// GET history (RA/Dev/Exec list own comparisons, sort order), and
// PUT approve (dimension cell approval, validation).

import type { ComparisonDimension, PredicateComparison } from '@/lib/predicate/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through with an injectable session ---
// Department lives on users.department, NOT on the session — the route fetches
// it from the DB. A mutable holder lets each test set the returned department.
let currentDepartment: 'RA' | 'Dev' | 'Exec' | 'External' | null = 'RA';

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

// --- Mock db: department lookup + workflow_runs insert/select/update ---
// `db.select(...)` is overloaded in the route: it is used both for the
// department lookup (returns [{ department }]) and for the history list
// (returns rows). We disambiguate by inspecting the selected columns is
// brittle, so instead each test sets `selectResult` to whatever the next
// `.select` chain should resolve to. The department lookup always runs first
// in POST/PUT and reads currentDepartment; history reads historyRows.
let historyRows: Array<Record<string, unknown>> = [];
let capturedOrderBy: 'asc' | 'desc' | null = null;

const insertedValues = vi.fn<[Record<string, unknown>], void>();
const insertReturning = vi.fn(async () => [{ id: 'wfr-001' }]);

const updateSet = vi.fn<[Record<string, unknown>], void>();
const updateReturning = vi.fn(async () => [{ id: 'wfr-001' }]);

// Stateful workflow_runs row used by the PUT approve path.
let storedState: PredicateComparison | null = null;

vi.mock('@/lib/db/client', () => {
  // Department lookup chain: .select().from().where().limit() → [{department}]
  const departmentChain = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => [{ department: currentDepartment }]),
  });

  // History list chain: .select().from().where().orderBy() → rows
  const historyChain = () => {
    const chain: Record<string, unknown> = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn((arg: unknown) => {
        // Drizzle desc()/asc() produce an SQL object whose queryChunks include a
        // trailing { value: [' desc'] } / { value: [' asc'] } fragment.
        const chunks = (arg as { queryChunks?: Array<{ value?: string[] }> })?.queryChunks ?? [];
        const flat = chunks.map((c) => (Array.isArray(c?.value) ? c.value.join('') : '')).join('');
        capturedOrderBy = flat.includes('desc') ? 'desc' : 'asc';
        return Promise.resolve(historyRows);
      }),
      limit: vi.fn(async () => historyRows),
    };
    return chain;
  };

  // The department lookup ALWAYS runs first in every handler. The second
  // .select() call (when present) serves the history list or the state read,
  // chosen by selectMode. We track call order with a per-request counter that
  // resets on each handler invocation is impractical across calls, so instead
  // the first select() of each chain returns the department lookup and any
  // subsequent select() returns the mode-specific chain.
  let selectMode: 'department' | 'history' | 'state' = 'department';
  let selectCall = 0;

  const stateChain = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => [{ id: 'wfr-001', resultJson: storedState }]),
  });

  return {
    __setSelectMode: (m: 'department' | 'history' | 'state') => {
      selectMode = m;
      selectCall = 0;
    },
    db: {
      select: vi.fn(() => {
        const call = selectCall;
        selectCall += 1;
        // First select() in any handler is the department lookup.
        if (call === 0) return departmentChain();
        if (selectMode === 'history') return historyChain();
        if (selectMode === 'state') return stateChain();
        return departmentChain();
      }),
      insert: vi.fn(() => ({
        values: vi.fn((v: Record<string, unknown>) => {
          insertedValues(v);
          return { returning: insertReturning };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((v: Record<string, unknown>) => {
          updateSet(v);
          return {
            where: vi.fn(() => ({ returning: updateReturning })),
          };
        }),
      })),
    },
  };
});

// --- Mock audit ---
interface AuditEventArg {
  action: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string;
  meta_json: Record<string, unknown>;
}
const writeAuditMock = vi.fn<[AuditEventArg], Promise<void>>(async () => {});
vi.mock('@/lib/audit', () => ({
  writeAudit: (arg: AuditEventArg) => writeAuditMock(arg),
}));

// --- Mock comparison builder ---
function fakeComparison(): PredicateComparison {
  return {
    subject_device_name: 'Infusion Pump',
    selected_predicates: [],
    cells: (
      [
        'intended_use',
        'indications',
        'tech_characteristics',
        'materials',
        'performance',
      ] as ComparisonDimension[]
    ).map((dimension) => ({
      dimension,
      subject_text: `subject ${dimension}`,
      predicate_texts: ['K1 desc'],
      approved: [false],
    })),
    created_at: new Date('2026-01-01T00:00:00Z'),
  };
}

const buildComparison = vi.fn(async () => fakeComparison());
vi.mock('@/lib/predicate/comparison-builder', () => ({
  createComparisonBuilder: vi.fn(() => ({ buildComparison })),
}));

// --- Mock shared Anthropic client (builder factory arg) ---
vi.mock('@/lib/ai/anthropic-client', () => ({
  sharedAnthropicClient: {},
}));

const dbModule = (await import('@/lib/db/client')) as unknown as {
  __setSelectMode: (m: 'department' | 'history' | 'state') => void;
};
const { POST, GET } = await import('@/app/api/ra/predicate/comparison/route');
const { PUT } = await import('@/app/api/ra/predicate/comparison/[id]/approve/route');

function validBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subject_device_name: 'Infusion Pump',
    subject_inputs: {
      intended_use: 'a',
      indications: 'b',
      tech_characteristics: 'c',
      materials: 'd',
      performance: 'e',
    },
    selected_predicate_knumbers: ['K1', 'K2'],
    ...over,
  };
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/predicate/comparison', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getReq(query = ''): Request {
  return new Request(`http://localhost/api/ra/predicate/comparison${query}`, {
    method: 'GET',
  });
}

function putReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/predicate/comparison/wfr-001/approve', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentDepartment = 'RA';
  historyRows = [];
  capturedOrderBy = null;
  storedState = fakeComparison();
  dbModule.__setSelectMode('department');
  insertReturning.mockResolvedValue([{ id: 'wfr-001' }]);
  updateReturning.mockResolvedValue([{ id: 'wfr-001' }]);
});

describe('POST /api/ra/predicate/comparison — create (REQ-PRE-019)', () => {
  it('returns 200 with workflow_run_id and comparison for an RA user', async () => {
    const res = await POST(postReq(validBody()), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workflow_run_id).toBe('wfr-001');
    expect(body.comparison).toBeDefined();
    expect(body.comparison.cells).toHaveLength(5);
  });

  it('inserts a workflow_runs row with workflow_type=predicate_comparison', async () => {
    await POST(postReq(validBody()), {});

    expect(insertedValues).toHaveBeenCalledOnce();
    const values = (insertedValues.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(values.workflowType).toBe('predicate_comparison');
    expect(values.userId).toBe('user-001');
  });

  it('allows a Dev-department user', async () => {
    currentDepartment = 'Dev';
    const res = await POST(postReq(validBody()), {});
    expect(res.status).toBe(200);
  });

  it('rejects more than 3 predicates with 400 (REQ-PRE-018)', async () => {
    const res = await POST(
      postReq(validBody({ selected_predicate_knumbers: ['K1', 'K2', 'K3', 'K4'] })),
      {},
    );
    expect(res.status).toBe(400);
    expect(buildComparison).not.toHaveBeenCalled();
  });

  it('denies an External-department user with 403', async () => {
    currentDepartment = 'External';
    const res = await POST(postReq(validBody()), {});
    expect(res.status).toBe(403);
  });

  it('denies an Exec-department user from POST with 403 (read-only)', async () => {
    currentDepartment = 'Exec';
    const res = await POST(postReq(validBody()), {});
    expect(res.status).toBe(403);
  });

  it('writes a predicate_comparison_generated audit row (REQ-PRE-017)', async () => {
    await POST(postReq(validBody()), {});

    expect(writeAuditMock).toHaveBeenCalledOnce();
    const event = (writeAuditMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(event.action).toBe('predicate_comparison_generated');
    const meta = event.meta_json as Record<string, unknown>;
    expect(meta.predicate_k_numbers).toEqual(['K1', 'K2']);
    expect(meta.subject_device_name).toBe('Infusion Pump');
  });

  it('persists selected_predicate_knumbers in workflow_runs state (REQ-PRE-024)', async () => {
    await POST(postReq(validBody()), {});

    const values = (insertedValues.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    const state = values.resultJson as { selected_predicate_knumbers: string[] };
    expect(state.selected_predicate_knumbers).toEqual(['K1', 'K2']);
  });
});

describe('GET /api/ra/predicate/comparison — history (REQ-PRE-020)', () => {
  beforeEach(() => {
    dbModule.__setSelectMode('history');
    historyRows = [
      { id: 'wfr-002', createdAt: new Date('2026-02-01T00:00:00Z') },
      { id: 'wfr-001', createdAt: new Date('2026-01-01T00:00:00Z') },
    ];
  });

  it('returns the list of comparisons sorted desc by default for an RA user', async () => {
    const res = await GET(getReq(), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.comparisons)).toBe(true);
    expect(body.comparisons).toHaveLength(2);
    expect(capturedOrderBy).toBe('desc');
  });

  it('allows an Exec-department user to list their own comparisons', async () => {
    currentDepartment = 'Exec';
    const res = await GET(getReq(), {});
    expect(res.status).toBe(200);
  });

  it('sorts ascending when ?sort=asc', async () => {
    const res = await GET(getReq('?sort=asc'), {});
    expect(res.status).toBe(200);
    expect(capturedOrderBy).toBe('asc');
  });

  it('denies an External-department user with 403', async () => {
    currentDepartment = 'External';
    const res = await GET(getReq(), {});
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/ra/predicate/comparison/[id]/approve — approve cell (REQ-PRE-016)', () => {
  beforeEach(() => {
    dbModule.__setSelectMode('state');
  });

  it('approves a cell: sets approved[predicate_index]=true for the dimension', async () => {
    const res = await PUT(putReq({ dimension: 'intended_use', predicate_index: 0 }), {
      params: { id: 'wfr-001' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledOnce();
    const updated = updateSet.mock.calls[0]?.[0].resultJson as PredicateComparison;
    const cell = updated.cells.find((c) => c.dimension === 'intended_use');
    expect(cell?.approved[0]).toBe(true);
    expect(body.comparison).toBeDefined();
  });

  it('rejects an invalid dimension with 400', async () => {
    const res = await PUT(putReq({ dimension: 'not_a_dimension', predicate_index: 0 }), {
      params: { id: 'wfr-001' },
    });
    expect(res.status).toBe(400);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('denies an Exec-department user from approving with 403', async () => {
    currentDepartment = 'Exec';
    const res = await PUT(putReq({ dimension: 'intended_use', predicate_index: 0 }), {
      params: { id: 'wfr-001' },
    });
    expect(res.status).toBe(403);
  });
});
