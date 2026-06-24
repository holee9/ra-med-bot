// @MX:NOTE App shell layout — REQ-FND-013, 014. Hosts Sidebar (260px) on the
// left and Topbar (56px) over the main content area. The robots metadata
// here is a redundant safety belt; root layout already forces noindex.
// T-007: auth() called here to pass showExpertReview prop to Sidebar (REQ-ENTERPRISE-029).
// Issue #111: mustChangePassword redirect — forces admin bootstrap accounts to
// change their password on first login before accessing any app route.
// auth is dynamically imported to avoid next-auth module resolution issues in test env.

import Sidebar from '@/components/shell/Sidebar';
import Topbar from '@/components/shell/Topbar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // T-007: Dynamic import avoids pulling next-auth into test bundles at module init time.
  let showExpertReview = false;
  // SPEC-REGULA-PREDICATE-001 (REQ-PRE-029): Predicate Search nav is restricted to
  // RA/Dev/Exec departments. Resolved from the user's department on the session.
  let showPredicate = false;
  // SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35): Knowledge Gap nav gated to ra-member+.
  let showKnowledgeGap = false;
  // SPEC-REGULA-CLASSIFY-001 (Issue #59): Device Classification nav gated to ra-member+ (classify.view).
  let showClassify = false;
  // SPEC-REGULA-TRACEABILITY-001 (Issue #47): Traceability matrix nav gated to ra-member+ (traceability.view).
  let showTraceability = false;
  // SPEC-REGULA-PMS-001 (Issue #53): PMS Workbench nav gated to ra-member+ (pms.view).
  let showPms = false;
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54): Change Control nav gated to ra-member+ (change.view).
  let showChangeControl = false;
  // SPEC-REGULA-LABELING-001 (Issue #66): Labeling nav gated to ra-member+ (label.view).
  let showLabeling = false;
  try {
    const { auth } = await import('@/lib/auth');
    const { hasRole } = await import('@/lib/auth/rbac');
    const session = await auth();
    const userRole = (session?.user as { role?: string } | undefined)?.role;
    if (userRole) {
      showExpertReview = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-lead');
      showKnowledgeGap = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showClassify = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showTraceability = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showPms = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showChangeControl = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showLabeling = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
    }
    const department = (session?.user as { department?: string } | undefined)?.department;
    if (department) {
      const { canViewComparisons } = await import('@/lib/auth/predicate-permissions');
      // canViewComparisons covers RA/Dev/Exec — the departments allowed to see
      // the Predicate feature in the sidebar.
      showPredicate = canViewComparisons(department);
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

  return (
    <div className="flex min-h-screen bg-surface text-ink-700">
      <Sidebar
        showExpertReview={showExpertReview}
        showPredicate={showPredicate}
        showKnowledgeGap={showKnowledgeGap}
        showClassify={showClassify}
        showTraceability={showTraceability}
        showPms={showPms}
        showChangeControl={showChangeControl}
        showLabeling={showLabeling}
        initialLocale={initialLocale}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
