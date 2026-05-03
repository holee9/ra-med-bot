// @vitest-environment jsdom
// tests/unit/a11y/skip-to-content.test.tsx
// REQ-ENTERPRISE-044: SkipToContent accessibility component

import { SkipToContent } from '@/components/a11y/SkipToContent';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('SkipToContent', () => {
  it('renders skip link with correct href', () => {
    render(<SkipToContent />);
    const link = screen.getByTestId('skip-to-content');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('#main-content');
  });

  it('contains accessible text', () => {
    render(<SkipToContent />);
    expect(screen.getByText('콘텐츠로 건너뛰기')).toBeDefined();
  });

  it('renders as an anchor element', () => {
    render(<SkipToContent />);
    const link = screen.getByTestId('skip-to-content');
    expect(link.tagName.toLowerCase()).toBe('a');
  });

  it('has skip-to-content class for CSS targeting', () => {
    render(<SkipToContent />);
    const link = screen.getByTestId('skip-to-content');
    expect(link.classList.contains('skip-to-content')).toBe(true);
  });
});
