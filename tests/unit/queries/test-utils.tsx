// Shared test utilities for TanStack Query hook tests.
// Provides QueryClientWrapper factory for renderHook.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';

/**
 * Creates a fresh QueryClient wrapper for each test.
 * Disables retries to prevent long waits on error tests.
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
