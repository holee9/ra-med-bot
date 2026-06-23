// @MX:NOTE [AUTO] RTL tests for PmcfPlanBuilder — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// Covers: (a) renders Annex XIV Part B checklist items, (b) submit calls POST
// /api/workflows/pmcf-plan/run, (c) checklist coverage label, (d) role-gating.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PmcfPlanBuilder } from '../../../../app/(app)/pms/_components/PmcfPlanBuilder';

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
        json: async () => ({
          runId: 'run-1',
          documentId: 'doc-1',
          status: 'draft',
          checklist: [
            {
              id: 'pmcf_objectives',
              clause: 'Annex XIV Part B §1',
              title: 'PMCF Objectives',
              description: '목표 정의',
            },
            {
              id: 'pmcf_methods',
              clause: 'Annex XIV Part B §2',
              title: 'PMCF Methods',
              description: '방법론',
            },
          ],
        }),
      } as Response),
    ),
  );
});

describe('PmcfPlanBuilder — REQ-PMS-003 (Annex XIV Part B checklist)', () => {
  it('renders device name + class inputs and generate button', () => {
    render(<PmcfPlanBuilder projectId="proj-1" canManage={true} />);
    expect(screen.getByLabelText(/기기명/)).toBeTruthy();
    expect(screen.getByLabelText(/기기 등급/)).toBeTruthy();
    expect(screen.getByTestId('pmcf-plan-submit')).toBeTruthy();
  });

  it('disables generate when canManage is false', () => {
    render(<PmcfPlanBuilder projectId="proj-1" canManage={false} />);
    const btn = screen.getByTestId('pmcf-plan-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submits POST /api/workflows/pmcf-plan/run', async () => {
    render(<PmcfPlanBuilder projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pmcf-plan-submit'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/workflows/pmcf-plan/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('renders checklist items after successful submit', async () => {
    render(<PmcfPlanBuilder projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pmcf-plan-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-plan-result')).toBeTruthy();
    });
    expect(screen.getByText('PMCF Objectives')).toBeTruthy();
    expect(screen.getByText('PMCF Methods')).toBeTruthy();
  });

  it('shows draft status label when status=draft', async () => {
    render(<PmcfPlanBuilder projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pmcf-plan-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pmcf-plan-status')).toBeTruthy();
    });
    expect(screen.getByTestId('pmcf-plan-status').textContent).toContain('초안');
  });
});
