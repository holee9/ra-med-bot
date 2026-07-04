/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TicketCard } from '../TicketCard';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock useInboxStore
vi.mock('@/stores/inbox', () => ({
  useInboxStore: () => ({
    setSelectedTicketId: vi.fn(),
  }),
}));

function createWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('TicketCard', () => {
  const mockTicket = {
    id: 'ticket-123',
    question: 'What is the FDA process for Class II devices?',
    triageState: 'auto' as const,
    createdAt: '2026-07-04T00:00:00Z',
    assigneeId: 'user-456',
  };

  it('renders question excerpt', () => {
    render(<TicketCard ticket={mockTicket} />, { wrapper: createWrapper });
    expect(screen.getByText(mockTicket.question)).toBeInTheDocument();
  });

  it('renders triageState badge', () => {
    render(<TicketCard ticket={mockTicket} />, { wrapper: createWrapper });
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('renders assignee when present', () => {
    render(<TicketCard ticket={mockTicket} />, { wrapper: createWrapper });
    expect(screen.getByText(`Assigned: ${mockTicket.assigneeId}`)).toBeInTheDocument();
  });

  it('renders SLA badge when slaDeadline is provided', () => {
    const ticketWithDeadline = {
      ...mockTicket,
      slaDeadline: new Date(Date.now() + 3600000).toISOString(),
    };

    const { container } = render(<TicketCard ticket={ticketWithDeadline} />, {
      wrapper: createWrapper,
    });
    // SLA badge should render as a span with time format
    const slaBadge = container.querySelector('span.text-green-600');
    expect(slaBadge).toBeInTheDocument();
    expect(slaBadge?.textContent).toBeTruthy();
    expect(slaBadge?.textContent?.length).toBeGreaterThan(0);
  });

  it('navigates to /inbox/[id] on card click', () => {
    render(<TicketCard ticket={mockTicket} />, { wrapper: createWrapper });

    const link = screen.getAllByRole('link')[0];
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', `/inbox/${mockTicket.id}`);
  });

  it('applies correct border color for each triageState', () => {
    const { container: autoContainer } = render(
      <TicketCard ticket={{ ...mockTicket, triageState: 'auto' }} />,
      { wrapper: createWrapper },
    );
    expect(autoContainer.firstElementChild as HTMLElement).toHaveClass('border-brand-300');

    const { container: needsReviewContainer } = render(
      <TicketCard ticket={{ ...mockTicket, triageState: 'needs-review' }} />,
      { wrapper: createWrapper },
    );
    expect(needsReviewContainer.firstElementChild as HTMLElement).toHaveClass('border-amber-500');

    const { container: escalatedContainer } = render(
      <TicketCard ticket={{ ...mockTicket, triageState: 'escalated' }} />,
      { wrapper: createWrapper },
    );
    expect(escalatedContainer.firstElementChild as HTMLElement).toHaveClass('border-orange-500');

    const { container: waitingContainer } = render(
      <TicketCard ticket={{ ...mockTicket, triageState: 'waiting' }} />,
      { wrapper: createWrapper },
    );
    expect(waitingContainer.firstElementChild as HTMLElement).toHaveClass('border-blue-500');
  });
});
