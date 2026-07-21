// @MX:NOTE [AUTO] Kanban ticket card component.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-001, REQ-V3-UI-004, Issue 320)

import type { TriageState } from '@/lib/domains/inbox/types';
import type { Role } from '@/lib/kernel/auth/rbac';
import { useInboxStore } from '@/stores/inbox';
import Link from 'next/link';
import { SlaBadge } from './SlaBadge';
import { TriageActionMenu } from './TriageActionMenu';
import { STATE_TOKENS } from './state-tokens';

interface TicketCardProps {
  ticket: {
    id: string;
    question: string;
    triageState: TriageState;
    slaDeadline?: string | null;
    assigneeId?: string | null;
  };
  userRole?: Role;
}

/**
 * Kanban ticket card component.
 *
 * Displays:
 * - Question excerpt
 * - Triage state badge
 * - Assignee (if present)
 * - SLA badge (if deadline exists)
 * - Triage action menu (for ra-lead+ users)
 *
 * REQ-V3-UI-001: Click navigates to /inbox/[id]
 */
export function TicketCard({ ticket, userRole = 'viewer' }: TicketCardProps) {
  const { setSelectedTicketId } = useInboxStore();

  const handleClick = () => {
    setSelectedTicketId(ticket.id);
  };

  const borderColor = STATE_TOKENS[ticket.triageState].border;

  return (
    <div
      className={`${borderColor} border-l-4 bg-white p-4 rounded shadow hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-2">
        <Link href={`/inbox/${ticket.id}`} onClick={handleClick} className="flex-1">
          <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 rounded">
            {ticket.triageState}
          </span>
        </Link>

        {userRole === 'ra-lead' && (
          <TriageActionMenu
            ticketId={ticket.id}
            currentState={ticket.triageState}
            userRole={userRole}
          />
        )}
      </div>

      <Link href={`/inbox/${ticket.id}`} onClick={handleClick} className="block">
        <p className="text-sm text-gray-700 mb-3 line-clamp-3">{ticket.question}</p>
      </Link>

      <div className="flex items-center justify-between text-xs text-gray-500">
        {ticket.assigneeId && <span>Assigned: {ticket.assigneeId}</span>}

        {ticket.slaDeadline && <SlaBadge slaDeadline={ticket.slaDeadline} />}
      </div>
    </div>
  );
}
