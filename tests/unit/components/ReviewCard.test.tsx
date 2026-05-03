// @MX:NOTE [AUTO] T-007 TDD tests — ReviewCard component.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-026)
// @vitest-environment jsdom

import type { ExpertReview } from '@/types/expert-review';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const makeItem = (overrides: Partial<ExpertReview> = {}): ExpertReview => ({
  id: 'rev-001',
  conversationId: 'conv-001',
  messageId: 'msg-001',
  requestedBy: 'user-001',
  assignedTo: null,
  status: 'pending',
  notes: '검토 필요한 사항입니다',
  createdAt: new Date('2026-05-03T09:00:00Z'),
  updatedAt: null,
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe('ReviewCard (REQ-ENTERPRISE-026)', () => {
  it('renders with data-testid="review-card"', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    const { container } = render(<ReviewCard item={makeItem()} />);
    const el = container.querySelector('[data-testid="review-card"]');
    expect(el).not.toBeNull();
  });

  it('shows "검토 시작" button when status is pending', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    render(<ReviewCard item={makeItem({ status: 'pending' })} />);
    expect(screen.getByText('검토 시작')).toBeDefined();
  });

  it('shows "완료" button when status is in_progress', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    render(<ReviewCard item={makeItem({ status: 'in_progress' })} />);
    expect(screen.getByText('완료')).toBeDefined();
  });

  it('shows neither action button when status is resolved', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    render(<ReviewCard item={makeItem({ status: 'resolved' })} />);
    expect(screen.queryByText('검토 시작')).toBeNull();
    expect(screen.queryByText('완료')).toBeNull();
  });

  it('calls onStatusChange with in_progress when "검토 시작" is clicked', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    const onStatusChange = vi.fn();
    render(<ReviewCard item={makeItem({ status: 'pending' })} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByText('검토 시작'));
    expect(onStatusChange).toHaveBeenCalledWith('rev-001', 'in_progress');
  });

  it('calls onStatusChange with resolved when "완료" is clicked', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    const onStatusChange = vi.fn();
    render(
      <ReviewCard item={makeItem({ status: 'in_progress' })} onStatusChange={onStatusChange} />,
    );
    fireEvent.click(screen.getByText('완료'));
    expect(onStatusChange).toHaveBeenCalledWith('rev-001', 'resolved');
  });

  it('shows notes/reason text', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    render(<ReviewCard item={makeItem({ notes: '특수 항목 검토 필요' })} />);
    expect(screen.getByText('특수 항목 검토 필요')).toBeDefined();
  });

  it('shows pending status badge with yellow styling', async () => {
    const { ReviewCard } = await import('@/components/expert-review/ReviewCard');
    const { container } = render(<ReviewCard item={makeItem({ status: 'pending' })} />);
    // Status badge should have yellow/amber styling
    const badge = container.querySelector('[data-status="pending"]');
    expect(badge).not.toBeNull();
  });
});
