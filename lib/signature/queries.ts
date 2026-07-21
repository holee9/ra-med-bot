// @MX:NOTE [AUTO] Signature query helpers — DB access layer for answer_signatures table.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-001, REQ-ESIG-005)

import type { AuditDbHandle } from '@/lib/kernel/audit';
import { answerSignatures } from '@/lib/kernel/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export interface SignatureRow {
  id: string;
  messageId: string;
  signerId: string;
  signerName: string;
  signerTitle: string | null;
  meaning: string;
  recordHash: string;
  signedAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

export interface InsertSignatureData {
  messageId: string;
  signerId: string;
  signerName: string;
  signerTitle?: string | null;
  meaning: string;
  recordHash: string;
}

/**
 * Returns the active (non-revoked) signature for a message, or null if none.
 */
export async function getActiveSignature(
  messageId: string,
  db: AuditDbHandle,
): Promise<SignatureRow | null> {
  const rows = await db
    .select()
    .from(answerSignatures)
    .where(and(eq(answerSignatures.messageId, messageId), isNull(answerSignatures.revokedAt)));

  return (rows[0] as SignatureRow | undefined) ?? null;
}

/**
 * Inserts a new signature row and returns the created record.
 */
export async function insertSignature(
  data: InsertSignatureData,
  db: AuditDbHandle,
  // 21 CFR Part 11 §11.10(e) — optional caller tx so the signature INSERT can
  // ride the same transaction as the route's writeAudit (Issue #378).
  // Omit to keep the historical autocommit behavior (backward compatible).
  tx?: AuditDbHandle,
): Promise<SignatureRow> {
  const q = tx ?? db;
  const rows = await q
    .insert(answerSignatures)
    .values({
      messageId: data.messageId,
      signerId: data.signerId,
      signerName: data.signerName,
      signerTitle: data.signerTitle ?? null,
      meaning: data.meaning,
      recordHash: data.recordHash,
    })
    .returning();

  return rows[0] as SignatureRow;
}

/**
 * Soft-deletes a signature by setting revokedAt and revokedBy.
 * Returns the updated row.
 */
export async function revokeSignature(
  signatureId: string,
  revokedBy: string,
  db: AuditDbHandle,
  // 21 CFR Part 11 §11.10(e) — optional caller tx so the revoke UPDATE can
  // ride the same transaction as the route's writeAudit (Issue #378).
  tx?: AuditDbHandle,
): Promise<SignatureRow> {
  const q = tx ?? db;
  const rows = await q
    .update(answerSignatures)
    .set({ revokedAt: new Date(), revokedBy })
    .where(eq(answerSignatures.id, signatureId))
    .returning();

  return rows[0] as SignatureRow;
}
