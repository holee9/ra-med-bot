// @MX:NOTE [AUTO] T-009 TDD RED phase — LocaleToggle component tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-040)

/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function clearLocaleCookie() {
  document.cookie = 'regula-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

afterEach(() => {
  cleanup();
  clearLocaleCookie();
});

describe('LocaleToggle (REQ-ENTERPRISE-040)', () => {
  beforeEach(() => {
    clearLocaleCookie();
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

  it('shows KO when no locale cookie is set (defaults to ko)', async () => {
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    expect(screen.getByTestId('locale-toggle').textContent).toBe('KO');
  });

  it('shows KO when locale cookie is ko', async () => {
    document.cookie = 'regula-locale=ko; path=/';
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    await waitFor(() => {
      expect(screen.getByTestId('locale-toggle').textContent).toBe('KO');
    });
  });

  it('shows EN when locale cookie is en', async () => {
    document.cookie = 'regula-locale=en; path=/';
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    await waitFor(() => {
      expect(screen.getByTestId('locale-toggle').textContent).toBe('EN');
    });
  });

  it('locale-option-ko navigates to /api/locale?locale=ko', async () => {
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    const koOption = screen.getByTestId('locale-option-ko');
    expect(koOption.getAttribute('href')).toContain('locale=ko');
  });

  it('locale-option-en navigates to /api/locale?locale=en', async () => {
    const { LocaleToggle } = await import('@/components/shell/LocaleToggle');
    render(<LocaleToggle />);
    const enOption = screen.getByTestId('locale-option-en');
    expect(enOption.getAttribute('href')).toContain('locale=en');
  });
});
