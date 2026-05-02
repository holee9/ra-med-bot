'use client';

// ReactQueryProvider — wraps the app with QueryClientProvider so hooks such as
// useStreamingAnswer (which calls useQueryClient) can access the query client.
// REQ-CHAT-049, REQ-STRUCT-001

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
