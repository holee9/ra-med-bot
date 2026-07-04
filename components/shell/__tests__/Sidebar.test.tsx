/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/queries/useProjects', () => ({
  useProjects: () => ({ data: [], isLoading: false }),
}));

import Sidebar from '../Sidebar';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Sidebar characterization (T-006)', () => {
  it('renders "새 상담" primary button', () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText('새 상담')).toBeInTheDocument();
  });

  it('renders NAV_ITEMS: 홈, Chat, 히스토리, 설정', () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText('홈')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /채팅|Chat/ })).toBeInTheDocument();
    expect(screen.getByText('히스토리')).toBeInTheDocument();
    expect(screen.getByText('설정')).toBeInTheDocument();
  });

  it('respects showExpertReview prop', () => {
    const { rerender } = render(<Sidebar showExpertReview={false} />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('sidebar-expert-review-link')).not.toBeInTheDocument();
    rerender(<Sidebar showExpertReview={true} />);
    expect(screen.getByTestId('sidebar-expert-review-link')).toBeInTheDocument();
  });

  it('respects showPredicate prop', () => {
    const { rerender } = render(<Sidebar showPredicate={false} />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('sidebar-predicate-link')).not.toBeInTheDocument();
    rerender(<Sidebar showPredicate={true} />);
    expect(screen.getByTestId('sidebar-predicate-link')).toBeInTheDocument();
  });

  it('T-007 precondition: no Inbox link yet', () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.queryByTestId('sidebar-inbox-link')).not.toBeInTheDocument();
  });
});

describe('Sidebar showInbox prop (T-007 GREEN)', () => {
  it('renders Inbox link when showInbox=true', () => {
    render(<Sidebar showInbox={true} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('sidebar-inbox-link')).toBeInTheDocument();
    expect(screen.getByText('인박스')).toBeInTheDocument();
  });

  it('hides Inbox link when showInbox=false or undefined', () => {
    const { container: container1 } = render(<Sidebar showInbox={false} />, {
      wrapper: createWrapper(),
    });
    expect(container1.querySelector('[data-testid="sidebar-inbox-link"]')).not.toBeInTheDocument();
    const { container: container2 } = render(<Sidebar />, { wrapper: createWrapper() });
    expect(container2.querySelector('[data-testid="sidebar-inbox-link"]')).not.toBeInTheDocument();
  });
});
