'use client';

// @MX:NOTE [SPEC-V3-PERSONA-001 M2] PersonaBar — 3-tier view-only switcher.
// Presentation-only (REQ-V3-PER-NFR-003): the parent (layout) owns tier state.
// Tier switching changes ONLY the visible IA, never actual permissions —
// server-side `withPermission` / `hasRole` always read `session.user.role`
// (REQ-V3-PER-004 RBAC immutability invariant).
//
// Accessibility (REQ-V3-PER-006): role="tablist" / role="tab" with
// aria-selected / aria-disabled. Buttons give Tab focus + Enter/Space
// activation for free. Colors use semantic tokens (ink-*/brand-*) which
// remap under [data-theme="dark"] so ci:contrast holds in both themes.

import { type Tier, isValidTierForRole } from '@/lib/auth/persona';
import type { Role } from '@/lib/auth/rbac';
import { useTranslations } from 'next-intl';

const TIERS: readonly Tier[] = ['employee', 'ra', 'admin'] as const;

interface PersonaBarProps {
  /** Currently active tier (owned by parent). */
  currentTier: Tier;
  /** Server-authoritative role — drives which tiers are selectable. */
  userRole: Role;
  /** Invoked when the user clicks an enabled, non-selected tier button. */
  onTierChange: (tier: Tier) => void;
  className?: string;
}

const BASE_BUTTON_CLS =
  'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1';

function stateClasses(selected: boolean, enabled: boolean): string {
  if (selected) {
    return 'border-brand-800 bg-brand-800 text-white';
  }
  if (enabled) {
    return 'border-ink-200 bg-surface text-ink-600 hover:bg-ink-50 hover:text-ink-900';
  }
  return 'border-ink-150 bg-surface text-ink-300 cursor-not-allowed';
}

export function PersonaBar({ currentTier, userRole, onTierChange, className }: PersonaBarProps) {
  const t = useTranslations('persona');

  return (
    <div
      role="tablist"
      aria-label={t('label')}
      data-testid="persona-bar"
      className={`inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-surface p-1 ${className ?? ''}`}
    >
      {TIERS.map((tier) => {
        const enabled = isValidTierForRole(userRole, tier);
        const selected = currentTier === tier;
        return (
          <button
            key={tier}
            type="button"
            role="tab"
            id={`persona-tab-${tier}`}
            data-testid={`persona-tab-${tier}`}
            aria-selected={selected}
            aria-disabled={!enabled}
            disabled={!enabled}
            title={!enabled ? t('tierLocked') : undefined}
            onClick={() => {
              if (enabled && !selected) {
                onTierChange(tier);
              }
            }}
            className={`${BASE_BUTTON_CLS} ${stateClasses(selected, enabled)}`}
          >
            {t(`tier.${tier}`)}
          </button>
        );
      })}
    </div>
  );
}

export default PersonaBar;
