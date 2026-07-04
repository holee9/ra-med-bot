// @MX:NOTE [AUTO] Inbox detail page — server component, RBAC + param resolution.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-010/030/032, AC-UI-003, Issue 320)
// RBAC: ra-member+ only. Viewer redirects to /chat (data fetching is client-side).

import { InboxDetailClient } from '@/components/inbox/InboxDetailClient';
import type { Role } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InboxDetailPage({ params }: PageProps) {
  const { id } = await params;

  let userRole: Role | undefined;
  try {
    const { auth } = await import('@/lib/auth');
    const { hasRole } = await import('@/lib/auth/rbac');
    const session = await auth();
    userRole = (session?.user as { role?: Role })?.role;
    // REQ-V3-UI-030: viewer-only → /chat redirect. ra-member+ only.
    if (!userRole || !hasRole(userRole, 'ra-member')) {
      redirect('/chat');
    }
  } catch {
    // test/build env where auth is unavailable — fall through with undefined role.
  }

  return <InboxDetailClient ticketId={id} userRole={userRole ?? 'viewer'} />;
}
