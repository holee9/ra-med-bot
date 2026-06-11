// @MX:NOTE Light render tests for the predicate history page — SPEC-REGULA-PREDICATE-001 (Task 9 Item E).
// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import PredicateHistoryPage from '../../../../app/(app)/predicate/history/page';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe('PredicateHistoryPage', () => {
  it('lists previous comparisons from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          comparisons: [
            {
              id: 'wr-1',
              resultJson: { subject_device_name: 'My Device' },
              createdAt: '2024-03-01T00:00:00.000Z',
            },
          ],
        }),
      }),
    );

    render(<PredicateHistoryPage />);
    await waitFor(() => expect(screen.getByText('My Device')).toBeTruthy());
    const link = screen.getByRole('link', { name: /My Device/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/predicate/compare?id=wr-1');
  });

  it('renders a sort toggle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ comparisons: [] }),
      }),
    );
    render(<PredicateHistoryPage />);
    await waitFor(() => expect(screen.getByTestId('history-sort-toggle')).toBeTruthy());
  });
});
