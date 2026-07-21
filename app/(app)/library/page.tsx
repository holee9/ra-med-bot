// @MX:NOTE [AUTO] Library view — personal bookmarks + team knowledge (promoted answers).
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-003, 004, Issue #86)
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-008/011/012/015, Issue #50, AC-06)
//
// Server component. Resolves the viewer role once at request time to decide
// whether the "팀 지식" tab is visible (knowledgepromo.view = ra-member+). The
// interactive tab/list/search state lives in the <LibraryClient> child.

import LibraryClient, { type LibraryClientProps } from './LibraryClient';

export default async function LibraryPage(): Promise<React.ReactElement> {
  // Resolve role server-side so the tab visibility decision never reaches the
  // client as a credential — only a boolean. The promoted-answers API still
  // re-checks via withPermission('knowledgepromo.view').
  let canViewTeam = false;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const { hasRole } = await import('@/lib/kernel/auth/rbac');
    const session = await auth();
    const userRole = (session?.user as { role?: string } | undefined)?.role;
    if (userRole) {
      canViewTeam = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-member');
    }
  } catch {
    // Test/build env fallback — team tab hidden.
  }

  const props: LibraryClientProps = { canViewTeam };
  return <LibraryClient {...props} />;
}
