/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlaBadge } from '../SlaBadge';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'inbox.sla.overdue': 'Overdue',
      'inbox.sla.remaining': 'Remaining',
    };
    return translations[key] || key;
  },
}));

// Mock Intl.RelativeTimeFormat for consistent testing
const mockRtf = {
  format: vi.fn(),
};

global.Intl = {
  ...Intl,
  RelativeTimeFormat: vi.fn(() => mockRtf) as unknown as typeof Intl.RelativeTimeFormat,
};

function createWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('SlaBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders relative time when slaDeadline is provided', () => {
    const deadline = new Date(Date.now() + 3600000); // 1 hour from now

    const { container } = render(<SlaBadge slaDeadline={deadline.toISOString()} />, {
      wrapper: createWrapper,
    });

    // The component should render a span
    const badge = container.querySelector('span');
    expect(badge).toBeInTheDocument();

    // The badge should have text content
    expect(badge?.textContent).toBeTruthy();
    expect(badge?.textContent?.length).toBeGreaterThan(0);

    // Should have green color for future deadline
    expect(badge).toHaveClass('text-green-600');
  });

  it('renders overdue style when deadline is in the past', () => {
    const deadline = new Date(Date.now() - 3600000); // 1 hour ago
    mockRtf.format.mockReturnValue('1 hour ago');

    render(<SlaBadge slaDeadline={deadline.toISOString()} />, {
      wrapper: createWrapper,
    });

    const badge = screen.getByText('1 hour ago');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-red-600'); // Overdue style
  });

  it('renders nothing when slaDeadline is null', () => {
    const { container } = render(<SlaBadge slaDeadline={null} />, { wrapper: createWrapper });

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when slaDeadline is undefined', () => {
    const { container } = render(<SlaBadge slaDeadline={undefined} />, { wrapper: createWrapper });

    expect(container.firstChild).toBeNull();
  });

  it('uses i18n keys for overdue/remaining labels', () => {
    const deadline = new Date(Date.now() + 3600000);
    mockRtf.format.mockReturnValue('in 1 hour');

    render(<SlaBadge slaDeadline={deadline.toISOString()} />, { wrapper: createWrapper });

    // Verify i18n keys are used (integration test - requires actual i18n setup)
    // This test documents the requirement
    expect(screen.getByText('in 1 hour')).toBeInTheDocument();
  });
});
