// @MX:NOTE [AUTO] Admin quarantine notification — sets flag readable by admin dashboard badge.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-025)
// In-memory store for notification flags (in production: Redis or Postgres-backed)
import { logger } from '@/lib/observability/logger';

interface QuarantineNotification {
  documentId: string;
  reason: string;
  notifiedAt: Date;
}

// Module-level store — cleared between test runs
const notifications: QuarantineNotification[] = [];

/**
 * Set a quarantine notification flag for the admin dashboard.
 * The dashboard badge reads unread notifications from this store.
 */
export async function notifyAdminQuarantine(documentId: string, reason: string): Promise<void> {
  notifications.push({ documentId, reason, notifiedAt: new Date() });
  logger.warn(`[quarantine] Document ${documentId} quarantined: ${reason}`);

  // In production: store in database + optionally send email/Slack alert
  // UPDATE organization_documents SET status = 'quarantine' WHERE id = documentId
}

/** Get all unread quarantine notifications (for admin dashboard API). */
export function getQuarantineNotifications(): QuarantineNotification[] {
  return [...notifications];
}

/** Clear notifications (for testing). */
export function clearQuarantineNotifications(): void {
  notifications.length = 0;
}
