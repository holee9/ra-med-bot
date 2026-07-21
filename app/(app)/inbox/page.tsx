// @MX:NOTE [AUTO] Inbox page — 4-column Kanban board for RA Inbox.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-001/002/030/032/043, AC-UI-002)
// Server component with RBAC check: ra-member+ only. Viewer redirects to /chat.

import { InboxKanban } from '@/components/inbox/InboxKanban';
import { auth } from '@/lib/kernel/auth';
import { hasRole } from '@/lib/kernel/auth/rbac';
import type { Role } from '@/lib/kernel/auth/rbac';
import { redirect } from 'next/navigation';

export default async function InboxPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/');
  }

  const userRole = (session.user as { role?: Role }).role;

  // REQ-V3-UI-030: viewer 역할은 /chat로 리다이렉트
  // AC-UI-002: ra-member+만 접근 허용
  if (!userRole || !hasRole(userRole, 'ra-member')) {
    redirect('/chat');
  }

  return <InboxKanban />;
}
