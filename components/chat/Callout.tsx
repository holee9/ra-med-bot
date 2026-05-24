'use client';

// @MX:NOTE Callout component — 3 variants: info / warn / expert.
// Used in AnswerBlock Step 2 (expert-review callout) and structured blocks.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-025)

import type { ReactNode } from 'react';

interface CalloutProps {
  variant: 'info' | 'warn' | 'expert';
  title: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<CalloutProps['variant'], string> = {
  info: 'bg-brand-50 border-brand-200',
  warn: 'bg-accent-50 border-accent-400',
  expert: 'bg-accent-100 border-accent-600',
};

const VARIANT_TITLE_CLASSES: Record<CalloutProps['variant'], string> = {
  info: 'text-brand-700',
  warn: 'text-accent-700',
  expert: 'text-accent-800',
};

export function Callout({ variant, title, children }: CalloutProps) {
  // expert variant uses role="alert" for accessibility (high-priority callout).
  const role = variant === 'expert' ? 'alert' : 'note';
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}
      role={role}
      data-testid={variant === 'expert' ? 'expert-review-callout' : undefined}
    >
      <p className={`mb-1 font-semibold ${VARIANT_TITLE_CLASSES[variant]}`}>{title}</p>
      <div className="text-ink-700">{children}</div>
    </div>
  );
}
