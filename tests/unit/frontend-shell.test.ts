// @MX:NOTE Frontend shell tests — verifies REQ-FND-011..020, 056..058.
// Validates root layout, app shell, pages, and shared shell components.

/** @vitest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  // Issue #158 Group C: LocaleToggle uses useSearchParams to preserve return path.
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

// Issue #158 Group C: Home + Topbar are server components that call auth() and
// gate the expert-review link by ra-lead role. Provide an ra-lead session so
// the shell renders role-aware content (REQ-FND-016, REQ-FND-020).
vi.mock('@/lib/kernel/auth', () => ({
  auth: async () => ({ user: { role: 'ra-lead' } }),
}));
vi.mock('@/lib/kernel/auth/rbac', () => ({
  // 2026-06-29: 실제 ROLE_HIERARCHY 반영 (ra-lead >= ra-member 등).
  // 단순 === 비교 시 ra-lead가 ra-member 항목을 통과 못 함 (사이드바 필터 테스트 실패).
  hasRole: (role: string, required: string) => {
    const H: Record<string, number> = {
      admin: 4,
      'ra-lead': 3,
      'qa-lead': 2.5,
      'ra-member': 2,
      viewer: 1,
      auditor: 0.5,
    };
    return (H[role] ?? 0) >= (H[required] ?? 0);
  },
}));

// next/font/google is a build-time module; mock it to plain objects.
vi.mock('next/font/google', () => {
  const mk = () => ({
    variable: '--mock-font',
    className: 'mock-font',
    style: { fontFamily: 'mock' },
  });
  return {
    IBM_Plex_Sans: mk,
    IBM_Plex_Mono: mk,
    Source_Serif_4: mk,
    Noto_Serif_KR: mk,
  };
});

vi.mock('@fontsource/pretendard', () => ({}));

// next-intl server APIs are not available in Vitest (Node environment).
// Mock them so layout.tsx can be imported without errors.
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'ko',
  getMessages: async () => ({}),
}));

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// SPEC-V3-PERSONA-001 M4: page.tsx reads cookies() to derive the persona tier.
// next/headers cookies requires a request scope; stub it for unit tests
// (returns no persona cookie → resolveTier falls back to the role's natural tier).
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

// Chat page uses useStreamingAnswer and @tanstack/react-query.
vi.mock('../../hooks/useStreamingAnswer', () => ({
  useStreamingAnswer: () => ({
    status: 'idle',
    traceSteps: [],
    prose: '',
    structured: {},
    meta: undefined,
    error: null,
    duration_ms: null,
    start: vi.fn(),
    abort: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Stub Composer and AnswerBlock to avoid deep dependency chains in shell tests.
vi.mock('../../components/chat/Composer', () => ({
  Composer: () => null,
}));

vi.mock('../../components/chat/AnswerBlock', () => ({
  AnswerBlock: () => null,
}));

vi.mock('../../components/chat/Thinking', () => ({
  Thinking: () => null,
}));

vi.mock('../../components/chat/ChatShell', () => ({
  ChatShell: () => null,
}));

// Sidebar now uses useUIStore and useProjects — mock both.
vi.mock('@/stores/ui', () => ({
  useUIStore: Object.assign(
    vi.fn((selector?: (s: unknown) => unknown) => {
      const state = {
        currentProjectId: null,
        recentProjects: [],
        setCurrentProjectId: vi.fn(),
      };
      if (typeof selector === 'function') return selector(state);
      return state;
    }),
    { getState: vi.fn(() => ({ currentProjectId: null, recentProjects: [] })) },
  ),
}));

vi.mock('@/lib/queries/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
}));

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

describe('public/robots.txt — REQ-FND-057', () => {
  it('disallows all user agents', () => {
    const content = readText('public/robots.txt');
    expect(content).toContain('User-agent: *');
    expect(content).toContain('Disallow: /');
  });
});

describe('app/layout.tsx — REQ-FND-011, 012, 015, 056', () => {
  it('REQ-FND-011: layout.tsx sets html lang dynamically (ko default)', async () => {
    // layout.tsx is now async (uses next-intl getLocale).
    // Verify the source sets lang={locale} — runtime value is 'ko' from mocked getLocale.
    const source = readText('app/layout.tsx');
    expect(source).toMatch(/lang=\{locale\}/);
  });

  it('REQ-FND-012, 056: root metadata sets robots index/follow false', () => {
    // metadata is a STATIC literal (app/layout.tsx: robots: { index: false, follow: false }).
    // Source-matched instead of `await import(layout)` because importing the root
    // layout pulls the heavy app-shell module graph (fonts/providers/observability),
    // which intermittently exceeded the test timeout under full-suite collect load.
    // Eliminating the import removes the timeout failure mode entirely (Issue #384).
    const source = readText('app/layout.tsx');
    expect(source).toMatch(/robots:\s*\{[^}]*index:\s*false/);
    expect(source).toMatch(/robots:\s*\{[^}]*follow:\s*false/);
  });

  it('REQ-FND-015: imports next/font/google fonts', async () => {
    const source = readText('app/layout.tsx');
    expect(source).toMatch(/from\s+['"]next\/font\/google['"]/);
    expect(source).toContain('IBM_Plex_Sans');
    expect(source).toContain('Source_Serif_4');
    expect(source).toMatch(/@fontsource\/pretendard/);
  });
});

describe('app/(app)/layout.tsx — REQ-FND-013, 014', () => {
  it('REQ-FND-013: source references Sidebar and Topbar', () => {
    const source = readText('app/(app)/layout.tsx');
    expect(source).toContain('Sidebar');
    expect(source).toContain('Topbar');
  });

  it('REQ-FND-014: app group metadata sets robots.index false', async () => {
    const mod = await import('../../app/(app)/layout');
    const meta = mod.metadata as { robots?: { index?: boolean } };
    expect(meta.robots?.index).toBe(false);
  });
});

describe('app/(app)/page.tsx — REQ-FND-016', () => {
  it('renders without error', async () => {
    const mod = await import('../../app/(app)/page');
    // Home is an async server component (awaits auth() for role-aware entries).
    const tree = await mod.default();
    render(tree);
    // No assertion on text — just that render does not throw.
    expect(tree).toBeTruthy();
  });
});

describe('app/(app) route coverage — Phase 4 navigation contract', () => {
  it('has a page file for every Sidebar navigation route', () => {
    const requiredPages = [
      'app/(app)/page.tsx',
      'app/(app)/chat/page.tsx',
      'app/(app)/history/page.tsx',
      'app/(app)/calendar/page.tsx',
      'app/(app)/templates/page.tsx',
      'app/(app)/knowledge/page.tsx',
      'app/(app)/updates/page.tsx',
      'app/(app)/dashboard/page.tsx',
      'app/(app)/settings/page.tsx',
      // SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35): conditional nav, but the page
      // file must still exist for users with knowledgegap.view.
      'app/(app)/knowledge-gap/page.tsx',
    ];

    for (const page of requiredPages) {
      expect(fs.existsSync(path.join(root, page)), `${page} is missing`).toBe(true);
    }
  });
});

describe('app/(app)/chat/page.tsx — REQ-FND-017', () => {
  it('renders Korean empty state text', async () => {
    const mod = await import('../../app/(app)/chat/page');
    render(React.createElement(mod.default));
    expect(screen.getByText('새로운 상담을 시작하세요')).toBeTruthy();
  });
});

describe('app/(auth)/login/page.tsx — REQ-FND-018, 058', () => {
  it('REQ-FND-018: renders email/password login form', async () => {
    const mod = await import('../../app/(auth)/login/page');
    render(mod.default());
    // Credentials-based login form (email + password inputs).
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/로그인/);
  });

  it('REQ-FND-058: login metadata sets robots.index true', async () => {
    const mod = await import('../../app/(auth)/login/page');
    const meta = mod.metadata as { robots?: { index?: boolean } };
    expect(meta.robots?.index).toBe(true);
  });
});

describe('components/shell/Sidebar.tsx — REQ-FND-019', () => {
  it('renders 4 navigation links in correct order', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const Sidebar = mod.default as React.ComponentType<{ userRole?: string }>;
    // Scope rationalization (2026-06-29 Issue #306): NAV 4개 핵심 (홈·채팅·히스토리·설정)
    const { container } = render(React.createElement(Sidebar, { userRole: 'ra-lead' }));
    // Scope to the <nav> region so the primary "새 상담" action button
    // (rendered outside <nav>) is excluded from the ordering assertion.
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    if (!nav) {
      return;
    }
    const navLinks = Array.from(nav.querySelectorAll('a'));
    const expected: Array<[string, string]> = [
      ['홈', '/'],
      ['채팅', '/chat'], // ko locale label (CHAT_LABELS.ko = '채팅')
      ['히스토리', '/history'],
      ['설정', '/settings'],
    ];
    expect(navLinks.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const item = expected[i];
      const link = navLinks[i];
      if (!item || !link) {
        continue;
      }
      const [label, href] = item;
      expect(link.getAttribute('href')).toBe(href);
      expect(link.textContent).toContain(label);
    }
  });

  // Scope rationalization (2026-06-29 Issue #306): viewer(전사 직원)는 4개 NAV만 (홈·채팅·히스토리·설정).
  it('renders 4 navigation links for viewer (전사 직원)', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const Sidebar = mod.default as React.ComponentType<{ userRole?: string }>;
    const { container } = render(React.createElement(Sidebar, { userRole: 'viewer' }));
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    if (!nav) return;
    const navLinks = Array.from(nav.querySelectorAll('a'));
    expect(navLinks.length).toBe(4);
    const hrefs = navLinks.map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/chat', '/history', '/settings']);
  });

  // Scope rationalization (2026-06-29 Issue #306): ra-member+에 Authoring/Evidence 조건부 노출
  it('renders Authoring/Evidence links for ra-member', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const Sidebar = mod.default as React.ComponentType<{
      showAuthoring?: boolean;
      showEvidence?: boolean;
    }>;
    const { container } = render(
      React.createElement(Sidebar, { showAuthoring: true, showEvidence: true }),
    );
    expect(container.querySelector('[data-testid="sidebar-authoring-link"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sidebar-evidence-link"]')).not.toBeNull();
  });
});

describe('components/shell/Topbar.tsx — REQ-FND-020', () => {
  it('renders 전문가 검토 button', async () => {
    const mod = await import('../../components/shell/Topbar');
    render(await mod.default());
    expect(screen.getByText('전문가 검토')).toBeTruthy();
  });
});

// SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35): conditional Knowledge Gap nav link.
// The main <nav> still has 10 links (asserted above); the Knowledge Gap entry is
// rendered in a separate conditional <nav> block, gated by showKnowledgeGap.
describe('components/shell/Sidebar.tsx — Knowledge Gap conditional nav (Issue #35)', () => {
  it('renders 미답변 큐 link when showKnowledgeGap=true', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const Sidebar = mod.default as React.ComponentType<{ showKnowledgeGap?: boolean }>;
    const { container } = render(React.createElement(Sidebar, { showKnowledgeGap: true }));
    const link = container.querySelector('[data-testid="sidebar-knowledge-gap-link"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/knowledge-gap');
    expect(link?.textContent).toContain('미답변 큐');
  });

  it('hides 미답변 큐 link when showKnowledgeGap is false/omitted', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const { container } = render(React.createElement(mod.default));
    expect(container.querySelector('[data-testid="sidebar-knowledge-gap-link"]')).toBeNull();
  });
});

// SPEC-REGULA-CLASSIFY-001 (Issue #59): conditional Classify nav link.
// The main <nav> still has 10 links (asserted above); the Classify entry is
// rendered in a separate conditional <nav> block, gated by showClassify.
describe('components/shell/Sidebar.tsx — Classify conditional nav (Issue #59)', () => {
  it('renders 기기 분류 link when showClassify=true', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const Sidebar = mod.default as React.ComponentType<{ showClassify?: boolean }>;
    const { container } = render(React.createElement(Sidebar, { showClassify: true }));
    const link = container.querySelector('[data-testid="sidebar-classify-link"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/workflows/classification');
    expect(link?.textContent).toContain('기기 분류');
  });

  it('hides 기기 분류 link when showClassify is false/omitted', async () => {
    const mod = await import('../../components/shell/Sidebar');
    const { container } = render(React.createElement(mod.default));
    expect(container.querySelector('[data-testid="sidebar-classify-link"]')).toBeNull();
  });
});

// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): PMS/PMCF conditional nav tests
// removed along with the Sidebar /pms link, showPms prop, and PMS_WORKBENCH
// feature flag. Regula no longer surfaces the PMS workbench (patient data).
