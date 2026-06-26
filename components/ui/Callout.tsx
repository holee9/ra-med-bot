'use client';

// @MX:NOTE Callout component — 3 variants: info / warn / danger.
// Extracted from chat/Callout.tsx for app-wide reuse.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-025)

import type { ReactNode } from 'react';

interface CalloutProps {
  variant: 'info' | 'warn' | 'danger';
  title: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<CalloutProps['variant'], string> = {
  info: 'bg-brand-50 border-brand-200',
  warn: 'bg-amber-50 border-amber-400',
  danger: 'bg-danger-50 border-danger-200',
};

const VARIANT_TITLE_CLASSES: Record<CalloutProps['variant'], string> = {
  info: 'text-brand-700',
  warn: 'text-amber-700',
  danger: 'text-danger-700',
};

export function Callout({ variant, title, children }: CalloutProps) {
  // danger variant uses role="alert" for accessibility (high-priority callout).
  const role = variant === 'danger' ? 'alert' : 'note';
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`} role={role}>
      <p className={`mb-1 font-semibold ${VARIANT_TITLE_CLASSES[variant]}`}>{title}</p>
      <div className="text-ink-700">{children}</div>
    </div>
  );
}
