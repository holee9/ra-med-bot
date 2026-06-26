'use client';

// @MX:NOTE [AUTO] ThemeToggle — T-008 (REQ-ENTERPRISE-032).
// Reads theme from useUIStore and calls toggleTheme on click.
// Sun icon shown in dark mode (invite to switch to light).
// Moon icon shown in light mode (invite to switch to dark).
// Issue #158 Group C: Applies data-theme attribute immediately on mount + toggle.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-032), Issue #158 (Group C)

import { useUIStore } from '@/stores/ui';
import { useEffect } from 'react';

export default function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const isDark = theme === 'dark';
  const ariaLabel = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';

  // Apply data-theme attribute immediately on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={ariaLabel}
      onClick={toggleTheme}
      className="rounded-md border border-ink-200 px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
    >
      {isDark ? (
        // Sun icon — visible when in dark mode
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon icon — visible when in light mode
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
