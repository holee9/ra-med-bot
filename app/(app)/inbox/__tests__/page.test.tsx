/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock auth lib
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock rbac
vi.mock('@/lib/auth/rbac', () => ({
  hasRole: vi.fn(() => true),
}));

// Mock redirect — throws to mimic Next.js server redirect semantics.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));

// Mock InboxKanban to isolate page RBAC logic from Kanban rendering
vi.mock('@/components/inbox/InboxKanban', () => ({
  InboxKanban: () => <div data-testid="inbox-kanban">Inbox Kanban</div>,
}));

describe('Inbox Page (T-014)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /chat for viewer role (non-ra-member, REQ-V3-UI-030)', async () => {
    const { auth } = await import('@/lib/auth');
    const { redirect: mockRedirect } = await import('next/navigation');
    const { hasRole } = await import('@/lib/auth/rbac');

    vi.mocked(auth).mockResolvedValue({ user: { role: 'viewer' } } as unknown as never);
    vi.mocked(hasRole).mockReturnValue(false);

    const InboxPage = (await import('../page')).default;

    // InboxPage() is async; redirect() throws inside it → Promise rejects.
    await expect(InboxPage()).rejects.toThrow('REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/chat');
  });

  it('renders InboxKanban for ra-member role (AC-UI-002)', async () => {
    const { auth } = await import('@/lib/auth');
    const { hasRole } = await import('@/lib/auth/rbac');

    vi.mocked(auth).mockResolvedValue({ user: { role: 'ra-member' } } as unknown as never);
    vi.mocked(hasRole).mockReturnValue(true);

    const InboxPage = (await import('../page')).default;
    const { container } = render(await InboxPage());

    expect(container.querySelector('[data-testid="inbox-kanban"]')).toBeInTheDocument();
  });
});
