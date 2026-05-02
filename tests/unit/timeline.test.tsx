// @MX:NOTE Unit tests for Timeline component — REQ-STRUCT-024.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Timeline } from '../../components/chat/Timeline';

afterEach(() => {
  cleanup();
});

const items = [
  { date: '2026-01-15', title: '사전 제출 미팅', description: 'FDA와 사전 미팅' },
  { date: '2026-03-01', title: '510(k) 제출', description: '제출 마감일', current: true },
  { date: '2026-09-01', title: '승인 예상', description: '검토 완료 예상' },
];

describe('Timeline component (REQ-STRUCT-024)', () => {
  it('renders all items', () => {
    render(<Timeline items={items} />);
    expect(screen.getByText('사전 제출 미팅')).toBeDefined();
    expect(screen.getByText('510(k) 제출')).toBeDefined();
    expect(screen.getByText('승인 예상')).toBeDefined();
  });

  it('renders dates', () => {
    render(<Timeline items={items} />);
    expect(screen.getByText('2026-01-15')).toBeDefined();
  });

  it('applies amber styling to current item bullet', () => {
    const { container } = render(<Timeline items={items} />);
    // Find elements with bg-accent-500 class (current item bullet)
    const amberElements = container.querySelectorAll('.bg-accent-500');
    expect(amberElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders aria-label with "현재 단계:" prefix for current item', () => {
    render(<Timeline items={items} />);
    // The date element for the current item should have aria-label
    const currentElements = screen.getAllByLabelText(/현재 단계:/);
    expect(currentElements.length).toBe(1);
  });

  it('renders without crashing for single item', () => {
    const { container } = render(
      <Timeline items={[{ date: '2026-01-01', title: '시작', description: '시작일' }]} />,
    );
    expect(container).toBeDefined();
  });
});
