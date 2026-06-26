// @MX:NOTE Component test for Team Knowledge tab — SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-008/011/012, AC-06).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryClient from '../LibraryClient';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const ENTRIES = {
  entries: [
    {
      id: 'pa-1',
      sourceMessageId: '11111111-1111-1111-1111-111111111111',
      title: '510(k) 제출 체크리스트',
      tags: ['510k', 'FDA'],
      promotedBy: 'u-lead',
      promotedAt: '2026-06-20T03:00:00.000Z',
    },
    {
      id: 'pa-2',
      sourceMessageId: '22222222-2222-2222-2222-222222222222',
      title: 'EU MDR 임상평가 요약',
      tags: ['MDR', 'EU'],
      promotedBy: 'u-lead',
      promotedAt: '2026-06-21T03:00:00.000Z',
    },
  ],
};

function mockLibraryRoute() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : ((input as Request).url ?? '');
    if (url.startsWith('/api/knowledge-promo/library')) {
      return new Response(JSON.stringify(ENTRIES), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // personal bookmarks endpoints (not opened in this test) — return empty.
    return new Response(JSON.stringify({ bookmarks: [], tags: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

describe('Team Knowledge tab (REQ-008/011/012, AC-06)', () => {
  beforeEach(() => {
    mockLibraryRoute();
  });

  it('hides the team tab when canViewTeam is false', () => {
    render(<LibraryClient canViewTeam={false} />);
    expect(screen.queryByTestId('tab-team')).toBeNull();
    expect(screen.getByTestId('tab-personal')).toBeDefined();
  });

  it('renders promoted entries with source-message provenance link (REQ-011)', async () => {
    render(<LibraryClient canViewTeam={true} />);
    fireEvent.click(screen.getByTestId('tab-team'));
    await waitFor(() => {
      expect(screen.getAllByTestId('team-entry-card').length).toBe(2);
    });
    // REQ-011 provenance link present and points at the source message.
    const sourceLink = screen.getAllByTestId('team-entry-source-link')[0] as HTMLAnchorElement;
    expect(sourceLink.getAttribute('href')).toContain('11111111-1111-1111-1111-111111111111');
  });

  it('filters entries by tag chip (REQ-015)', async () => {
    render(<LibraryClient canViewTeam={true} />);
    fireEvent.click(screen.getByTestId('tab-team'));
    await waitFor(() => {
      expect(screen.getAllByTestId('team-entry-card').length).toBe(2);
    });
    // Click the "510k" filter chip (scoped to the tag-filter region to avoid
    // colliding with the per-entry tag spans).
    const filter = screen.getByLabelText('태그 필터');
    const chip = Array.from(filter.querySelectorAll('button')).find(
      (b) => b.textContent === '510k',
    );
    expect(chip).toBeDefined();
    fireEvent.click(chip as HTMLElement);
    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls;
      const sawFiltered = calls.some((c) => String(c[0]).includes('tag=510k'));
      expect(sawFiltered).toBe(true);
    });
  });

  it('filters entries by local search query (REQ-012)', async () => {
    render(<LibraryClient canViewTeam={true} />);
    fireEvent.click(screen.getByTestId('tab-team'));
    await waitFor(() => {
      expect(screen.getAllByTestId('team-entry-card').length).toBe(2);
    });
    fireEvent.change(screen.getByLabelText('팀 지식 검색'), {
      target: { value: 'mdr' },
    });
    expect(screen.getAllByTestId('team-entry-card').length).toBe(1);
    expect(screen.getByText('EU MDR 임상평가 요약')).toBeDefined();
  });

  it('surfaces a 403-specific message when the viewer lacks the view permission', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : ((input as Request).url ?? '');
      if (url.startsWith('/api/knowledge-promo/library')) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ bookmarks: [], tags: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<LibraryClient canViewTeam={true} />);
    fireEvent.click(screen.getByTestId('tab-team'));
    await waitFor(() => {
      expect(screen.getByText(/팀 지식 조회 권한/)).toBeDefined();
    });
  });
});
