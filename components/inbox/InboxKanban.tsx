// @MX:NOTE [AUTO] InboxKanban — 4-column Kanban board for RA Inbox.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-001/005/045, AC-UI-012, Issue 320)
'use client';

import type { TriageState } from '@/lib/domains/inbox/types';
import { useInboxTickets } from '@/lib/queries/useInbox';
import { useInboxStore } from '@/stores/inbox';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { KanbanColumn } from './KanbanColumn';

// Active triage states (non-terminal)
const ACTIVE_STATES: TriageState[] = ['auto', 'needs-review', 'escalated', 'waiting'];

// Terminal states shown only when showArchived is true
const TERMINAL_STATES: TriageState[] = ['closed', 'rejected'];

/**
 * Column container — calls useInboxTickets at its own top level to satisfy
 * the Rules of Hooks (cannot call hooks inside a .map() callback).
 */
function KanbanColumnContainer({ state, title }: { state: TriageState; title: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useInboxTickets(state);

  return (
    <KanbanColumn
      title={title}
      state={state}
      tickets={data ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={() => queryClient.invalidateQueries({ queryKey: ['inbox', state] })}
    />
  );
}

export function InboxKanban(): React.JSX.Element {
  const t = useTranslations('inbox');
  const queryClient = useQueryClient();
  const { showArchived, toggleArchived } = useInboxStore();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
  };

  // Determine which states to show (does NOT drive hook call count — see KanbanColumnContainer)
  const statesToShow = showArchived ? [...ACTIVE_STATES, ...TERMINAL_STATES] : ACTIVE_STATES;

  return (
    <div className="flex h-full flex-col">
      {/* Header with controls */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {t('actions.refresh')}
          </button>
          <button
            type="button"
            onClick={toggleArchived}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
        </div>
      </div>

      {/* Kanban columns — each child component owns its hook call */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statesToShow.map((state) => (
          <KanbanColumnContainer key={state} state={state} title={t(`columns.${state}`)} />
        ))}
      </div>
    </div>
  );
}
