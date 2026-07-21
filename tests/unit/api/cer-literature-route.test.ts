// @MX:NOTE [AUTO] Route tests for POST /api/ra/workflows/cer/literature (coverage 402, SPEC-REGULA-CER-001).
// @MX:SPEC REQ-CLINLIT-001..025
// @MX:TODO Deep PICO/screening/synthesis covered by lib/cer/*.test.ts. These tests
//   exercise the route handler surface: SSE framing, Zod validation, pipeline
//   event ordering, no-articles short-circuit, and error-event emission.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through with fixed session ---
vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' },
        }),
  ),
}));

// --- Mock db: insert chains for literatureSearches / literatureReferences / evidenceSyntheses ---
const mockSearchInsertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockDb = {
  insert: vi.fn(() => mockSearchInsertChain),
};

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock CER pipeline deps ---
const generatePicoQueryMock = vi.fn();
vi.mock('@/lib/cer/pico-generator', () => ({
  generatePicoQuery: (...a: unknown[]) => generatePicoQueryMock(...a),
}));

const searchPubMedMock = vi.fn();
vi.mock('@/lib/cer/pubmed-client', () => ({
  searchPubMed: (...a: unknown[]) => searchPubMedMock(...a),
}));

const screenArticlesMock = vi.fn();
vi.mock('@/lib/cer/screening-pipeline', () => ({
  screenArticles: (...a: unknown[]) => screenArticlesMock(...a),
}));

const appraiseEvidenceMock = vi.fn();
vi.mock('@/lib/cer/literature-appraisal', () => ({
  appraiseEvidence: (...a: unknown[]) => appraiseEvidenceMock(...a),
}));

const formatVancouverMock = vi.fn();
vi.mock('@/lib/cer/citation-formatter', () => ({
  formatVancouver: (...a: unknown[]) => formatVancouverMock(...a),
}));

const synthesizeEvidenceMock = vi.fn();
vi.mock('@/lib/cer/evidence-synthesis', () => ({
  synthesizeEvidence: (...a: unknown[]) => synthesizeEvidenceMock(...a),
}));

const auditCerLiteratureSearchMock = vi.fn();
vi.mock('@/lib/cer/audit', () => ({
  auditCerLiteratureSearch: (...a: unknown[]) => auditCerLiteratureSearchMock(...a),
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/workflows/cer/literature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = {
  cerRunId: '550e8400-e29b-41d4-a716-446655440000',
  deviceDescription: 'A battery-powered cardiac pacemaker for chronic implantation therapy.',
};

const ARTICLE_FIXTURE = {
  pmid: '11111111',
  title: 'Pacemaker outcomes in bradycardia patients',
  abstract: 'Systematic review of pacing modalities.',
  authors: ['Lee K'],
  journal: 'JAMA',
  year: 2023,
};

const PICO_FIXTURE = {
  patient: 'Adults with symptomatic bradycardia',
  intervention: 'Dual-chamber pacemaker implantation',
  comparator: 'Single-chamber pacemaker',
  outcome: 'Quality of life and complication rate',
  searchQuery: 'dual-chamber pacemaker bradycardia randomized',
  meshTerms: ['Pacemaker, Artificial', 'Bradycardia'],
};

const SCREENING_FIXTURE = [{ pmid: '11111111', decision: 'include' as const, reason: null }];

const APPRAISAL_FIXTURE = {
  sign50Level: '1+',
  gradeQuality: 'moderate',
  riskOfBias: 'low',
};

const SYNTHESIS_FIXTURE = {
  gradeCounts: { high: 0, moderate: 1, low: 0, veryLow: 0 },
  gradeSummary: 'Evidence body moderate quality based on one included RCT.',
  narrativeSynthesis: 'The evidence supports dual-chamber pacing benefit.',
  cerSection6Draft: '## Section 6 draft',
  cerSection7Draft: '## Section 7 draft',
  cerSection8Draft: '## Section 8 draft',
};

/** Drain SSE Response into parsed event payloads. */
async function readSseEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  const events: Array<Record<string, unknown>> = [];
  for (const block of text.split('\n\n')) {
    const line = block.trim();
    if (line.startsWith('data: ')) {
      events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

describe('POST /api/ra/workflows/cer/literature — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatePicoQueryMock.mockResolvedValue(PICO_FIXTURE);
    searchPubMedMock.mockResolvedValue([ARTICLE_FIXTURE]);
    screenArticlesMock.mockResolvedValue(SCREENING_FIXTURE);
    appraiseEvidenceMock.mockReturnValue(APPRAISAL_FIXTURE);
    formatVancouverMock.mockReturnValue('Lee K. JAMA 2023.');
    synthesizeEvidenceMock.mockResolvedValue(SYNTHESIS_FIXTURE);
    auditCerLiteratureSearchMock.mockResolvedValue(undefined);
    mockSearchInsertChain.returning.mockResolvedValue([{ id: 'search-001' }]);
  });

  it('returns SSE response with correct headers (200)', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams pico → search → screening → synthesis → done events', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    const events = await readSseEvents(res);
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain('pico');
    expect(eventTypes).toContain('search');
    expect(eventTypes).toContain('screening');
    expect(eventTypes).toContain('synthesis');
    expect(eventTypes[eventTypes.length - 1]).toBe('done');

    const done = events[events.length - 1];
    // Route wraps payload: { event, data: {...} }
    expect(done?.event).toBe('done');
    expect(done?.data).toMatchObject({
      searchId: 'search-001',
      includedCount: 1,
      totalCount: 1,
    });
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest('not-json'), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when deviceDescription is shorter than 10 chars', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, deviceDescription: 'short' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when cerRunId is not a valid UUID', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, cerRunId: 'not-a-uuid' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('emits done with null searchId when no articles found (short-circuit)', async () => {
    searchPubMedMock.mockResolvedValue([]);

    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    const events = await readSseEvents(res);
    const done = events[events.length - 1];
    expect(done?.event).toBe('done');
    expect(done?.data).toMatchObject({
      searchId: null,
      message: 'No articles found for this query.',
    });
    // Screening/synthesis should NOT run when articles are empty.
    expect(screenArticlesMock).not.toHaveBeenCalled();
  });

  it('emits SSE error event when pipeline throws', async () => {
    searchPubMedMock.mockRejectedValue(new Error('PubMed network timeout'));

    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent?.event).toBe('error');
    expect(errorEvent?.data).toMatchObject({
      message: 'Literature search failed. Please try again.',
    });
  });

  it('writes cer_literature_search audit after pipeline completes', async () => {
    const { POST } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await POST(makePostRequest(VALID_BODY), {});
    await res.text();

    expect(auditCerLiteratureSearchMock).toHaveBeenCalledWith(
      'user-001',
      '550e8400-e29b-41d4-a716-446655440000',
      'dual-chamber pacemaker bradycardia randomized',
      1,
    );
  });
});

describe('GET /api/ra/workflows/cer/literature — method not allowed', () => {
  it('returns 405 for GET requests', async () => {
    const { GET } = await import('@/app/api/ra/workflows/cer/literature/route');
    const res = await GET();

    expect(res.status).toBe(405);
  });
});
