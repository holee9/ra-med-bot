/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth/rbac', () => ({ hasRole: vi.fn(() => true) }));

// Next.js redirect throws in server components; mimic that semantics.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));

// Mock the client component to isolate page RBAC from data fetching.
vi.mock('@/components/inbox/InboxDetailClient', () => ({
  InboxDetailClient: ({ ticketId }: { ticketId: string }) => (
    <div data-testid="inbox-detail-client">{ticketId}</div>
  ),
}));

describe('Inbox Detail Page (T-020/T-021)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /chat for viewer role (REQ-V3-UI-030)', async () => {
    const { auth } = await import('@/lib/auth');
    const { redirect: mockRedirect } = await import('next/navigation');
    const { hasRole } = await import('@/lib/auth/rbac');

    vi.mocked(auth).mockResolvedValue({ user: { role: 'viewer' } } as unknown as never);
    vi.mocked(hasRole).mockReturnValue(false);

    const Page = (await import('../page')).default;
    // page.tsx wraps redirect in try/catch (test/build env fallback), so the
    // Page promise resolves; the redirect spy call is the assertion that matters.
    await Page({ params: Promise.resolve({ id: 't-1' }) });
    expect(mockRedirect).toHaveBeenCalledWith('/chat');
  });

  it('renders InboxDetailClient for ra-member role', async () => {
    const { auth } = await import('@/lib/auth');
    const { hasRole } = await import('@/lib/auth/rbac');

    vi.mocked(auth).mockResolvedValue({ user: { role: 'ra-member' } } as unknown as never);
    vi.mocked(hasRole).mockReturnValue(true);

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ id: 't-1' }) });
    const { container } = render(ui as React.ReactElement);

    expect(container.querySelector('[data-testid="inbox-detail-client"]')).toBeInTheDocument();
    expect(container.textContent).toContain('t-1');
  });
});
