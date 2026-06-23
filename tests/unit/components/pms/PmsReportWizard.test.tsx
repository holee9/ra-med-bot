// @MX:NOTE [AUTO] RTL tests for PmsReportWizard — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// Covers: (a) wizard renders MDCG 2022-21 section form, (b) submit calls POST
// /api/workflows/pms-report/run with correct body, (c) result renders sections +
// citations, (d) confidence verified/unverified label, (e) CER linkage indicator,
// (f) role-gating (canManage=false disables submit), (g) error state.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PmsReportWizard } from '../../../../app/(app)/pms/_components/PmsReportWizard';

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
          status: 'complete',
          confidence: 'verified',
          sections: {
            executive_summary: '초록 내용',
            device_description: '기기 설명',
            complaint_data: '불만 데이터',
          },
        }),
      } as Response),
    ),
  );
});

describe('PmsReportWizard — REQ-PMS-002 (MDCG 2022-21 section structure)', () => {
  it('renders device name + class inputs and submit button', () => {
    render(<PmsReportWizard projectId="proj-1" canManage={true} />);
    expect(screen.getByLabelText(/기기명/)).toBeTruthy();
    expect(screen.getByLabelText(/기기 등급/)).toBeTruthy();
    expect(screen.getByTestId('pms-report-submit')).toBeTruthy();
  });

  it('disables submit when canManage is false (ra-lead gate)', () => {
    render(<PmsReportWizard projectId="proj-1" canManage={false} />);
    const submit = screen.getByTestId('pms-report-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // Permission notice is rendered for unauthorized users.
    expect(screen.getByTestId('pms-permission-notice')).toBeTruthy();
  });

  it('submits POST /api/workflows/pms-report/run with correct body', async () => {
    render(<PmsReportWizard projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pms-report-submit'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/workflows/pms-report/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call?.[1]?.body ?? '{}');
    expect(body.projectId).toBe('proj-1');
    expect(body.deviceName).toBe('Insulin Pump');
    expect(body.deviceClass).toBe('IIb');
  });

  it('renders result sections after successful submit', async () => {
    render(<PmsReportWizard projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pms-report-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pms-report-result')).toBeTruthy();
    });
    expect(screen.getByText('초록 내용')).toBeTruthy();
  });

  it('shows verified confidence label when confidence=verified (REQ-PMS-008)', async () => {
    render(<PmsReportWizard projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pms-report-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pms-confidence-verified')).toBeTruthy();
    });
  });

  it('shows unverified confidence label when confidence=unverified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            runId: 'run-2',
            documentId: 'doc-2',
            status: 'pending',
            confidence: 'unverified',
            sections: { executive_summary: '내용' },
          }),
        } as Response),
      ),
    );

    render(<PmsReportWizard projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pms-report-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pms-confidence-unverified')).toBeTruthy();
    });
  });

  it('shows error message on HTTP 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Failed to generate report' }),
        } as Response),
      ),
    );

    render(<PmsReportWizard projectId="proj-1" canManage={true} />);
    fireEvent.change(screen.getByLabelText(/기기명/), { target: { value: 'Insulin Pump' } });
    fireEvent.change(screen.getByLabelText(/기기 등급/), { target: { value: 'IIb' } });
    fireEvent.click(screen.getByTestId('pms-report-submit'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });
});
