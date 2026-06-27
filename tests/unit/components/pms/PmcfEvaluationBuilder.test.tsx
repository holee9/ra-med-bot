// @MX:NOTE [AUTO] RTL tests for PmcfEvaluationBuilder — SPEC-REGULA-PMS-001 (Issue #244, REQ-PMS-011).
// Covers: render, RBAC gating, successful run call with exact request shape from
// the route's Zod schema, draft result render, error state, loading state,
// expert-review-required indicator (REQ-PMS-009).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PmcfEvaluationBuilder } from '../../../../app/(app)/pms/_components/PmcfEvaluationBuilder';

const EVAL_RESPONSE = {
  runId: 'run-eval-1',
  documentId: 'doc-eval-1',
  status: 'draft' as const,
  sections: {
    objective_assessment:
      '- 장기 안전성 프로파일 확인: MET — Objective supported by collected data (50 subjects).',
    data_coverage_assessment:
      'Sufficient data coverage (50 subjects, 12 months follow-up).\nMethods planned: 레지스트리 데이터.\nSurvey responses: 30.',
    adverse_event_analysis:
      'Recorded 2 adverse events out of 50 subjects (rate: 4.0%). Threshold: 10%.',
    conclusions: 'PMCF data supports the device benefit-risk profile.',
  },
};

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
  fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
  fireEvent.change(screen.getByLabelText(/PMCF 계획 목표/), {
    target: { value: '장기 안전성 프로파일 확인\n유효성 end-point 유지 확인' },
  });
  fireEvent.change(screen.getByLabelText(/PMCF 방법론/), {
    target: { value: '레지스트리 데이터' },
  });
  fireEvent.change(screen.getByLabelText(/레지스트리 대상자 수/), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText(/이상사례 수/), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText(/설문 응답 수/), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText(/추적 관찰 기간/), { target: { value: '12' } });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: async () => EVAL_RESPONSE,
      } as Response),
    ),
  );
});

describe('PmcfEvaluationBuilder — REQ-PMS-011 (PMCF evaluation draft)', () => {
  it('renders device identification, plan, and collected-data inputs', () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    expect(screen.getByLabelText(/기기명/)).toBeTruthy();
    expect(screen.getByLabelText(/기기 등급/)).toBeTruthy();
    expect(screen.getByLabelText(/PMCF 계획 목표/)).toBeTruthy();
    expect(screen.getByLabelText(/레지스트리 대상자 수/)).toBeTruthy();
    expect(screen.getByLabelText(/이상사례 수/)).toBeTruthy();
    expect(screen.getByTestId('pmcf-eval-submit')).toBeTruthy();
  });

  it('disables generate button when canManage is false (RBAC gating)', () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={false} />);
    const btn = screen.getByTestId('pmcf-eval-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables generate when required fields are empty', () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    const btn = screen.getByTestId('pmcf-eval-submit') as HTMLButtonElement;
    // Required: deviceName, deviceClass, objectives (>=1), registrySize, adverseEvents.
    expect(btn.disabled).toBe(true);
  });

  it('POSTs to /api/workflows/pmcf-evaluation/run with the route schema request body', async () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/workflows/pmcf-evaluation/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();
    const body = JSON.parse(String(lastCall?.[1]?.body));
    // Must match PmcfEvaluationRunSchema (route.ts).
    expect(body).toEqual({
      projectId: 'proj-1',
      deviceName: 'Insulin Pump',
      deviceClass: 'IIb',
      pmcfPlan: {
        objectives: ['장기 안전성 프로파일 확인', '유효성 end-point 유지 확인'],
        methods: ['레지스트리 데이터'],
      },
      collectedData: {
        registrySize: 50,
        adverseEvents: 2,
        surveyResponses: 30,
        followUpDurationMonths: 12,
      },
    });
  });

  it('renders evaluation sections after a successful run', async () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-result')).toBeTruthy();
    });
    expect(screen.getByTestId('pmcf-eval-section-objective_assessment')).toBeTruthy();
    expect(screen.getByTestId('pmcf-eval-section-data_coverage_assessment')).toBeTruthy();
    expect(screen.getByTestId('pmcf-eval-section-adverse_event_analysis')).toBeTruthy();
    expect(screen.getByTestId('pmcf-eval-section-conclusions')).toBeTruthy();
    expect(screen.getByTestId('pmcf-eval-section-conclusions').textContent).toContain(
      'PMCF data supports',
    );
  });

  it('shows draft status label when status=draft', async () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-status')).toBeTruthy();
    });
    expect(screen.getByTestId('pmcf-eval-status').textContent).toContain('초안');
  });

  it('shows expert-review-required gating when status=draft (REQ-PMS-009)', async () => {
    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-expert-review-gating')).toBeTruthy();
    });
    expect(screen.getByTestId('pmcf-eval-expert-review-gating').textContent).toContain(
      '전문가 검토 필요',
    );
  });

  it('hides expert-review gating when status=complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ ...EVAL_RESPONSE, status: 'complete' }),
        } as Response),
      ),
    );

    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-status').textContent).toContain('완료');
    });
    expect(screen.queryByTestId('pmcf-eval-expert-review-gating')).toBeNull();
  });

  it('shows error message on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid input' }),
        } as Response),
      ),
    );

    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-error')).toBeTruthy();
    });
    expect(screen.getByTestId('pmcf-eval-error').textContent).toContain('Invalid input');
  });

  it('shows loading indicator while the request is in flight', async () => {
    let resolveFn!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFn = resolve;
          }),
      ),
    );

    render(<PmcfEvaluationBuilder projectId="proj-1" canManage={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('pmcf-eval-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-loading')).toBeTruthy();
    });
    expect(screen.queryByTestId('pmcf-eval-result')).toBeNull();

    // Release the pending promise so the test can clean up.
    resolveFn({
      ok: true,
      status: 201,
      json: async () => EVAL_RESPONSE,
    } as Response);
    await waitFor(() => {
      expect(screen.getByTestId('pmcf-eval-result')).toBeTruthy();
    });
  });
});
