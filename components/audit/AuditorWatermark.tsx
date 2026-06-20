// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001
// Visual marker that this is a read-only auditor view. Renders only when the
// session role is `auditor`, so other roles see no overlay.

'use client';

import { useSession } from 'next-auth/react';

export function AuditorWatermark() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== 'auditor') return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-4 top-4 z-50 rounded bg-amber-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-900 shadow"
    >
      Auditor View · Read Only
    </div>
  );
}
