// @MX:NOTE [AUTO] KanbanColumn — Single Kanban column with tickets list.
'use client';

import type { TriageState } from '@/lib/domains/inbox/types';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { TicketCard } from './TicketCard';

interface InboxTicket {
  id: string;
  question: string;
  triageState: TriageState;
  createdAt?: string;
  updatedAt?: string;
  assigneeId?: string | null;
}

interface KanbanColumnProps {
  title: string;
  state: TriageState;
  tickets: InboxTicket[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function KanbanColumn({
  title,
  state,
  tickets,
  isLoading = false,
  error = null,
  onRetry,
}: KanbanColumnProps): React.JSX.Element {
  const t = useTranslations('inbox');

  return (
    <div
      data-testid={`kanban-column-${state}`}
      className="flex min-w-[300px] flex-col rounded-lg border border-gray-200 bg-white p-4"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-sm text-gray-600">
          {tickets.length}
        </span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div data-testid="column-loading" className="space-y-2">
          <div className="h-20 animate-pulse rounded bg-gray-200" aria-label="Loading ticket" />
          <div className="h-20 animate-pulse rounded bg-gray-200" aria-label="Loading ticket" />
          <div className="h-20 animate-pulse rounded bg-gray-200" aria-label="Loading ticket" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div data-testid="column-error" className="flex flex-col items-center justify-center py-8">
          <p className="mb-2 text-sm text-red-600">{t('errors.transitionFailed')}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {t('actions.refresh')}
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && tickets.length === 0 && (
        <div
          data-testid="column-empty"
          className="flex items-center justify-center py-8 text-gray-400"
        >
          <span>{t('empty')}</span>
        </div>
      )}

      {/* Tickets List */}
      {!isLoading && !error && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
