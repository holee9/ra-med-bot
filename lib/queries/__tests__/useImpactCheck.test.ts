import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useImpactCheck } from '../useImpactCheck';

/** @vitest-environment jsdom */

// Mock fetch
global.fetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useImpactCheck - RED Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/impact-check with camelCase request body', async () => {
    const mockResponse = {
      matrix: [
        { level: 'required', ref: 'FDA 510(k)', note: 'Pre-market notification', market: 'us' },
      ],
      signal: 'red',
      classification: { category: 'bom', confidence: 0.85, reason: 'Component change' },
      similarCases: [{ id: 'case-1', title: 'Similar BOM', content: 'Details', similarity: 0.9 }],
      recommendation: 'high-confidence-auto-approve',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { result } = renderHook(() => useImpactCheck(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      orgId: 'org-123',
      productId: 'xray-001',
      changeType: 'bom',
      markets: ['us', 'eu'],
      changeDetail: 'Replaced detector with new model',
    });

    expect(fetch).toHaveBeenCalledWith('/api/impact-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: 'org-123',
        productId: 'xray-001',
        changeType: 'bom',
        markets: ['us', 'eu'],
        changeDetail: 'Replaced detector with new model',
      }),
    });
  });

  it('should return successful response with correct structure', async () => {
    const mockResponse = {
      matrix: [{ level: 'required', ref: 'REF-1', note: 'Note', market: 'us' }],
      signal: 'green',
      classification: { category: 'label', confidence: 0.92, reason: 'Text update' },
      similarCases: [],
      recommendation: 'high-confidence-auto-approve',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { result } = renderHook(() => useImpactCheck(), { wrapper: createWrapper() });

    const response = await result.current.mutateAsync({
      orgId: 'org-123',
      productId: 'prod-1',
      changeType: 'label',
      markets: ['kr'],
      changeDetail: 'Label text changed',
    });

    expect(response).toEqual(mockResponse);
  });

  it('should throw error on 403 Forbidden', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    const { result } = renderHook(() => useImpactCheck(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        orgId: 'org-123',
        productId: 'prod-1',
        changeType: 'sw',
        markets: ['us'],
        changeDetail: 'Software update',
      }),
    ).rejects.toThrow('Forbidden');
  });

  it('should throw error on 400 Bad Request with Zod details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid input', details: 'productId is required' }),
    } as Response);

    const { result } = renderHook(() => useImpactCheck(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        orgId: 'org-123',
        productId: '',
        changeType: 'bom',
        markets: [],
        changeDetail: '',
      }),
    ).rejects.toThrow();
  });

  it('should throw error on 500 Internal Server Error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useImpactCheck(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        orgId: 'org-123',
        productId: 'prod-1',
        changeType: 'process',
        markets: ['cn'],
        changeDetail: 'Process change',
      }),
    ).rejects.toThrow('Internal server error');
  });

  it('should throw error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useImpactCheck(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        orgId: 'org-123',
        productId: 'prod-1',
        changeType: 'sterile',
        markets: ['jp'],
        changeDetail: 'Sterile condition change',
      }),
    ).rejects.toThrow('Network error');
  });
});
