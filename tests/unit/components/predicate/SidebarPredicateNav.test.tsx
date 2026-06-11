// @MX:NOTE Minimal test for the Predicate Search nav item — SPEC-REGULA-PREDICATE-001 (Task 9 Item F).
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Sidebar pulls in project queries + zustand; stub them to a stable shape.
vi.mock('@/lib/queries/useProjects', () => ({
  useProjects: () => ({ data: [] }),
}));
vi.mock('@/stores/ui', () => ({
  useUIStore: (
    selector: (s: { currentProjectId: null; setCurrentProjectId: () => void }) => unknown,
  ) => selector({ currentProjectId: null, setCurrentProjectId: () => {} }),
}));

import Sidebar from '../../../../components/shell/Sidebar';

afterEach(() => cleanup());

describe('Sidebar predicate nav', () => {
  it('renders the Predicate Search nav item when showPredicate is true', () => {
    render(<Sidebar showPredicate />);
    const link = screen.getByTestId('sidebar-predicate-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/predicate');
  });

  it('hides the Predicate Search nav item by default', () => {
    render(<Sidebar />);
    expect(screen.queryByTestId('sidebar-predicate-link')).toBeNull();
  });
});
