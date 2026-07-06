/** @vitest-environment jsdom */
// @MX:NOTE [SPEC-V3-PERSONA-001 M3] Sidebar tier-aware filtering (REQ-V3-PER-002/H4).
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from '../Sidebar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/queries/useProjects', () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock('@/stores/ui', () => ({
  // Sidebar calls useUIStore with a selector; pass a stub store through it.
  useUIStore: (
    selector: (s: { currentProjectId: string | null; setCurrentProjectId: () => void }) => unknown,
  ) => selector({ currentProjectId: null, setCurrentProjectId: () => {} }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

function hrefsOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
}

describe('Sidebar tier prop (SPEC-V3-PERSONA-001 M3, REQ-V3-PER-002/H4)', () => {
  it('primary NAV_ITEMS always render exactly 4 regardless of tier (non-regression)', () => {
    const { container } = render(
      <Sidebar tier="employee" userRole="admin" showInbox showConsult showExpertReview />,
    );
    const primaryNav = container.querySelector('nav[aria-label="메인 내비게이션"]');
    expect(primaryNav?.querySelectorAll('a')).toHaveLength(4);
    const primaryHrefs = Array.from(primaryNav?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href'),
    );
    expect(primaryHrefs).toEqual(['/', '/chat', '/history', '/settings']);
  });

  it('employee tier hides RA/Admin-only items even when show* props are true', () => {
    const { container } = render(
      <Sidebar
        tier="employee"
        userRole="admin"
        showInbox
        showConsult
        showExpertReview
        showKnowledgeGap
        showTraceability
      />,
    );
    const links = hrefsOf(container);
    // Primary NAV_ITEMS remain.
    expect(links).toEqual(expect.arrayContaining(['/', '/chat', '/history', '/settings']));
    // RA/Admin-only routes must NOT appear in employee tier.
    expect(links).not.toContain('/inbox');
    expect(links).not.toContain('/consult');
    expect(links).not.toContain('/expert-review');
    expect(links).not.toContain('/knowledge-gap');
    expect(links).not.toContain('/traceability');
  });

  it('ra tier shows RA items when show* props are true (non-regression)', () => {
    const { container } = render(
      <Sidebar tier="ra" userRole="ra-member" showInbox showConsult showExpertReview />,
    );
    const links = hrefsOf(container);
    expect(links).toContain('/inbox');
    expect(links).toContain('/consult');
    expect(links).toContain('/expert-review');
  });

  it('admin tier shows all scoped items (admin sees everything)', () => {
    const { container } = render(
      <Sidebar tier="admin" userRole="admin" showInbox showConsult showExpertReview />,
    );
    const links = hrefsOf(container);
    expect(links).toContain('/inbox');
    expect(links).toContain('/consult');
  });

  it('tier undefined preserves existing show*-only behavior (non-regression, H4)', () => {
    const { container } = render(
      <Sidebar userRole="ra-member" showInbox showConsult showExpertReview />,
    );
    const links = hrefsOf(container);
    expect(links).toContain('/inbox');
    expect(links).toContain('/consult');
    expect(links).toContain('/expert-review');
  });

  it('employee tier hides the project switcher (RA-only context, REQ-V3-PER-002)', () => {
    const { container } = render(<Sidebar tier="employee" userRole="ra-member" />);
    expect(container.querySelector('[data-testid="project-switcher"]')).toBeNull();
  });

  it('ra tier shows the project switcher (non-regression)', () => {
    const { container } = render(<Sidebar tier="ra" userRole="ra-member" />);
    expect(container.querySelector('[data-testid="project-switcher"]')).not.toBeNull();
  });
});
