// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-008, 009, 014, 015, AC-04, AC-06, Issue #35)
// RTL coverage for the Knowledge Gap queue page + QueueActions client island.

/** @vitest-environment jsdom */

import '@testing-library/jest-dom';
import { QueueActions } from '@/components/knowledge-gap/QueueActions';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Page-level setup ----------------------------------------------------

// The page imports auth() and listQueueItems server-side. We mock both so the
// async Server Component can be rendered in jsdom without a DB or session.
const listQueueItemsMock = vi.fn();
const authMock = vi.fn();

vi.mock('@/lib/knowledge-gap/queue-query', () => ({
  listQueueItems: (...args: unknown[]) => listQueueItemsMock(...args),
}));

vi.mock('@/lib/kernel/auth', () => ({
  auth: () => authMock(),
}));

// QueueFilters uses next/navigation hooks.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// next/font/google etc. are not needed for these tests, but the page module
// graph pulls in the app layout; keep the same stubs used elsewhere.
vi.mock('next/font/google', () => {
  const mk = () => ({ variable: '--mock-font', className: 'mock-font' });
  return {
    IBM_Plex_Sans: mk,
    IBM_Plex_Mono: mk,
    Source_Serif_4: mk,
    Noto_Serif_KR: mk,
  };
});
vi.mock('@fontsource/pretendard', () => ({}));

// --- QueueActions unit tests ---------------------------------------------

describe('QueueActions — classify control role-gating', () => {
  it('shows the classify form when canClassify=true (ra-lead)', () => {
    render(
      <QueueActions queueId="q1" currentClassification={null} canClassify canReplay={false} />,
    );
    expect(screen.getByLabelText('미답변 분류')).toBeInTheDocument();
    expect(screen.getByLabelText('분류 카테고리')).toBeInTheDocument();
  });

  it('hides the classify form and shows a no-permission note when canClassify=false (ra-member)', () => {
    render(
      <QueueActions
        queueId="q1"
        currentClassification={null}
        canClassify={false}
        canReplay={false}
      />,
    );
    expect(screen.queryByLabelText('미답변 분류')).not.toBeInTheDocument();
    expect(screen.getByTestId('classify-disabled')).toBeInTheDocument();
  });
});

describe('QueueActions — classify submit flow', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ queueId: 'q1', classification: 'bug', status: 'classified' }),
          {
            status: 200,
          },
        ),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('POSTs to /api/knowledge-gap/classify and shows an audit confirmation', async () => {
    render(
      <QueueActions queueId="q1" currentClassification={null} canClassify canReplay={false} />,
    );

    fireEvent.change(screen.getByLabelText('분류 카테고리'), { target: { value: 'bug' } });
    fireEvent.click(screen.getByRole('button', { name: '분류 저장' }));

    await waitFor(() => {
      expect(screen.getByTestId('classify-success')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/knowledge-gap/classify',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"classification":"bug"'),
      }),
    );
    expect(screen.getByTestId('classify-success').textContent).toContain('audit');
  });
});

describe('QueueActions — replay trigger', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('POSTs to /api/knowledge-gap/replay/:queueId and shows the pass/fail result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            queueId: 'q1',
            passed: true,
            sourceCount: 3,
            reasonSummary: 'citations present',
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <QueueActions queueId="q1" currentClassification={null} canClassify={false} canReplay />,
    );

    fireEvent.click(screen.getByRole('button', { name: '재실행' }));

    await waitFor(() => {
      expect(screen.getByTestId('replay-result')).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/knowledge-gap/replay/q1',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByTestId('replay-result').textContent).toContain('통과');
  });

  it('shows 미통과 when replay did not pass', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ queueId: 'q1', passed: false, remainingReason: 'low confidence' }),
            { status: 200 },
          ),
        ),
    );

    render(
      <QueueActions queueId="q1" currentClassification={null} canClassify={false} canReplay />,
    );

    fireEvent.click(screen.getByRole('button', { name: '재실행' }));

    await waitFor(() => {
      expect(screen.getByTestId('replay-result')).toBeInTheDocument();
    });
    expect(screen.getByTestId('replay-result').textContent).toContain('미통과');
  });
});

// --- Page (Server Component) smoke + role-gating --------------------------

describe('KnowledgeGapPage — server component role-gating', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders queue rows from fetched data for ra-member', async () => {
    authMock.mockResolvedValue({
      user: { role: 'ra-lead', organizationId: 'org-1' },
    });
    listQueueItemsMock.mockResolvedValue([
      {
        id: 'q1',
        conversationId: 'c1',
        messageId: 'm1',
        redactedQuestion: '510(k) 제출 시…[REDACTED]',
        gapReason: 'low_confidence',
        clusterId: 'cluster-7',
        githubIssueNumber: 123,
        classification: null,
        status: 'open',
        createdAt: '2026-06-22T01:00:00.000Z',
        resolvedAt: null,
      },
    ]);

    const { default: Page } = await import('@/app/(app)/knowledge-gap/page');
    // The page is an async Server Component — await its resolved element
    // before handing it to render (RTL/jsdom cannot await Promises itself).
    const el = await Page({ searchParams: Promise.resolve({}) });
    render(el);

    await waitFor(() => {
      expect(screen.getByTestId('queue-question').textContent).toContain('[REDACTED]');
    });
    // ra-lead can classify → the classify form label is present.
    expect(screen.getByLabelText('분류 카테고리')).toBeInTheDocument();
    expect(listQueueItemsMock).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1' }));
  });

  it('renders the no-permission notice when the viewer has no role', async () => {
    authMock.mockResolvedValue({ user: {} });
    listQueueItemsMock.mockResolvedValue([]);

    const { default: Page } = await import('@/app/(app)/knowledge-gap/page');
    const el = await Page({ searchParams: Promise.resolve({}) });
    render(el);

    await waitFor(() => {
      expect(screen.getByText(/볼 권한이 없습니다/)).toBeInTheDocument();
    });
    // Without a role the helper must not be called (no orgId to scope).
    expect(listQueueItemsMock).not.toHaveBeenCalled();
  });
});
