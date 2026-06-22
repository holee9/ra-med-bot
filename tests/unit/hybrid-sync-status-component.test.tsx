/** @vitest-environment jsdom */

import '@testing-library/jest-dom';
import { HybridSyncStatus } from '@/components/knowledge/HybridSyncStatus';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function mockSyncStatus(syncStatus: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ok',
          sync: {
            last_sync: '2026-06-22T10:00:00Z',
            total_documents: 42,
            sync_status: syncStatus,
            tenant_id: 'tenant-001',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
}

describe('HybridSyncStatus', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('surfaces failed sync state with retry guidance', async () => {
    mockSyncStatus('failed');

    render(<HybridSyncStatus />);

    await waitFor(() => expect(screen.getByText('동기화 실패')).toBeInTheDocument());
    expect(screen.getByText(/재시도 또는 관리자 확인이 필요합니다/)).toBeInTheDocument();
  });

  it('surfaces retry-needed sync state with action guidance', async () => {
    mockSyncStatus('retry-needed');

    render(<HybridSyncStatus />);

    await waitFor(() => expect(screen.getByText('재시도 필요')).toBeInTheDocument());
    expect(screen.getByText(/재동기화를 요청하세요/)).toBeInTheDocument();
  });

  it('surfaces pending sync state without a blank status label', async () => {
    mockSyncStatus('pending');

    render(<HybridSyncStatus />);

    await waitFor(() => expect(screen.getByText('동기화 대기 중')).toBeInTheDocument());
    expect(screen.getByText(/동기화 작업이 대기열에 있습니다/)).toBeInTheDocument();
  });
});
