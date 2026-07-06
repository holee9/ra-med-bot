// @MX:NOTE App shell layout — REQ-FND-013, 014. Hosts Sidebar (260px) on the
// left and Topbar (56px) over the main content area. The robots metadata
// here is a redundant safety belt; root layout already forces noindex.
// T-007: auth() called here to pass showExpertReview prop to Sidebar (REQ-ENTERPRISE-029).
// Issue #111: mustChangePassword redirect — forces admin bootstrap accounts to
// change their password on first login before accessing any app route.
// auth is dynamically imported to avoid next-auth module resolution issues in test env.

import PersonaBarClient from '@/components/shell/PersonaBarClient';
import Sidebar from '@/components/shell/Sidebar';
import Topbar from '@/components/shell/Topbar';
import { type Tier, resolveTier } from '@/lib/auth/persona';
import type { Role } from '@/lib/auth/rbac';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
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
  // SPEC-REGULA-STANDARDS-001 (Issue #62): Harmonized Standards Tracker nav gated to viewer+ (standards.read).
  let showStandards = false;
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54): Change Control nav gated to ra-member+ (change.view).
  let showChangeControl = false;
  // SPEC-REGULA-LABELING-001 (Issue #66): Labeling nav gated to ra-member+ (label.view).
  let showLabeling = false;
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69): Clinical Investigation nav gated to ra-member+.
  let showClinicalInvestigation = false;
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48): Governance dashboard nav gated to ra-member+ (sourcegov.view).
  let showGovernance = false;
  // SPEC-REGULA-RLHF-001 (Issue #56): Quality heatmap nav gated to ra-member+
  // (rlhf.feedback submitters). The heatmap route uses audit.read, but feedback
  // submitters also see the nav to track answer quality.
  let showQualityHeatmap = false;
  // SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50): Team Knowledge nav gated to
  // ra-member+ (knowledgepromo.view). The library page itself also reads the
  // role to decide whether to show the "팀 지식" tab.
  let showTeamKnowledge = false;
  // Scope rationalization (2026-06-29 Issue #306): Authoring/Evidence nav gated to ra-member.
  let showAuthoring = false;
  let showEvidence = false;
  // SPEC-V3-UI-001 (Issue 320, REQ-V3-UI-031): Inbox nav gated to ra-member+ (inbox.view).
  let showInbox = false;
  // SPEC-V3-UI-001 M6 (REQ-V3-UI-050): Consult nav gated to ra-member+ (consult.session.view).
  let showConsult = false;
  // 2026-06-29: userRole을 try 밖에서 선언 (Sidebar userRole prop 전달용)
  let userRole: Role | undefined;
  try {
    const { auth } = await import('@/lib/auth');
    const { hasRole } = await import('@/lib/auth/rbac');
    const session = await auth();
    userRole = (session?.user as { role?: string } | undefined)?.role as Role | undefined;
    if (userRole) {
      showExpertReview = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-lead');
      showKnowledgeGap = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showClassify = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showTraceability = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      // @MX:NOTE [AUTO] showStandards raised to ra-member (2026-06-29) — 전사 직원
      // (viewer) 사이드바에서 조화 표준 추적기 제외 (RA/엔지니어 전문). Standards API는
      // 여전히 viewer 조회 가능(permission)하나 사이드바 노출은 ra-member+.
      showStandards = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      // Scope rationalization (2026-06-28): FREEZE/RETIRE domains are AND-gated
      // with FEATURE_FLAGS so the nav link hides when the flag is OFF, regardless
      // of role. Re-enable via NEXT_PUBLIC_FEATURE_<NAME>=true (code preserved).
      showChangeControl =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') &&
        FEATURE_FLAGS.CHANGE_CONTROL;
      showLabeling =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') && FEATURE_FLAGS.LABELING;
      showClinicalInvestigation =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') &&
        FEATURE_FLAGS.CLINICAL_INVESTIGATION;
      showGovernance =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') &&
        FEATURE_FLAGS.SOURCE_GOVERNANCE;
      showQualityHeatmap =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') &&
        FEATURE_FLAGS.QUALITY_HEATMAP;
      showTeamKnowledge =
        hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member') &&
        FEATURE_FLAGS.TEAM_KNOWLEDGE;
      // Scope rationalization (2026-06-29 Issue #306): Authoring/Evidence for ra-member+.
      showAuthoring = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      showEvidence = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      // SPEC-V3-UI-001 (Issue 320, REQ-V3-UI-031): Inbox nav gated to ra-member+ (inbox.view).
      showInbox = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
      // SPEC-V3-UI-001 M6 (REQ-V3-UI-050): Consult nav gated to ra-member+ (consult.session.view).
      showConsult = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
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
        showPredicate={showPredicate}
        showKnowledgeGap={showKnowledgeGap}
        showClassify={showClassify}
        showTraceability={showTraceability}
        showStandards={showStandards}
        showChangeControl={showChangeControl}
        showLabeling={showLabeling}
        showClinicalInvestigation={showClinicalInvestigation}
        showGovernance={showGovernance}
        showQualityHeatmap={showQualityHeatmap}
        showTeamKnowledge={showTeamKnowledge}
        showAuthoring={showAuthoring}
        showEvidence={showEvidence}
        showInbox={showInbox}
        showConsult={showConsult}
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
