// @MX:NOTE [AUTO] Device Classification wizard page — SPEC-REGULA-CLASSIFY-001 (Issue #59, T3).
// Server Component shell: resolves role server-side via auth() + hasRole and passes
// capability booleans to the ClassificationWizard client island. The backend
// (POST /api/classify/run) re-checks via withPermission('classify.generate') — the
// client gate is a UX safeguard, not the only gate (tier0 lesson).
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001~004, REQ-CLASSIFY-019~020)

import { BetaBadge } from '@/components/ui/BetaBadge';
import { auth } from '@/lib/kernel/auth';
import { type Role, hasRole } from '@/lib/kernel/auth/rbac';
import type { Metadata } from 'next';
import { ClassificationWizard } from './_components/ClassificationWizard';

export const metadata: Metadata = {
  title: '기기 분류 마법사 — Regula',
  description:
    '다중 관할권 의료기기 분류 — FDA, EU MDR, MFDS, NMPA, PMDA (SPEC-REGULA-CLASSIFY-001)',
  robots: { index: false, follow: false },
};

export default async function ClassificationPage() {
  // Resolve role server-side; defaults to least-privileged when auth is
  // unavailable (build / test environments) — mirrors the knowledge-gap page.
  let role: Role | undefined;
  try {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    role = user?.role as Role | undefined;
  } catch {
    // auth() throws in test/build environments — fall through with no perms.
  }

  // classify.view (ra-member+): can open the page and see results.
  const canView = role ? hasRole(role, 'ra-member') : false;
  // classify.generate (ra-lead+): can submit the wizard and create a run.
  // The backend re-checks this via withPermission — client gate is UX-only.
  const canGenerate = role ? hasRole(role, 'ra-lead') : false;

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">기기 분류 마법사</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          다중 관할권 분류 — FDA · EU MDR · MFDS · NMPA · PMDA
        </p>
      </header>

      {!canView ? (
        <p
          className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
          data-testid="classify-unauthorized"
        >
          이 페이지를 볼 권한이 없습니다.
        </p>
      ) : (
        <ClassificationWizard canGenerate={canGenerate} />
      )}
    </section>
  );
}
