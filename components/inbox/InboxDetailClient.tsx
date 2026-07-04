// @MX:NOTE [AUTO] InboxDetailClient — ticket detail view (client-side data fetch).
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-010/011/012, AC-UI-003/004, Issue #320)
'use client';

import type { Role } from '@/lib/auth/rbac';
import { useInboxTicket } from '@/lib/queries/useInbox';
import { ActivityTimeline } from './ActivityTimeline';
import { ApproveDialog } from './ApproveDialog';
import { TicketCard } from './TicketCard';

interface InboxDetailClientProps {
  ticketId: string;
  userRole: Role;
}

export function InboxDetailClient({ ticketId, userRole }: InboxDetailClientProps) {
  const { data: ticket, isLoading, error } = useInboxTicket(ticketId);

  if (isLoading) {
    return <div data-testid="inbox-detail-loading">Loading…</div>;
  }

  if (error || !ticket) {
    return (
      <div data-testid="inbox-detail-notfound" className="p-4">
        Ticket not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <TicketCard ticket={ticket} userRole={userRole} />
      <ActivityTimeline
        createdAt={ticket.createdAt ?? new Date().toISOString()}
        updatedAt={ticket.updatedAt ?? new Date().toISOString()}
        triageState={ticket.triageState}
        assigneeId={ticket.assigneeId}
      />
      {userRole === 'ra-lead' && ticket.triageState !== 'closed' && (
        <ApproveDialog ticketId={ticket.id} />
      )}
    </div>
  );
}
