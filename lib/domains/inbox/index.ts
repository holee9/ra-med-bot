// @MX:NOTE [AUTO] RA Inbox domain — public API exports.
// @MX:SPEC SPEC-V3-INBOX-001 (Issue #320)

// Types
export type {
  TriageState,
  ApprovedAnswerState,
  Citation,
  PromotionInput,
  TriageTransitionInput,
} from './types';

// State machine
export { canTransition, nextStates, assertValidTransition } from './state-machine';

// Access control
export { assertTicketInOrg, isTicketInOrg } from './access';

// Audit
export { auditTransition } from './audit';

// Promotion
export { promoteToApproved } from './promote';

// Queries
export { listByTriageState, getTicket, countByState } from './queries';
export type { TicketFilters } from './queries';

// SLA
export { computeSlaDeadline, isOverdue, getSlaStatus } from './sla';
export type { SlaConfig } from './sla';
