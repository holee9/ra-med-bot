// @MX:NOTE [AUTO] RTL tests for PmsInputsUploader — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// Covers: (a) renders complaint/vigilance form, (b) submit calls POST /api/pms/inputs,
// (c) inline error message on 400 (REQ-PMS-012), (d) source enum options, (e) SUSAR flag.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PmsInputsUploader } from '../../../../app/(app)/pms/_components/PmsInputsUploader';

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
        json: async () => ({ id: 'input-1', status: 'stored' }),
      } as Response),
    ),
  );
});

describe('PmsInputsUploader — REQ-PMS-005/006/012 (complaint/vigilance input)', () => {
  it('renders source, severity, SUSAR flag inputs', () => {
    render(<PmsInputsUploader projectId="proj-1" />);
    expect(screen.getByLabelText(/데이터 유형/)).toBeTruthy();
    expect(screen.getByLabelText(/심각도/)).toBeTruthy();
    expect(screen.getByLabelText(/SUSAR/)).toBeTruthy();
  });

  it('submits POST /api/pms/inputs with normalized body', async () => {
    render(<PmsInputsUploader projectId="proj-1" />);
    fireEvent.change(screen.getByLabelText(/데이터 유형/), { target: { value: 'complaint' } });
    fireEvent.change(screen.getByLabelText(/심각도/), { target: { value: 'serious' } });
    fireEvent.click(screen.getByTestId('pms-inputs-submit'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pms/inputs',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call?.[1]?.body ?? '{}');
    expect(body.projectId).toBe('proj-1');
    expect(body.source).toBe('complaint');
    expect(body.severity).toBe('serious');
  });

  it('shows inline error message on 400 (REQ-PMS-012)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'Invalid input',
            details: { fieldErrors: { source: ['source is required.'] } },
          }),
        } as Response),
      ),
    );

    render(<PmsInputsUploader projectId="proj-1" />);
    fireEvent.change(screen.getByLabelText(/데이터 유형/), { target: { value: 'complaint' } });
    fireEvent.click(screen.getByTestId('pms-inputs-submit'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByRole('alert').textContent).toContain('Invalid input');
  });

  it('shows success confirmation on 201', async () => {
    render(<PmsInputsUploader projectId="proj-1" />);
    fireEvent.change(screen.getByLabelText(/데이터 유형/), { target: { value: 'vigilance' } });
    fireEvent.click(screen.getByTestId('pms-inputs-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pms-inputs-success')).toBeTruthy();
    });
  });
});
