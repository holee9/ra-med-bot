'use client';

// @MX:ANCHOR [AUTO] Triage action menu — enforces VALID_TRANSITIONS business invariant.
// @MX:REASON Fan-in will reach 3+ (TicketCard + future detail pages + bulk actions).
//            Directly encodes state machine rules from lib/domains/inbox/types.ts:33-40.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-020, REQ-V3-UI-032, AC-UI-003, Issue #320)

import { VALID_TRANSITIONS } from '@/lib/domains/inbox/types';
import { useTriageTransition } from '@/lib/queries/useInbox';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface TriageActionMenuProps {
  ticketId: string;
  currentState: import('@/lib/domains/inbox/types').TriageState;
  onTransition?: (
    toState: import('@/lib/domains/inbox/types').TriageState,
    reason?: string,
  ) => void;
  userRole?: 'ra-lead' | 'ra-member' | 'viewer';
}

const REASON_REQUIRED_STATES: Set<import('@/lib/domains/inbox/types').TriageState> = new Set([
  'rejected',
  'escalated',
]);

/**
 * Triage action menu component.
 *
 * Displays available state transitions based on VALID_TRANSITIONS.
 * Only renders for ra-lead+ users (REQ-V3-UI-032).
 *
 * REQ-V3-UI-020: Button menu with possible transitions
 * REQ-V3-UI-024: Reason prompt for rejected/escalated transitions
 * AC-UI-003: Covers all VALID_TRANSITIONS scenarios
 */
export function TriageActionMenu({
  ticketId,
  currentState,
  onTransition,
  userRole = 'ra-lead',
}: TriageActionMenuProps) {
  const t = useTranslations('inbox');
  const transitionMutation = useTriageTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<
    import('@/lib/domains/inbox/types').TriageState | null
  >(null);
  const [reason, setReason] = useState('');

  // Hide menu for non-lead users (REQ-V3-UI-032)
  if (userRole !== 'ra-lead') {
    return null;
  }

  const validTransitions = VALID_TRANSITIONS[currentState] || [];

  const handleTransitionClick = (toState: import('@/lib/domains/inbox/types').TriageState) => {
    if (REASON_REQUIRED_STATES.has(toState)) {
      // Show reason dialog for rejected/escalated (REQ-V3-UI-024)
      setPendingTransition(toState);
      setShowReasonDialog(true);
      setIsOpen(false);
    } else {
      // Direct transition for other states
      executeTransition(toState);
    }
  };

  const executeTransition = (
    toState: import('@/lib/domains/inbox/types').TriageState,
    reasonText?: string,
  ) => {
    if (onTransition) {
      onTransition(toState, reasonText);
    }
    transitionMutation.mutate({ ticketId, toState, reason: reasonText });
    setReason('');
    setShowReasonDialog(false);
    setPendingTransition(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        aria-label={t('actions.open')}
      >
        ⋮
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg z-10">
          {validTransitions.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No actions available</div>
          ) : (
            validTransitions.map((toState) => (
              <button
                key={toState}
                type="button"
                onClick={() => handleTransitionClick(toState)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 capitalize"
              >
                {toState.replace('-', ' ')}
              </button>
            ))
          )}
        </div>
      )}

      {showReasonDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-96 max-w-full">
            <h3 className="text-lg font-medium mb-4">
              Transition to {pendingTransition?.replace('-', ' ')}
            </h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional, max 500 characters)"
              maxLength={500}
              className="w-full p-2 border rounded mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReasonDialog(false);
                  setReason('');
                  setPendingTransition(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => pendingTransition && executeTransition(pendingTransition, reason)}
                className="px-4 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
