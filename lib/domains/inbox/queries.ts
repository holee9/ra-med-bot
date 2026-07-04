// @MX:NOTE [AUTO] Kanban board queries for inbox_tickets.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-007, Issue 320)

import type { Database } from '@/lib/db/client';
import { inboxTickets } from '@/lib/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { TriageState } from './types';

/**
 * Filters for listing tickets by triage state.
 */
export interface TicketFilters {
  state?: TriageState;
  limit?: number;
  offset?: number;
}

/**
 * List inbox tickets by organization and triage state (Kanban view).
 *
 * REQ-V3-INBOX-007: Kanban board queries tickets grouped by triage_state.
 * Uses withTenantScope pattern (app-layer eq(orgId) defense-in-depth).
 *
 * @returns Array of tickets matching the filters
 */
export async function listByTriageState(db: Database, orgId: string, filters: TicketFilters = {}) {
  const { state, limit = 50, offset = 0 } = filters;

  const conditions = [eq(inboxTickets.orgId, orgId)];

  if (state) {
    conditions.push(eq(inboxTickets.triageState, state));
  }

  return db
    .select()
    .from(inboxTickets)
    .where(and(...conditions))
    .orderBy(desc(inboxTickets.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get a single ticket by ID (with org scope validation).
 *
 * Returns null if ticket not found or cross-org access attempted.
 * Callers should use assertTicketInOrg for explicit IDOR defense.
 *
 * @returns Ticket object or null
 */
export async function getTicket(db: Database, orgId: string, ticketId: string) {
  return db
    .select()
    .from(inboxTickets)
    .where(and(eq(inboxTickets.id, ticketId), eq(inboxTickets.orgId, orgId)))
    .limit(1);
}

/**
 * Count tickets by state for Kanban column headers.
 *
 * @returns Record mapping state to count
 */
export async function countByState(
  db: Database,
  orgId: string,
): Promise<Record<TriageState, number>> {
  const counts = await db
    .select({
      state: inboxTickets.triageState,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(inboxTickets)
    .where(eq(inboxTickets.orgId, orgId))
    .groupBy(inboxTickets.triageState);

  const result: Partial<Record<TriageState, number>> = {};
  for (const row of counts) {
    result[row.state as TriageState] = row.count;
  }

  // Ensure all states are present (default to 0)
  const states: TriageState[] = [
    'auto',
    'needs-review',
    'escalated',
    'waiting',
    'closed',
    'rejected',
  ];
  for (const state of states) {
    if (result[state] === undefined) {
      result[state] = 0;
    }
  }

  return result as Record<TriageState, number>;
}
