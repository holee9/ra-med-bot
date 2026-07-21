// @MX:NOTE [AUTO] ConsultSessionDetail — session detail layout with turns history.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-054, AC-CONS-UI-003)

import type { Role } from '@/lib/kernel/auth/rbac';
import type { ConsultSession, ConsultTurn } from '@/lib/queries/useConsult';
import { QuestionComposer } from './QuestionComposer';
import { TurnHistoryItem } from './TurnHistoryItem';

interface ConsultSessionDetailProps {
  session: ConsultSession;
  turns: ConsultTurn[];
  userRole: Role;
}

export function ConsultSessionDetail({ session, turns, userRole }: ConsultSessionDetailProps) {
  return (
    <div className="space-y-6">
      {/* Session metadata */}
      <div>
        <h1 data-testid="consult-session-title" className="text-2xl font-bold">
          {session.title}
        </h1>
        <p data-testid="consult-session-meta" className="text-sm text-gray-600">
          Created: {new Date(session.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Turns history (turnNumber asc) */}
      <div data-testid="consult-turns-history" className="space-y-4">
        {turns.map((turn) => (
          <TurnHistoryItem key={turn.id} turn={turn} />
        ))}
      </div>

      {/* Question composer */}
      {userRole !== 'viewer' && (
        <div className="border-t pt-4">
          <QuestionComposer sessionId={session.id} />
        </div>
      )}
    </div>
  );
}
