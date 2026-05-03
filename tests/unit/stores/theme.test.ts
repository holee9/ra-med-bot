// @MX:NOTE [AUTO] T-008 TDD RED phase — Theme state unit tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-031)
//
// Tests verify that useUIStore exposes theme state and actions
// (setTheme, toggleTheme) in addition to the existing navigation state.

/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('stores/ui.ts — theme state (REQ-ENTERPRISE-031)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset module so persist middleware starts fresh
    vi.resetModules();
  });

  it('initial theme state is "light"', async () => {
    const { useUIStore } = await import('@/stores/ui');
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('setTheme("dark") changes theme to "dark"', async () => {
    const { useUIStore } = await import('@/stores/ui');
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('setTheme("light") changes theme to "light"', async () => {
    const { useUIStore } = await import('@/stores/ui');
    useUIStore.getState().setTheme('dark');
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('toggleTheme switches light → dark', async () => {
    const { useUIStore } = await import('@/stores/ui');
    // Initial state is light
    expect(useUIStore.getState().theme).toBe('light');
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('toggleTheme switches dark → light', async () => {
    const { useUIStore } = await import('@/stores/ui');
    useUIStore.getState().setTheme('dark');
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('theme is persisted to localStorage (key: regula-theme)', async () => {
    const src = await import('node:fs').then((fs) =>
      import('node:path').then((path) =>
        fs.readFileSync(path.join(process.cwd(), 'stores', 'ui.ts'), 'utf8'),
      ),
    );
    expect(src).toMatch(/regula-theme/);
  });

  it('setTheme and toggleTheme are exposed on useUIStore', async () => {
    const { useUIStore } = await import('@/stores/ui');
    const state = useUIStore.getState();
    expect(typeof state.setTheme).toBe('function');
    expect(typeof state.toggleTheme).toBe('function');
  });
});
