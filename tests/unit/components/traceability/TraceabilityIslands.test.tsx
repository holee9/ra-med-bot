// @MX:NOTE Component tests for traceability islands — SPEC-REGULA-TRACEABILITY-001.
// Covers MatrixFilters (filter selects present + URL navigation on change) and
// PacketExport (calls fetch with the correct format=pdf / format=md).
/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  pushMock.mockClear();
});

describe('MatrixFilters island (REQ-005)', () => {
  it('renders jurisdiction, product, risk level, and stale filters', async () => {
    const { default: MatrixFilters } = await import(
      '../../../../components/traceability/MatrixFilters'
    );
    render(<MatrixFilters />);
    const form = screen.getByLabelText('추적 매트릭스 필터');
    expect(form).toBeTruthy();
    // REQ-005: all five filters present (jurisdiction, product, packageId, riskLevel, stale).
    expect(screen.getByText('관할권')).toBeTruthy();
    expect(screen.getByText('제품')).toBeTruthy();
    expect(screen.getByText('위험 수준')).toBeTruthy();
    expect(screen.getByText('Stale 출처')).toBeTruthy();
  });

  it('pushes a new URL when the jurisdiction filter changes', async () => {
    const { default: MatrixFilters } = await import(
      '../../../../components/traceability/MatrixFilters'
    );
    render(<MatrixFilters />);
    const selects = Array.from(
      screen.getByLabelText('추적 매트릭스 필터').querySelectorAll('select'),
    ) as HTMLSelectElement[];
    const jurisdiction = selects[0];
    if (!jurisdiction) throw new Error('jurisdiction select missing');
    // The jurisdiction select is the first one.
    fireEvent.change(jurisdiction, { target: { value: 'FDA' } });
    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushed = pushMock.mock.calls[0]?.[0] as string | undefined;
    expect(pushed).toContain('/traceability?');
    expect(pushed).toContain('jurisdiction=FDA');
  });
});

describe('PacketExport island (REQ-008)', () => {
  it('calls fetch with format=pdf and format=md on the respective buttons', async () => {
    const fetchMock = vi.fn();
    const realFetch = globalThis.fetch;
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};
    globalThis.fetch = fetchMock.mockImplementation(async (_input: RequestInfo | URL) => ({
      ok: true,
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="pkt.pdf"' }),
      blob: async () => new Blob(['x'], { type: 'application/pdf' }),
      json: async () => ({}),
    }));
    try {
      const { PacketExport } = await import('../../../../components/traceability/PacketExport');
      render(<PacketExport deliverableId="00000000-0000-0000-0000-0000000000aa" />);

      fireEvent.click(screen.getByTestId('packet-export-pdf'));
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/traceability/00000000-0000-0000-0000-0000000000aa/export?format=pdf',
          { method: 'GET' },
        );
      });

      fireEvent.click(screen.getByTestId('packet-export-md'));
      await waitFor(() => {
        const calls = fetchMock.mock.calls.map((c) => c[0]);
        expect(calls).toContain(
          '/api/traceability/00000000-0000-0000-0000-0000000000aa/export?format=md',
        );
      });
    } finally {
      globalThis.fetch = realFetch;
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
    }
  });
});
