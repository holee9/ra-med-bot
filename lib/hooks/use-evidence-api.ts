/**
 * React hooks for Evidence API operations
 *
 * Provides typed hooks with loading states, error handling,
 * and proper error message display for UI components.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  hybridRaClient,
  EvidenceLinkRequest,
  EvidenceLink,
  EvidenceLinksResponse,
  EvidenceBinderRequest,
  EvidenceBinder,
  ApiError,
} from '@/lib/api/hybrid-ra-client';

/**
 * Hook for creating evidence links
 */
export function useCreateEvidenceLink() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EvidenceLink | null>(null);

  const createLink = useCallback(async (request: EvidenceLinkRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await hybridRaClient.createEvidenceLink(request);
      setData(result);
      return result;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || '증거 링크 생성에 실패했습니다.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { createLink, isLoading, error, data };
}

/**
 * Hook for fetching evidence links
 */
export function useEvidenceLinks(reqId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EvidenceLinksResponse | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!reqId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await hybridRaClient.getEvidenceLinks(reqId);
      setData(result);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || '증거 링크 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [reqId]);

  return { fetchLinks, isLoading, error, data };
}

/**
 * Hook for creating evidence binders
 */
export function useCreateEvidenceBinder() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EvidenceBinder | null>(null);

  const createBinder = useCallback(async (request: EvidenceBinderRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await hybridRaClient.createEvidenceBinder(request);
      setData(result);
      return result;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || '증거 바인더 생성에 실패했습니다.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { createBinder, isLoading, error, data };
}
