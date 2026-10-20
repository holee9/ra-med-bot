// @MX:NOTE App shell layout — REQ-FND-013, 014. Hosts Sidebar (260px) on the
// left and Topbar (56px) over the main content area. The robots metadata
// here is a redundant safety belt; root layout already forces noindex.
// T-007: auth() called here to pass showExpertReview prop to Sidebar (REQ-ENTERPRISE-029).
// Issue #111: mustChangePassword redirect — forces admin bootstrap accounts to
// change their password on first login before accessing any app route.
// auth is dynamically imported to avoid next-auth module resolution issues in test env.
// 2026-10-20 scope purge: 13 drifted feature navs removed here together with
// their routes — see Sidebar.tsx for the deletion note.

import PersonaBarClient from '@/components/shell/PersonaBarClient';
import Sidebar from '@/components/shell/Sidebar';
import Topbar from '@/components/shell/Topbar';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { type Tier, resolveTier } from '@/lib/kernel/auth/persona';
import type { Role } from '@/lib/kernel/auth/rbac';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // T-007: Dynamic import avoids pulling next-auth into test bundles at module init time.
  let showExpertReview = false;
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48): Governance dashboard nav gated to ra-member+ (sourcegov.view).
  let showGovernance = false;
  // SPEC-V3-UI-001 (Issue 320, REQ-V3-UI-031): Inbox nav gated to ra-member+ (inbox.view).
  let showInbox = false;
  // 2026-06-29: userRole을 try 밖에서 선언 (Sidebar userRole prop 전달용)
  let userRole: Role | undefined;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const { hasRole } = await import('@/lib/kernel/auth/rbac');
    const session = await auth();
    userRole = (session?.user as { role?: string } | undefined)?.role as Role | undefined;
    if (userRole) {
      showExpertReview = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-lead');
      showGovernance =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') &&
        FEATURE_FLAGS.SOURCE_GOVERNANCE;
      // SPEC-V3-UI-001 (Issue 320, REQ-V3-UI-031): Inbox nav gated to ra-member+ (inbox.view).
      showInbox = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
    }
    // Issue #111: force password change before any app access.
    const mustChange = (session?.user as { mustChangePassword?: boolean } | undefined)
      ?.mustChangePassword;
    if (mustChange) redirect('/change-password');
  } catch {
    // In test/build environments where auth is unavailable, default to false.
  }

  const cookieStore = await cookies();
  const initialLocale = cookieStore.get('regula-locale')?.value ?? 'ko';
  // SPEC-V3-PERSONA-001 M4 (REQ-V3-PER-004 / REQ-V3-PER-NFR-002): server-side
  // canonical tier derivation. resolveTier re-derives from session.user.role on
  // every request and rejects any cookie value that would escalate privileges.
  // Tier is view-only — RBAC gates still read the real role.
  const effectiveRole = (userRole ?? 'viewer') as Role;
  const initialTier: Tier = resolveTier(effectiveRole, cookieStore);

  return (
    <div className="flex min-h-screen bg-surface text-ink-700">
      <Sidebar
        showExpertReview={showExpertReview}
        showGovernance={showGovernance}
        showInbox={showInbox}
        userRole={(userRole ?? 'viewer') as Role}
        initialLocale={initialLocale}
        tier={initialTier}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* SPEC-V3-PERSONA-001 M4 (REQ-V3-PER-001): PersonaBar placed just under
            Topbar. Server injects initialTier; PersonaBarClient owns tier state
            on the client and calls router.refresh() on switch. */}
        <PersonaBarClient initialTier={initialTier} userRole={effectiveRole} />
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
