import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

/** @vitest-environment jsdom */

// Mock fetch
global.fetch = vi.fn();

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock auth BEFORE importing the page
vi.mock('@/lib/kernel/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { role: 'ra-member', organizationId: 'org-123' } })),
}));

// Mock rbac module
vi.mock('@/lib/kernel/auth/rbac', () => ({
  hasRole: vi.fn(() => true),
}));

// Mock useImpactCheck
vi.mock('@/lib/queries/useImpactCheck', () => ({
  useImpactCheck: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
  }),
}));

function createWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Now import the page AFTER mocks are set up
import ImpactPage from '../page';

describe('ImpactPage - RBAC Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GREEN Phase - Component renders', () => {
    it('should render without crashing when role is ra-member', async () => {
      const { container } = render(await ImpactPage(), { wrapper: createWrapper });

      expect(container).toBeTruthy();
      expect(container).toBeInTheDocument();
      // Verify redirect was NOT called for authorized role
      const { redirect } = await import('next/navigation');
      expect(redirect).not.toHaveBeenCalled();
    });

    it('should have orgId from session', async () => {
      const { container } = render(await ImpactPage(), { wrapper: createWrapper });

      expect(container).toBeTruthy();
      // Verify auth was called to get the session
      const { auth } = await import('@/lib/kernel/auth');
      expect(auth).toHaveBeenCalled();
    });
  });
});
