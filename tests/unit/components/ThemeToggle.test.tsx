// @MX:NOTE [AUTO] T-008 TDD RED phase — ThemeToggle component tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-032)

/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.resetModules();
  localStorage.clear();
});

describe('ThemeToggle (REQ-ENTERPRISE-032)', () => {
  beforeEach(() => {
    // Reset the store to initial light state before each test
    vi.resetModules();
    localStorage.clear();
  });

  it('renders with data-testid="theme-toggle"', async () => {
    const { default: ThemeToggle } = await import('@/components/shell/ThemeToggle');
    render(<ThemeToggle />);
    expect(screen.getByTestId('theme-toggle')).toBeDefined();
  });

  it('has an aria-label attribute', async () => {
    const { default: ThemeToggle } = await import('@/components/shell/ThemeToggle');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
  });

  it('clicking the toggle calls toggleTheme — theme switches to dark', async () => {
    const { useUIStore } = await import('@/stores/ui');
    // Ensure starting at light
    useUIStore.getState().setTheme('light');

    const { default: ThemeToggle } = await import('@/components/shell/ThemeToggle');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    fireEvent.click(btn);
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('clicking again switches back to light', async () => {
    const { useUIStore } = await import('@/stores/ui');
    useUIStore.getState().setTheme('dark');

    const { default: ThemeToggle } = await import('@/components/shell/ThemeToggle');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    fireEvent.click(btn);
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('shows moon icon (or label) when in light mode', async () => {
    const { useUIStore } = await import('@/stores/ui');
    useUIStore.getState().setTheme('light');

    const { default: ThemeToggle } = await import('@/components/shell/ThemeToggle');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    // In light mode the button should invite switching to dark mode
    const label = btn.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/다크/);
  });

  it('shows sun icon (or label) when in dark mode', async () => {
    const { useUIStore } = await import('@/stores/ui');
    useUIStore.getState().setTheme('dark');

    const { default: ThemeToggle } = await import('@/components/shell/ThemeToggle');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    // In dark mode the button should invite switching to light mode
    const label = btn.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/라이트/);
  });
});
