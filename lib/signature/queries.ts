// @MX:NOTE [AUTO] Signature query helpers — DB access layer for answer_signatures table.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-001, REQ-ESIG-005)

import { and, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { answerSignatures } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';

type DbClient = PostgresJsDatabase<typeof schema>;

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
  db: DbClient,
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
export async function insertSignature(data: InsertSignatureData, db: DbClient): Promise<SignatureRow> {
  const rows = await db
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
  db: DbClient,
): Promise<SignatureRow> {
  const rows = await db
    .update(answerSignatures)
    .set({ revokedAt: new Date(), revokedBy })
    .where(eq(answerSignatures.id, signatureId))
    .returning();

  return rows[0] as SignatureRow;
}
