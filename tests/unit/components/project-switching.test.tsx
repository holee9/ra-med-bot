// @MX:NOTE T-030 project switching wiring tests — REQ-BREADTH-044~048.
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Zustand store mock ────────────────────────────────────────────────────
// We need a controllable store state across tests.

let mockCurrentProjectId: string | null = null;
let mockRecentProjects: string[] = [];
let mockPendingQuestion: string | null = null;
const mockSetCurrentProjectId = vi.fn((id: string | null) => {
  mockCurrentProjectId = id;
});
const mockSetPendingQuestion = vi.fn((q: string | null) => {
  mockPendingQuestion = q;
});

const makeState = () => ({
  currentProjectId: mockCurrentProjectId,
  recentProjects: mockRecentProjects,
  pendingQuestion: mockPendingQuestion,
  setCurrentProjectId: mockSetCurrentProjectId,
  setPendingQuestion: mockSetPendingQuestion,
});

const mockGetState = vi.fn(() => makeState());

vi.mock('@/stores/ui', () => ({
  useUIStore: Object.assign(
    vi.fn((selector?: (s: unknown) => unknown) => {
      const state = makeState();
      if (typeof selector === 'function') return selector(state);
      return state;
    }),
    { getState: mockGetState },
  ),
}));

// ─── TanStack Query mock ────────────────────────────────────────────────────
let mockProjects = [
  { id: 'proj-1', name: '프로젝트 A', organizationId: 'org-1' },
  { id: 'proj-2', name: '프로젝트 B', organizationId: 'org-1' },
];
const mockInvalidateQueries = vi.fn();

vi.mock('@/lib/queries/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: mockProjects, isLoading: false })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryFn }: { queryFn: () => unknown }) => {
    try {
      const result = queryFn();
      return { data: result, isLoading: false };
    } catch {
      return { data: undefined, isLoading: false };
    }
  }),
  useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

// ─── Test helpers ────────────────────────────────────────────────────────────

function resetMockState() {
  mockCurrentProjectId = null;
  mockRecentProjects = [];
  mockPendingQuestion = null;
  mockSetCurrentProjectId.mockClear();
  mockSetPendingQuestion.mockClear();
  mockInvalidateQueries.mockClear();
  mockProjects = [
    { id: 'proj-1', name: '프로젝트 A', organizationId: 'org-1' },
    { id: 'proj-2', name: '프로젝트 B', organizationId: 'org-1' },
  ];
  // Keep getState in sync with current mock state
  mockGetState.mockImplementation(() => makeState());
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetMockState();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. ProjectChip — renders current project name (REQ-BREADTH-045)
// ────────────────────────────────────────────────────────────────────────────
describe('ProjectChip (REQ-BREADTH-045)', () => {
  beforeEach(() => {
    resetMockState();
    mockCurrentProjectId = 'proj-1';
    mockRecentProjects = ['proj-1', 'proj-2'];
  });

  it('renders current project name when currentProjectId is set', async () => {
    const { ProjectChip } = await import('@/components/chat/ProjectChip');
    render(<ProjectChip />);
    expect(screen.getByText('프로젝트 A')).toBeDefined();
  });

  it('renders placeholder text when no project is selected', async () => {
    mockCurrentProjectId = null;
    const { ProjectChip } = await import('@/components/chat/ProjectChip');
    render(<ProjectChip />);
    expect(screen.getByText(/프로젝트 선택/i)).toBeDefined();
  });

  it('clicking chip opens dropdown with recent projects (REQ-BREADTH-045)', async () => {
    mockRecentProjects = ['proj-1', 'proj-2'];
    const { ProjectChip } = await import('@/components/chat/ProjectChip');
    render(<ProjectChip />);

    // The chip button itself
    const chip = screen.getByRole('button');
    fireEvent.click(chip);

    // After opening, the dropdown listbox should appear
    expect(screen.getByRole('listbox')).toBeDefined();
    // Both projects appear as options
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);
    const optionTexts = options.map((o) => o.textContent ?? '');
    expect(optionTexts.some((t) => t.includes('프로젝트 A'))).toBe(true);
    expect(optionTexts.some((t) => t.includes('프로젝트 B'))).toBe(true);
  });

  it('selecting project from dropdown calls setCurrentProjectId without page reload (REQ-BREADTH-047)', async () => {
    const navigateSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/', assign: navigateSpy, reload: navigateSpy },
      configurable: true,
    });

    mockRecentProjects = ['proj-1', 'proj-2'];
    const { ProjectChip } = await import('@/components/chat/ProjectChip');
    render(<ProjectChip />);

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Select proj-2 from dropdown
    const dropdownItems = screen.getAllByRole('option');
    const proj2Item = dropdownItems.find((el) => el.textContent?.includes('프로젝트 B'));
    expect(proj2Item).toBeDefined();
    if (proj2Item) fireEvent.click(proj2Item);

    expect(mockSetCurrentProjectId).toHaveBeenCalledWith('proj-2');
    // No page reload
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Sidebar — project click updates currentProjectId (REQ-BREADTH-044)
// ────────────────────────────────────────────────────────────────────────────
describe('Sidebar project switching (REQ-BREADTH-044)', () => {
  it('renders real project names from useProjects', async () => {
    const Sidebar = (await import('@/components/shell/Sidebar')).default;
    render(<Sidebar userRole="ra-lead" />);
    expect(screen.getByText('프로젝트 A')).toBeDefined();
    expect(screen.getByText('프로젝트 B')).toBeDefined();
  });

  it('clicking a project sets currentProjectId', async () => {
    const Sidebar = (await import('@/components/shell/Sidebar')).default;
    render(<Sidebar userRole="ra-lead" />);

    const projAButton =
      screen.getByText('프로젝트 A').closest('button') ?? screen.getByText('프로젝트 A');
    fireEvent.click(projAButton);

    expect(mockSetCurrentProjectId).toHaveBeenCalledWith('proj-1');
  });

  it('active project is visually highlighted', async () => {
    mockCurrentProjectId = 'proj-1';
    const Sidebar = (await import('@/components/shell/Sidebar')).default;
    const { container } = render(<Sidebar userRole="ra-lead" />);

    // Active project should have aria-current="true" or data-active attribute
    const activeEl = container.querySelector('[data-active="true"], [aria-current="true"]');
    expect(activeEl).toBeDefined();
    expect(activeEl?.textContent).toContain('프로젝트 A');
  });

  it('offers an inline default project CTA when the org has no projects', async () => {
    mockProjects = [];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ project: { id: 'proj-default', name: '기본 검증 프로젝트' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const Sidebar = (await import('@/components/shell/Sidebar')).default;
    render(<Sidebar userRole="ra-lead" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('project-empty-create'));
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/ra/projects', expect.any(Object));
      expect(mockSetCurrentProjectId).toHaveBeenCalledWith('proj-default');
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. RightContextPanel — shows project name from real data (REQ-BREADTH-046)
// ────────────────────────────────────────────────────────────────────────────
describe('RightContextPanel real data wiring (REQ-BREADTH-046)', () => {
  it('shows project name when currentProjectId is set', async () => {
    const { RightContextPanel } = await import('@/components/chat/RightContextPanel');

    // Render with a non-null project ID
    render(<RightContextPanel currentProjectId="proj-1" latestMessageId={null} />);

    // After wiring, should show project name instead of "Phase 4" placeholder
    expect(screen.queryByText(/Phase 4/i)).toBeNull();
    // Should show project name
    expect(screen.getByText(/프로젝트 A/i)).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Composer — pendingQuestion prefill on mount (REQ-BREADTH-003 completion)
// ────────────────────────────────────────────────────────────────────────────
describe('Composer pendingQuestion prefill (REQ-BREADTH-003)', () => {
  it('prefills textarea with pendingQuestion on mount', async () => {
    mockPendingQuestion = '510(k) 면제 조건은?';
    // Ensure getState returns the updated state
    mockGetState.mockReturnValue(makeState());

    const { Composer } = await import('@/components/chat/Composer');
    const onChangeMock = vi.fn();

    render(
      <Composer
        value=""
        onChange={onChangeMock}
        sourceFilter="all"
        onSourceFilterChange={vi.fn()}
        onSubmit={vi.fn()}
        isStreaming={false}
      />,
    );

    // onChange should have been called with the pending question
    expect(onChangeMock).toHaveBeenCalledWith('510(k) 면제 조건은?');
    // Store should be cleared
    expect(mockSetPendingQuestion).toHaveBeenCalledWith(null);
  });

  it('does NOT re-prefill on re-render (dependency: [])', async () => {
    mockPendingQuestion = '첫 번째 질문';

    const { Composer } = await import('@/components/chat/Composer');
    const onChangeMock = vi.fn();

    const { rerender } = render(
      <Composer
        value="첫 번째 질문"
        onChange={onChangeMock}
        sourceFilter="all"
        onSourceFilterChange={vi.fn()}
        onSubmit={vi.fn()}
        isStreaming={false}
      />,
    );

    // Clear call count after mount
    onChangeMock.mockClear();
    mockPendingQuestion = null; // store was cleared

    // Re-render with different props
    rerender(
      <Composer
        value="사용자가 타이핑"
        onChange={onChangeMock}
        sourceFilter="all"
        onSourceFilterChange={vi.fn()}
        onSubmit={vi.fn()}
        isStreaming={false}
      />,
    );

    // Should NOT be called again from the prefill effect
    expect(onChangeMock).not.toHaveBeenCalled();
  });
});
