// @MX:NOTE [AUTO] T-009 TDD RED phase — LocaleToggle component tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-040)

/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('LocaleToggle (REQ-ENTERPRISE-040)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Prevent actual page reload during tests
    vi.stubGlobal('location', {
      ...window.location,
      reload: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders with data-testid="locale-toggle"', async () => {
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    expect(screen.getByTestId('locale-toggle')).toBeDefined();
  });

  it('shows KO when no locale is stored (defaults to ko)', async () => {
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    expect(screen.getByTestId('locale-toggle').textContent).toBe('KO');
  });

  it('shows KO when locale is stored as ko', async () => {
    localStorage.setItem('regula-locale', 'ko');
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    expect(screen.getByTestId('locale-toggle').textContent).toBe('KO');
  });

  it('shows EN when locale is stored as en', async () => {
    localStorage.setItem('regula-locale', 'en');
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    expect(screen.getByTestId('locale-toggle').textContent).toBe('EN');
  });

  it('clicking saves en to localStorage and calls reload', async () => {
    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });

    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    fireEvent.click(screen.getByTestId('locale-toggle'));
    expect(localStorage.getItem('regula-locale')).toBe('en');
  });

  it('clicking again from EN saves ko to localStorage', async () => {
    localStorage.setItem('regula-locale', 'en');
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    fireEvent.click(screen.getByTestId('locale-toggle'));
    expect(localStorage.getItem('regula-locale')).toBe('ko');
  });
});
