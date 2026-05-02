// @MX:NOTE [AUTO] T-003 TDD RED phase — ProjectStore unit tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-049, REQ-BREADTH-050, REQ-BREADTH-051)

/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';

describe('stores/project.ts (REQ-BREADTH-049, REQ-BREADTH-050, REQ-BREADTH-051)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('useProjectStore module can be imported', async () => {
    const mod = await import('@/stores/project').catch(() => {
      throw new Error('stores/project.ts does not exist. RED phase.');
    });
    expect(mod.useProjectStore).toBeDefined();
  });

  it('initial state: currentProject is null', async () => {
    const { useProjectStore } = await import('@/stores/project').catch(() => {
      throw new Error('stores/project.ts does not exist. RED phase.');
    });
    expect(useProjectStore.getState().currentProject).toBeNull();
  });

  it('initial state: recentProjects is empty array', async () => {
    const { useProjectStore } = await import('@/stores/project').catch(() => {
      throw new Error('stores/project.ts does not exist. RED phase.');
    });
    expect(useProjectStore.getState().recentProjects).toEqual([]);
  });

  it('setCurrentProject sets and clears currentProject', async () => {
    const { useProjectStore } = await import('@/stores/project').catch(() => {
      throw new Error('stores/project.ts does not exist. RED phase.');
    });

    const mockProject = {
      id: 'proj-1',
      organizationId: 'org-1',
      name: 'Test Project',
      deviceClass: null,
      targetMarkets: [],
      color: null,
      submissionDate: null,
      status: 'active',
      createdAt: new Date(),
    };

    useProjectStore.getState().setCurrentProject(mockProject);
    expect(useProjectStore.getState().currentProject).toMatchObject({ id: 'proj-1' });

    useProjectStore.getState().setCurrentProject(null);
    expect(useProjectStore.getState().currentProject).toBeNull();
  });

  it('addRecentProject adds to recentProjects, capped at 5', async () => {
    const { useProjectStore } = await import('@/stores/project').catch(() => {
      throw new Error('stores/project.ts does not exist. RED phase.');
    });

    const makeProject = (n: number) => ({
      id: `proj-${n}`,
      organizationId: 'org-1',
      name: `Project ${n}`,
      deviceClass: null,
      targetMarkets: [],
      color: null,
      submissionDate: null,
      status: 'active',
      createdAt: new Date(),
    });

    for (let i = 1; i <= 6; i++) {
      useProjectStore.getState().addRecentProject(makeProject(i));
    }

    const recent = useProjectStore.getState().recentProjects;
    expect(recent).toHaveLength(5);
    expect(recent.map((p) => p.id)).not.toContain('proj-1'); // oldest evicted
    expect(recent.map((p) => p.id)).toContain('proj-6'); // newest present
  });

  it('addRecentProject deduplicates by id (moves to front on revisit)', async () => {
    const { useProjectStore } = await import('@/stores/project').catch(() => {
      throw new Error('stores/project.ts does not exist. RED phase.');
    });

    const makeProject = (n: number) => ({
      id: `proj-${n}`,
      organizationId: 'org-1',
      name: `Project ${n}`,
      deviceClass: null,
      targetMarkets: [],
      color: null,
      submissionDate: null,
      status: 'active',
      createdAt: new Date(),
    });

    useProjectStore.getState().addRecentProject(makeProject(1));
    useProjectStore.getState().addRecentProject(makeProject(2));
    useProjectStore.getState().addRecentProject(makeProject(1)); // re-add proj-1

    const recent = useProjectStore.getState().recentProjects;
    // proj-1 should appear only once
    expect(recent.filter((p) => p.id === 'proj-1')).toHaveLength(1);
    // proj-1 should be at the front (most recent)
    expect((recent[0] as { id: string }).id).toBe('proj-1');
  });
});
