/** @vitest-environment jsdom */
// @MX:NOTE [SPEC-V3-PERSONA-001 M2] PersonaBar unit tests (ApproveDialog pattern).
import '@testing-library/jest-dom';
import type { Role } from '@/lib/kernel/auth/rbac';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonaBar } from '../PersonaBar';

// next-intl mock: return the key verbatim so assertions are key-based.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const ALL_ROLES: Role[] = ['viewer', 'auditor', 'ra-member', 'qa-lead', 'ra-lead', 'admin'];

function toggleFor(role: Role): { employee: boolean; ra: boolean; admin: boolean } {
  // Mirrors isValidTierForRole expectations (single source of truth = persona.ts).
  const rank = (t: string) =>
    (({ employee: 0, ra: 1, admin: 2 }) as Record<string, number>)[t] ?? -1;
  const natural = { viewer: 0, auditor: 0, 'ra-member': 1, 'qa-lead': 1, 'ra-lead': 1, admin: 2 }[
    role
  ];
  return {
    employee: rank('employee') <= natural,
    ra: rank('ra') <= natural,
    admin: rank('admin') <= natural,
  };
}

describe('PersonaBar (SPEC-V3-PERSONA-001 M2)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('REQ-V3-PER-001 — role-based button enablement', () => {
    it.each(ALL_ROLES)('renders all three tier buttons for role %s', (role) => {
      render(<PersonaBar currentTier="employee" userRole={role} onTierChange={vi.fn()} />);
      expect(screen.getByTestId('persona-tab-employee')).toBeInTheDocument();
      expect(screen.getByTestId('persona-tab-ra')).toBeInTheDocument();
      expect(screen.getByTestId('persona-tab-admin')).toBeInTheDocument();
    });

    it.each(ALL_ROLES)('enables exactly the valid tiers for role %s', (role) => {
      render(<PersonaBar currentTier="employee" userRole={role} onTierChange={vi.fn()} />);
      const expected = toggleFor(role);
      const emp = screen.getByTestId('persona-tab-employee') as HTMLButtonElement;
      const ra = screen.getByTestId('persona-tab-ra') as HTMLButtonElement;
      const adm = screen.getByTestId('persona-tab-admin') as HTMLButtonElement;
      expect(emp.disabled).toBe(!expected.employee);
      expect(ra.disabled).toBe(!expected.ra);
      expect(adm.disabled).toBe(!expected.admin);
    });

    it('viewer can only use employee (RA/Admin disabled)', () => {
      render(<PersonaBar currentTier="employee" userRole="viewer" onTierChange={vi.fn()} />);
      expect(screen.getByTestId('persona-tab-employee')).not.toBeDisabled();
      expect(screen.getByTestId('persona-tab-ra')).toBeDisabled();
      expect(screen.getByTestId('persona-tab-admin')).toBeDisabled();
    });

    it('admin can use all three tiers', () => {
      render(<PersonaBar currentTier="admin" userRole="admin" onTierChange={vi.fn()} />);
      expect(screen.getByTestId('persona-tab-employee')).not.toBeDisabled();
      expect(screen.getByTestId('persona-tab-ra')).not.toBeDisabled();
      expect(screen.getByTestId('persona-tab-admin')).not.toBeDisabled();
    });
  });

  describe('REQ-V3-PER-001 — tier switch behavior', () => {
    it('calls onTierChange with the selected tier when an enabled button is clicked', () => {
      const onTierChange = vi.fn();
      render(<PersonaBar currentTier="employee" userRole="admin" onTierChange={onTierChange} />);
      fireEvent.click(screen.getByTestId('persona-tab-ra'));
      expect(onTierChange).toHaveBeenCalledWith('ra');
      expect(onTierChange).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onTierChange when the already-selected tier is clicked', () => {
      const onTierChange = vi.fn();
      render(<PersonaBar currentTier="employee" userRole="admin" onTierChange={onTierChange} />);
      fireEvent.click(screen.getByTestId('persona-tab-employee'));
      expect(onTierChange).not.toHaveBeenCalled();
    });

    it('does NOT call onTierChange when a disabled button is clicked', () => {
      const onTierChange = vi.fn();
      render(<PersonaBar currentTier="employee" userRole="viewer" onTierChange={onTierChange} />);
      fireEvent.click(screen.getByTestId('persona-tab-admin'));
      expect(onTierChange).not.toHaveBeenCalled();
    });
  });

  describe('REQ-V3-PER-006 — accessibility (ARIA tablist)', () => {
    it('renders a tablist with an accessible label', () => {
      render(<PersonaBar currentTier="employee" userRole="admin" onTierChange={vi.fn()} />);
      const bar = screen.getByTestId('persona-bar');
      expect(bar).toHaveAttribute('role', 'tablist');
      expect(bar).toHaveAttribute('aria-label', 'label');
    });

    it('marks each button as role=tab with aria-selected on the active tier', () => {
      render(<PersonaBar currentTier="ra" userRole="admin" onTierChange={vi.fn()} />);
      const ra = screen.getByTestId('persona-tab-ra');
      expect(ra).toHaveAttribute('role', 'tab');
      expect(ra).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('persona-tab-employee')).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('persona-tab-admin')).toHaveAttribute('aria-selected', 'false');
    });

    it('sets aria-disabled=true on disabled tier buttons and shows tierLocked tooltip', () => {
      render(<PersonaBar currentTier="employee" userRole="viewer" onTierChange={vi.fn()} />);
      const adm = screen.getByTestId('persona-tab-admin');
      expect(adm).toHaveAttribute('aria-disabled', 'true');
      expect(adm).toHaveAttribute('title', 'tierLocked');
    });

    it('enables Tab focus movement across enabled buttons (keyboard reachable)', () => {
      render(<PersonaBar currentTier="employee" userRole="admin" onTierChange={vi.fn()} />);
      const emp = screen.getByTestId('persona-tab-employee');
      emp.focus();
      expect(document.activeElement).toBe(emp);
      // Tab to next enabled button (default button behaviour).
      fireEvent.keyDown(emp, { key: 'Tab' });
      // Focus moves are handled by the browser; here we only assert the button
      // is focusable (tabIndex not -1).
      expect(emp).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
