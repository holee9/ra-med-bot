/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TicketCTA } from '../TicketCTA';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('TicketCTA (AC-IMP-UI-10)', () => {
  it('renders CTA link when ticketId is present', () => {
    render(<TicketCTA ticketId="abc-123" />);

    expect(screen.getByTestId('ticket-cta')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/inbox/abc-123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('result.ticketCta')).toBeInTheDocument();
  });

  it('renders null (no testid) when ticketId is absent', () => {
    const { container } = render(<TicketCTA ticketId={undefined} />);

    expect(screen.queryByTestId('ticket-cta')).not.toBeInTheDocument();
    expect(container.firstChild).toBe(null);
  });

  it('renders null when ticketId is null', () => {
    const { container } = render(<TicketCTA ticketId={null as unknown as undefined} />);

    expect(screen.queryByTestId('ticket-cta')).not.toBeInTheDocument();
    expect(container.firstChild).toBe(null);
  });
});
