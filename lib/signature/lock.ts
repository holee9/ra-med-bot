// @MX:ANCHOR [AUTO] isAnswerLocked — called by sign route, revoke route, and mutation guards.
// @MX:REASON fan_in >= 3: POST sign, PATCH answer refine, block PATCH, POST revoke all call this.
//            Locking gate for 21 CFR Part 11 §11.70 integrity enforcement.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-003)

import type { AuditDbHandle } from '@/lib/audit';
import { answerSignatures } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Returns true when the given message has an active (non-revoked) electronic signature.
 *
 * An active signature means the answer content is locked — no modifications are
 * permitted until the signature is explicitly revoked (§11.70).
 *
 * @param messageId - UUID of the message (answer) to check
 * @param db - Drizzle DB client (injected for testability)
 */
export async function isAnswerLocked(messageId: string, db: AuditDbHandle): Promise<boolean> {
  const rows = await db
    .select({ id: answerSignatures.id })
    .from(answerSignatures)
    .where(and(eq(answerSignatures.messageId, messageId), isNull(answerSignatures.revokedAt)));

  return rows.length > 0;
}
