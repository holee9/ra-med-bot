/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ViewerTicketSummary } from '../ViewerTicketSummary';

describe('ViewerTicketSummary (T-025, REQ-V3-UI-034)', () => {
  const ticket = {
    id: 't-1',
    question: 'FDA Class II 절차가 어떻게 되나요?',
    triageState: 'closed' as const,
  };

  it('renders question and triage state', () => {
    render(<ViewerTicketSummary ticket={ticket} />);
    expect(screen.getByTestId('viewer-ticket-summary')).toBeInTheDocument();
    expect(screen.getByText('FDA Class II 절차가 어떻게 되나요?')).toBeInTheDocument();
    expect(screen.getByText(/상태: closed/)).toBeInTheDocument();
  });

  it('renders final answer when provided', () => {
    render(<ViewerTicketSummary ticket={{ ...ticket, finalAnswer: '승인된 답변입니다' }} />);
    expect(screen.getByTestId('viewer-final-answer')).toBeInTheDocument();
    expect(screen.getByText('승인된 답변입니다')).toBeInTheDocument();
  });

  it('hides final answer section when not provided', () => {
    render(<ViewerTicketSummary ticket={ticket} />);
    expect(screen.queryByTestId('viewer-final-answer')).not.toBeInTheDocument();
  });

  it('does NOT render RA-only fields (raAssignee, escalateTo, audit) — viewer gating (REQ-V3-UI-034)', () => {
    // viewer summary intentionally omits raAssignee/escalateTo/audit timeline.
    const { container } = render(<ViewerTicketSummary ticket={ticket} />);
    expect(container.textContent).not.toContain('raAssignee');
    expect(container.textContent).not.toContain('escalateTo');
    expect(container.querySelector('[data-testid="activity-timeline"]')).not.toBeInTheDocument();
  });
});
