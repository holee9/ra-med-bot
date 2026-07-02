// @MX:NOTE [AUTO] SLA deadline calculation for inbox_tickets.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-013, Issue #320)

/**
 * SLA configuration (organization-level setting).
 *
 * Default: 3 business days from creation.
 * TODO: Wire to org_settings table in future iteration.
 */
export interface SlaConfig {
  businessDays: number;
}

/**
 * Default SLA: 3 business days.
 */
const DEFAULT_SLA: SlaConfig = {
  businessDays: 3,
};

/**
 * Compute SLA deadline for an inbox ticket.
 *
 * REQ-V3-INBOX-013: SLA deadline based on createdAt + org configuration.
 * Current implementation uses fixed 3-business-day default.
 * Future: Read from org_settings.sla_business_days.
 *
 * @returns Date object representing the SLA deadline
 */
export function computeSlaDeadline(createdAt: Date, config: Partial<SlaConfig> = {}): Date {
  const sla = { ...DEFAULT_SLA, ...config };
  const deadline = new Date(createdAt);

  // Add business days (skipping weekends)
  let daysToAdd = sla.businessDays;
  while (daysToAdd > 0) {
    deadline.setDate(deadline.getDate() + 1);
    const dayOfWeek = deadline.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysToAdd--;
    }
  }

  return deadline;
}

/**
 * Check if a ticket is overdue (past SLA deadline).
 *
 * @returns true if slaDeadline exists and is in the past
 */
export function isOverdue(slaDeadline: Date | null): boolean {
  if (!slaDeadline) {
    return false;
  }
  return slaDeadline < new Date();
}

/**
 * Get SLA status for a ticket.
 *
 * @returns 'overdue' | 'warning' | 'ok'
 */
export function getSlaStatus(slaDeadline: Date | null): 'overdue' | 'warning' | 'ok' {
  if (!slaDeadline) {
    return 'ok';
  }

  const now = new Date();
  const hoursUntilDeadline = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDeadline < 0) {
    return 'overdue';
  }

  // Warning threshold: 24 hours before deadline
  if (hoursUntilDeadline < 24) {
    return 'warning';
  }

  return 'ok';
}
