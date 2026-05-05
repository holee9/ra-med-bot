// @MX:NOTE [AUTO] BetaBadge — small "Beta" pill used to mark features that
// are not yet GA. Visual convention: amber accent on light surface to signal
// "in progress / use with caution" without alarming like the danger palette.
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-003)

import type { ReactNode } from 'react';

type BetaBadgeSize = 'sm' | 'md';

const SIZE_CLASSES: Record<BetaBadgeSize, string> = {
  sm: 'px-1.5 py-0 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

interface BetaBadgeProps {
  size?: BetaBadgeSize;
  className?: string;
  children?: ReactNode;
}

export function BetaBadge({ size = 'md', className = '', children }: BetaBadgeProps) {
  return (
    <span
      data-testid="beta-badge"
      className={`inline-flex items-center rounded border border-accent-400 bg-accent-50 font-medium uppercase tracking-wide text-accent-700 ${SIZE_CLASSES[size]} ${className}`}
    >
      {children ?? 'Beta'}
    </span>
  );
}
