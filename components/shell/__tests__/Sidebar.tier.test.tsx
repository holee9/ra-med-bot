/** @vitest-environment jsdom */
// @MX:NOTE [SPEC-V3-PERSONA-001 M3] Sidebar tier-aware filtering (REQ-V3-PER-002/H4).
// 2026-10-20 scope purge: removed-flag assertions dropped with the 13 deleted navs.
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
      <Sidebar tier="employee" userRole="admin" showInbox showExpertReview />,
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
      <Sidebar tier="employee" userRole="admin" showInbox showExpertReview showGovernance />,
    );
    const links = hrefsOf(container);
    // Primary NAV_ITEMS remain.
    expect(links).toEqual(expect.arrayContaining(['/', '/chat', '/history', '/settings']));
    // RA/Admin-only routes must NOT appear in employee tier.
    expect(links).not.toContain('/inbox');
    expect(links).not.toContain('/expert-review');
    expect(links).not.toContain('/governance');
    expect(links).not.toContain('/ops');
  });

  it('ra tier shows RA items when show* props are true (non-regression)', () => {
    const { container } = render(
      <Sidebar tier="ra" userRole="ra-member" showInbox showExpertReview />,
    );
    const links = hrefsOf(container);
    expect(links).toContain('/inbox');
    expect(links).toContain('/expert-review');
  });

  it('admin tier shows scoped items + 운영 콘솔; ra tier does not see 운영 콘솔', () => {
    const admin = render(<Sidebar tier="admin" userRole="admin" showInbox />);
    expect(hrefsOf(admin.container)).toContain('/inbox');
    expect(hrefsOf(admin.container)).toContain('/ops');
    const ra = render(<Sidebar tier="ra" userRole="ra-member" showInbox />);
    expect(hrefsOf(ra.container)).not.toContain('/ops');
  });

  it('tier undefined preserves existing show*-only behavior (non-regression, H4)', () => {
    const { container } = render(<Sidebar userRole="ra-member" showInbox showExpertReview />);
    const links = hrefsOf(container);
    expect(links).toContain('/inbox');
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
