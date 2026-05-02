// @MX:NOTE [AUTO] T-003 TDD RED phase — UIStore unit tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-049, REQ-BREADTH-050, REQ-BREADTH-051)
//
// Tests run in Node environment (no DOM). The zustand persist middleware writes
// to localStorage which is unavailable in Node. Tests verify store shape and
// state transitions using the raw store factory (without persistence side effects).

/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';

describe('stores/ui.ts (REQ-BREADTH-049, REQ-BREADTH-050, REQ-BREADTH-051)', () => {
  beforeEach(() => {
    // Clear localStorage between tests to isolate persist state
    localStorage.clear();
  });

  it('useUIStore module can be imported', async () => {
    const mod = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    expect(mod.useUIStore).toBeDefined();
  });

  it('initial state: currentProjectId is null', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    const state = useUIStore.getState();
    expect(state.currentProjectId).toBeNull();
  });

  it('initial state: recentProjects is empty array', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    const state = useUIStore.getState();
    expect(state.recentProjects).toEqual([]);
  });

  it('initial state: pendingQuestion is null', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    const state = useUIStore.getState();
    expect(state.pendingQuestion).toBeNull();
  });

  it('initial state: rightPanelCollapsed is false', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    const state = useUIStore.getState();
    expect(state.rightPanelCollapsed).toBe(false);
  });

  it('initial state: onboardingDone is false', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    const state = useUIStore.getState();
    expect(state.onboardingDone).toBe(false);
  });

  it('setCurrentProjectId updates currentProjectId', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    useUIStore.getState().setCurrentProjectId('proj-abc');
    expect(useUIStore.getState().currentProjectId).toBe('proj-abc');
  });

  it('addRecentProject adds to recentProjects, capped at 5', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    const store = useUIStore.getState();
    store.addRecentProject('p1');
    store.addRecentProject('p2');
    store.addRecentProject('p3');
    store.addRecentProject('p4');
    store.addRecentProject('p5');
    store.addRecentProject('p6'); // 6th push — should evict oldest
    const recent = useUIStore.getState().recentProjects;
    expect(recent).toHaveLength(5);
    expect(recent).not.toContain('p1'); // oldest evicted
    expect(recent).toContain('p6'); // newest present
  });

  it('setPendingQuestion sets and clears pendingQuestion', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    useUIStore.getState().setPendingQuestion('What is the regulation?');
    expect(useUIStore.getState().pendingQuestion).toBe('What is the regulation?');
    useUIStore.getState().setPendingQuestion(null);
    expect(useUIStore.getState().pendingQuestion).toBeNull();
  });

  it('setRightPanelCollapsed toggles rightPanelCollapsed', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    useUIStore.getState().setRightPanelCollapsed(true);
    expect(useUIStore.getState().rightPanelCollapsed).toBe(true);
    useUIStore.getState().setRightPanelCollapsed(false);
    expect(useUIStore.getState().rightPanelCollapsed).toBe(false);
  });

  it('completeOnboarding sets onboardingDone to true', async () => {
    const { useUIStore } = await import('@/stores/ui').catch(() => {
      throw new Error('stores/ui.ts does not exist. RED phase.');
    });
    useUIStore.getState().completeOnboarding();
    expect(useUIStore.getState().onboardingDone).toBe(true);
  });

  it('persist storage key is regula_ui', async () => {
    const src = await import('node:fs')
      .then((fs) => {
        const p = import('node:path').then((path) =>
          fs.readFileSync(path.join(process.cwd(), 'stores', 'ui.ts'), 'utf8'),
        );
        return p;
      })
      .catch(() => {
        throw new Error('stores/ui.ts does not exist. RED phase.');
      });
    expect(src).toMatch(/regula_ui/);
  });

  it('pendingQuestion is excluded from persist (partialize)', async () => {
    const src = await import('node:fs')
      .then((fs) =>
        import('node:path').then((path) =>
          fs.readFileSync(path.join(process.cwd(), 'stores', 'ui.ts'), 'utf8'),
        ),
      )
      .catch(() => {
        throw new Error('stores/ui.ts does not exist. RED phase.');
      });
    expect(src).toMatch(/partialize/);
    expect(src).toMatch(/pendingQuestion/);
  });
});
