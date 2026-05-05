// @MX:NOTE Unit tests for BetaBadge — TASK-003.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BetaBadge } from '../../../components/ui/BetaBadge';

afterEach(() => {
  cleanup();
});

describe('BetaBadge', () => {
  it('renders default Beta label', () => {
    render(<BetaBadge />);
    expect(screen.getByTestId('beta-badge').textContent).toBe('Beta');
  });

  it('renders custom children', () => {
    render(<BetaBadge>Preview</BetaBadge>);
    expect(screen.getByTestId('beta-badge').textContent).toBe('Preview');
  });

  it('applies sm size classes', () => {
    render(<BetaBadge size="sm" />);
    const el = screen.getByTestId('beta-badge');
    expect(el.className).toMatch(/text-\[10px\]/);
  });

  it('applies md size classes by default', () => {
    render(<BetaBadge />);
    const el = screen.getByTestId('beta-badge');
    expect(el.className).toMatch(/text-xs/);
  });

  it('uses accent token palette', () => {
    render(<BetaBadge />);
    const el = screen.getByTestId('beta-badge');
    expect(el.className).toMatch(/bg-accent-50/);
    expect(el.className).toMatch(/border-accent-400/);
    expect(el.className).toMatch(/text-accent-700/);
  });

  it('appends extra className', () => {
    render(<BetaBadge className="extra-class" />);
    const el = screen.getByTestId('beta-badge');
    expect(el.className).toMatch(/extra-class/);
  });
});
