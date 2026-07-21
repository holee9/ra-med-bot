// @MX:NOTE [AUTO] Inbox detail page — server component, RBAC + param resolution.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-010/032/034, AC-UI-003/009, Issue 320)
// RBAC: ra-member+ sees full detail. Viewer sees their OWN ticket only
// (ViewerTicketSummary, REQ-V3-UI-034) — backend IDOR (access.ts) returns 404
// for tickets the viewer doesn't own. REQ-V3-UI-030 redirect applies to /inbox
// (list), not to /inbox/[id] own-ticket detail.

import { InboxDetailClient } from '@/components/inbox/InboxDetailClient';
import type { Role } from '@/lib/kernel/auth/rbac';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InboxDetailPage({ params }: PageProps) {
  const { id } = await params;

  let userRole: Role | undefined;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const session = await auth();
    userRole = (session?.user as { role?: Role })?.role;
  } catch {
    // test/build env where auth is unavailable — fall through with undefined role.
  }

  return <InboxDetailClient ticketId={id} userRole={userRole ?? 'viewer'} />;
}
