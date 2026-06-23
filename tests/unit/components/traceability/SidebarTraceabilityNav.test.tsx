// @MX:NOTE Minimal test for the Traceability nav item — SPEC-REGULA-TRACEABILITY-001 (Issue #47).
// Mirrors the SidebarPredicateNav pattern. The main <nav> still has 10 links;
// the Traceability entry is in a separate conditional <nav>, gated by showTraceability.
/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/queries/useProjects', () => ({
  useProjects: () => ({ data: [] }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/stores/ui', () => ({
  useUIStore: (
    selector: (s: { currentProjectId: null; setCurrentProjectId: () => void }) => unknown,
  ) => selector({ currentProjectId: null, setCurrentProjectId: () => {} }),
}));

import Sidebar from '../../../../components/shell/Sidebar';

afterEach(() => cleanup());

describe('Sidebar traceability nav', () => {
  it('renders the Traceability nav item when showTraceability is true', () => {
    render(<Sidebar showTraceability />);
    const link = screen.getByTestId('sidebar-traceability-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/traceability');
    expect(link.textContent).toContain('추적 매트릭스');
  });

  it('hides the Traceability nav item by default', () => {
    render(<Sidebar />);
    expect(screen.queryByTestId('sidebar-traceability-link')).toBeNull();
  });
});
