/** @vitest-environment jsdom */

/**
 * KnowledgeSourcesClient tests
 * @MX:SPEC Issue #307 D-2 Phase 2 (Knowledge Sources Settings UI)
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { KnowledgeSourcesClient } from '../KnowledgeSourcesClient';

const SAMPLE_SOURCE = {
  id: 'src-001',
  gitUrl: 'https://github.com/acme/regulations.git',
  branch: 'main',
  syncStatus: 'synced' as const,
  lastSyncedAt: '2026-06-29T10:00:00.000Z',
  createdAt: '2026-06-28T10:00:00.000Z',
};

function mockFetch(impl: typeof globalThis.fetch) {
  vi.stubGlobal('fetch', vi.fn(impl) as unknown as typeof fetch);
}

beforeEach(() => {
  // Use a fixed "now" so relative-time formatting ("방금 전", "일 전") is
  // deterministic. Real timers are kept so async fetch + waitFor resolve
  // normally — only Date.now() is stubbed via setSystemTime.
  vi.setSystemTime(new Date('2026-06-30T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('KnowledgeSourcesClient', () => {
  it('renders the form and empty state when no sources exist', async () => {
    mockFetch(async (url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString();
      if (target.startsWith('/api/ra/knowledge-sources') && !target.includes('/sync')) {
        return new Response(JSON.stringify({ sources: [] }), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    render(<KnowledgeSourcesClient />);

    await waitFor(() => {
      expect(screen.getByTestId('ks-empty')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ks-git-url')).toBeInTheDocument();
    expect(screen.getByTestId('ks-branch')).toHaveValue('main');
    expect(screen.getByTestId('ks-submit')).toHaveTextContent('연결');
  });

  it('submits a new source via POST and refreshes the list', async () => {
    let listCallCount = 0;
    mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      const target = typeof url === 'string' ? url : url.toString();
      const method = init?.method ?? 'GET';

      if (target === '/api/ra/knowledge-sources' && method === 'GET') {
        listCallCount += 1;
        const sources = listCallCount === 1 ? [] : [SAMPLE_SOURCE];
        return new Response(JSON.stringify({ sources }), { status: 200 });
      }
      if (target === '/api/ra/knowledge-sources' && method === 'POST') {
        return new Response(JSON.stringify({ source: SAMPLE_SOURCE }), { status: 201 });
      }
      return new Response('', { status: 404 });
    });

    render(<KnowledgeSourcesClient />);
    await waitFor(() => expect(screen.getByTestId('ks-empty')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('ks-git-url'), {
      target: { value: 'https://github.com/acme/regulations.git' },
    });
    fireEvent.change(screen.getByTestId('ks-branch'), { target: { value: 'main' } });
    fireEvent.change(screen.getByTestId('ks-auth-token'), { target: { value: 'tok_abc' } });
    fireEvent.click(screen.getByTestId('ks-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ks-row-src-001')).toBeInTheDocument();
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall?.[1]?.body).toEqual(
      JSON.stringify({
        git_url: 'https://github.com/acme/regulations.git',
        branch: 'main',
        auth_token: 'tok_abc',
      }),
    );
  });

  it('shows a form error when git_url is empty', async () => {
    mockFetch(async () => new Response(JSON.stringify({ sources: [] }), { status: 200 }));

    render(<KnowledgeSourcesClient />);
    await waitFor(() => expect(screen.getByTestId('ks-empty')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('ks-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ks-form-error')).toHaveTextContent('Git 저장소 URL을 입력하세요.');
    });
  });

  it('rejects non-https URLs client-side', async () => {
    mockFetch(async () => new Response(JSON.stringify({ sources: [] }), { status: 200 }));

    render(<KnowledgeSourcesClient />);
    await waitFor(() => expect(screen.getByTestId('ks-empty')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('ks-git-url'), {
      target: { value: 'git@github.com:acme/regulations.git' },
    });
    fireEvent.click(screen.getByTestId('ks-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ks-form-error')).toHaveTextContent(/https:\/\//);
    });
  });

  it('renders sync status badge and last-synced time per row', async () => {
    mockFetch(
      async () => new Response(JSON.stringify({ sources: [SAMPLE_SOURCE] }), { status: 200 }),
    );

    render(<KnowledgeSourcesClient />);

    const status = await screen.findByTestId('ks-status-src-001');
    expect(status).toHaveTextContent('동기화됨');
    expect(screen.getByTestId('ks-row-src-001')).toHaveTextContent('마지막 동기화:');
    expect(screen.getByTestId('ks-row-src-001')).toHaveTextContent('main');
  });

  it('triggers re-sync on click and disables the row button while pending', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = typeof url === 'string' ? url : url.toString();
      if (target.includes('/sync') && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ sources: [SAMPLE_SOURCE] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<KnowledgeSourcesClient />);
    const syncButton = await screen.findByTestId('ks-sync-src-001');

    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(syncButton).toHaveTextContent('동기화 중…');
    });
    await waitFor(() => {
      expect(syncButton).toHaveTextContent('다시 동기화');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ra/knowledge-sources/src-001/sync',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('opens delete confirmation dialog and deletes on confirm', async () => {
    let deleted = false;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = typeof url === 'string' ? url : url.toString();
      const method = init?.method ?? 'GET';
      if (target === '/api/ra/knowledge-sources/src-001' && method === 'DELETE') {
        deleted = true;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (target === '/api/ra/knowledge-sources' && method === 'GET') {
        // After delete, the list refresh returns empty.
        const sources = deleted ? [] : [SAMPLE_SOURCE];
        return new Response(JSON.stringify({ sources }), { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<KnowledgeSourcesClient />);

    const deleteButton = await screen.findByTestId('ks-delete-src-001');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('ks-delete-dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ks-delete-confirm')).toHaveTextContent('삭제');

    fireEvent.click(screen.getByTestId('ks-delete-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('ks-row-src-001')).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ra/knowledge-sources/src-001',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('cancel button dismisses the delete dialog without calling DELETE', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ sources: [SAMPLE_SOURCE] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<KnowledgeSourcesClient />);

    const deleteButton = await screen.findByTestId('ks-delete-src-001');
    fireEvent.click(deleteButton);

    await waitFor(() => expect(screen.getByTestId('ks-delete-dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('ks-delete-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('ks-delete-dialog')).not.toBeInTheDocument();
    });

    const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit?]>;
    const deleteCall = calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall).toBeUndefined();
  });

  it('shows an inline error when the list fails to load', async () => {
    mockFetch(async () => new Response('', { status: 500 }));

    render(<KnowledgeSourcesClient />);

    await waitFor(() => {
      expect(screen.getByTestId('ks-load-error')).toBeInTheDocument();
    });
  });

  it('handles invalid_git_url response from server', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return new Response(JSON.stringify({ sources: [] }), { status: 200 });
      if (method === 'POST')
        return new Response(JSON.stringify({ error: 'invalid_git_url' }), { status: 400 });
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<KnowledgeSourcesClient />);
    await waitFor(() => expect(screen.getByTestId('ks-empty')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('ks-git-url'), {
      target: { value: 'https://example.com/some-page' },
    });
    fireEvent.click(screen.getByTestId('ks-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ks-form-error')).toHaveTextContent('잘못된 Git URL 형식입니다.');
    });
  });

  it('does not send auth_token when the field is left blank', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return new Response(JSON.stringify({ sources: [] }), { status: 200 });
      }
      if (method === 'POST') {
        return new Response(JSON.stringify({ source: SAMPLE_SOURCE }), { status: 201 });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<KnowledgeSourcesClient />);
    await waitFor(() => expect(screen.getByTestId('ks-empty')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('ks-git-url'), {
      target: { value: 'https://github.com/acme/regulations.git' },
    });
    fireEvent.click(screen.getByTestId('ks-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit?]>;
    const postCall = calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse(postCall?.[1]?.body as string);
    expect(body.auth_token).toBeUndefined();
  });
});
