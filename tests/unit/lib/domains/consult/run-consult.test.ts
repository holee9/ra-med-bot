// @MX:NOTE [AUTO] runConsult unit tests — RA Power Chat RAG pipeline wrapper.
// @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-004, REQ-CONS-005, AC-CONS-03..05, Issue 341)
// @MX:REASON runConsult wraps runTriage (TRIAGE 재사용) and adds citation coverage
//            80% gate (H-3). Tests mock runTriage to verify error mapping + coverage logic
//            without LLM/retrieval network calls (TRIAGE run-triage.test.ts pattern).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock TRIAGE runTriage so tests stay pure (no LLM / retrieval).
vi.mock('@/lib/domains/triage', () => ({
  runTriage: vi.fn(),
}));

import { runConsult } from '@/lib/domains/consult/run-consult';
import type { ConsultInput } from '@/lib/domains/consult/types';
import { runTriage } from '@/lib/domains/triage';

const baseInput: ConsultInput = {
  question: 'What does EU MDR Article 10 require?',
  orgId: '00000000-0000-0000-0000-000000000001',
  actorId: '00000000-0000-0000-0000-000000000002',
};

const mockedRunTriage = vi.mocked(runTriage);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runConsult — RA Power Chat (SPEC-V3-CONSULT-001)', () => {
  it('AC-CONS-03: success returns answer + citations + sources + confidence', async () => {
    mockedRunTriage.mockResolvedValue({
      autoAnswer: {
        answer:
          'EU MDR Article 10 requires a QMS. <sup class="cite" data-source="1">1</sup> Another cited sentence. <sup class="cite" data-source="2">2</sup>',
        citations: [{ source: 'src-1' }, { source: 'src-2' }],
      },
      autoConfidence: 0.92,
    });

    const result = await runConsult(baseInput);

    expect(result.error).toBeNull();
    expect(result.answer).toContain('EU MDR Article 10');
    expect(result.citations).toHaveLength(2);
    expect(result.sources).toEqual([{ sourceId: 'src-1' }, { sourceId: 'src-2' }]);
    expect(result.confidence).toBe(0.92);
  });

  it('AC-CONS-04: TRIAGE no_citations error forwards as-is', async () => {
    mockedRunTriage.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'no_citations',
    });

    const result = await runConsult(baseInput);
    expect(result.error).toBe('no_citations');
    expect(result.answer).toBeNull();
    expect(result.citations).toEqual([]);
  });

  it('AC-CONS-05: TRIAGE timeout error forwards as-is', async () => {
    mockedRunTriage.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'timeout',
    });

    const result = await runConsult(baseInput);
    expect(result.error).toBe('timeout');
  });

  it('H-3: low citation coverage (<80%) returns citation_coverage error', async () => {
    // 5 sentences, only 1 cited → uncited ratio = 4/5 = 0.8 > 0.2 → reject.
    mockedRunTriage.mockResolvedValue({
      autoAnswer: {
        answer:
          'First uncited sentence. Second uncited sentence. Third uncited one. Fourth uncited sentence. <sup class="cite" data-source="1">1</sup> Only this is cited.',
        citations: [{ source: 'src-1' }],
      },
      autoConfidence: 0.4,
    });

    const result = await runConsult(baseInput);
    expect(result.error).toBe('citation_coverage');
    expect(result.answer).toBeNull();
  });

  it('H-3: high citation coverage (>=80%) passes through', async () => {
    // 2 sentences, 2 cited sup markers → uncited ratio low → pass.
    mockedRunTriage.mockResolvedValue({
      autoAnswer: {
        answer:
          'EU MDR requires a QMS. <sup class="cite" data-source="1">1</sup> Article 10 defines scope. <sup class="cite" data-source="2">2</sup>',
        citations: [{ source: 'src-1' }, { source: 'src-2' }],
      },
      autoConfidence: 0.9,
    });

    const result = await runConsult(baseInput);
    expect(result.error).toBeNull();
    expect(result.answer).not.toBeNull();
  });

  it('forwards TRIAGE runtime_error', async () => {
    mockedRunTriage.mockResolvedValue({
      autoAnswer: null,
      autoConfidence: null,
      error: 'runtime_error',
    });

    const result = await runConsult(baseInput);
    expect(result.error).toBe('runtime_error');
  });

  it('threads actorId to runTriage (RLHF audit)', async () => {
    mockedRunTriage.mockResolvedValue({
      autoAnswer: {
        answer: 'cited. <sup class="cite" data-source="1">1</sup>',
        citations: [{ source: 'src-1' }],
      },
      autoConfidence: 0.8,
    });

    await runConsult(baseInput);

    expect(mockedRunTriage).toHaveBeenCalledWith({
      question: baseInput.question,
      orgId: baseInput.orgId,
      actorId: baseInput.actorId,
      signal: undefined,
    });
  });
});
