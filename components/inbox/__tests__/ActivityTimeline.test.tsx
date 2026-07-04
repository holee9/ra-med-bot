/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityTimeline } from '../ActivityTimeline';

describe('ActivityTimeline (T-018)', () => {
  const props = {
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
    triageState: 'needs-review' as const,
  };

  it('renders activity timeline section with created and updated', () => {
    render(<ActivityTimeline {...props} />);
    expect(screen.getByTestId('activity-timeline')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('renders current triage state', () => {
    render(<ActivityTimeline {...props} />);
    expect(screen.getByText(/Current state: needs-review/)).toBeInTheDocument();
  });

  it('renders assignee when provided', () => {
    render(<ActivityTimeline {...props} assigneeId="user-1" />);
    expect(screen.getByText('Assigned: user-1')).toBeInTheDocument();
  });

  it('hides assignee row when not provided', () => {
    render(<ActivityTimeline {...props} />);
    expect(screen.queryByText(/Assigned:/)).not.toBeInTheDocument();
  });
});
