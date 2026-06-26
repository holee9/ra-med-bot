// @MX:NOTE [AUTO] ReadinessBadge unit test — verifies honest status rendering.
// Tests that pending/blocked/ready states are rendered correctly with proper styling.
// @MX:SPEC Issue #158 (Group B - Readiness surfaces)
// @vitest-environment jsdom

import '@testing-library/jest-dom';
import { ReadinessBadge } from '@/components/ui/ReadinessBadge';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('ReadinessBadge', () => {
  it('renders ready status with green dot and label', () => {
    render(<ReadinessBadge status="ready" />);
    expect(screen.getByText('준비')).toBeInTheDocument();
    expect(screen.getByText('준비')).toHaveClass('text-success-700');
  });

  it('renders pending status with amber dot and label', () => {
    render(<ReadinessBadge status="pending" />);
    expect(screen.getByText('대기 중')).toBeInTheDocument();
    expect(screen.getByText('대기 중')).toHaveClass('text-amber-700');
  });

  it('renders blocked status with red dot and label', () => {
    render(<ReadinessBadge status="blocked" />);
    expect(screen.getByText('차단')).toBeInTheDocument();
    expect(screen.getByText('차단')).toHaveClass('text-danger-700');
  });

  it('applies custom className', () => {
    const { container } = render(<ReadinessBadge status="ready" className="test-class" />);
    expect(container.firstChild).toHaveClass('test-class');
  });
});
