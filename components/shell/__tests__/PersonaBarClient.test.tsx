/** @vitest-environment jsdom */
// @MX:NOTE [SPEC-V3-PERSONA-001 M4/M5] PersonaBarClient integration + security.
// Verifies: cookie write + router.refresh on valid switch; escalation guard
// (defense-in-depth on top of PersonaBar's isValidTierForRole gating);
// hydration safety (server-injected initialTier on first render).
import '@testing-library/jest-dom';
import { PERSONA_COOKIE } from '@/lib/auth/persona';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PersonaBarClient from '../PersonaBarClient';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('PersonaBarClient (SPEC-V3-PERSONA-001 M4/M5)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.cookie = `${PERSONA_COOKIE}=; path=/; max-age=0`;
  });

  it('writes cookie + calls router.refresh on a valid tier switch (REQ-V3-PER-005/NFR-001)', () => {
    render(<PersonaBarClient initialTier="employee" userRole="admin" />);
    fireEvent.click(screen.getByTestId('persona-tab-ra'));
    expect(document.cookie).toContain(`${PERSONA_COOKIE}=ra`);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT switch when the role cannot access the tier (escalation guard, REQ-V3-PER-004)', () => {
    // viewer role: the admin tab is disabled by PersonaBar (isValidTierForRole),
    // and PersonaBarClient.handleTierChange re-checks as defense in depth.
    render(<PersonaBarClient initialTier="employee" userRole="viewer" />);
    fireEvent.click(screen.getByTestId('persona-tab-admin'));
    expect(refreshMock).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain(`${PERSONA_COOKIE}=admin`);
  });

  it('reflects the server-injected initialTier on first render (hydration safety)', () => {
    render(<PersonaBarClient initialTier="ra" userRole="ra-lead" />);
    expect(screen.getByTestId('persona-tab-ra')).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking the already-selected tier is a no-op (no refresh storm)', () => {
    render(<PersonaBarClient initialTier="employee" userRole="admin" />);
    fireEvent.click(screen.getByTestId('persona-tab-employee'));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
