// @MX:WARN [AUTO] AES-256-GCM encryption — cryptographic key management.
// @MX:REASON PII_MAP_KEY must be 32 bytes; wrong length causes decryption failure.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-6)

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // GCM requires 12-byte IV
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length

function getEncryptionKey(): Buffer {
  const key = process.env.PII_MAP_KEY;
  if (!key) throw new Error('PII_MAP_KEY environment variable is required');
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== KEY_LENGTH)
    throw new Error(`PII_MAP_KEY must be 32 bytes (base64-encoded), got ${buf.length} bytes`);
  return buf;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns base64-encoded IV and ciphertext (including auth tag).
 */
export function encryptPii(plaintext: string): { iv: string; ciphertext: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Prepend authTag to ciphertext so decryptPii can extract it
  const combined = Buffer.concat([authTag, encrypted]);

  return {
    iv: iv.toString('base64'),
    ciphertext: combined.toString('base64'),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext.
 * Expects base64-encoded iv and ciphertext (with prepended auth tag).
 */
export function decryptPii(iv: string, ciphertext: string): string {
  const key = getEncryptionKey();
  const ivBuf = Buffer.from(iv, 'base64');
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract authTag (first 16 bytes) and actual ciphertext
  const authTag = combined.subarray(0, AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export interface RedactionMapEntry {
  documentId: string;
  iv: string;
  encryptedOriginal: string;
  redactedPlaceholder: string;
  piiType: string;
  confidence: number;
}

/**
 * Inserts a redaction map entry into private.redaction_maps.
 * Uses raw SQL because Drizzle ORM does not support non-public schemas.
 * 21 CFR Part 11: append-only, never update or delete redaction records.
 */
export async function saveRedactionMap(entry: RedactionMapEntry): Promise<void> {
  // Lazy import to avoid triggering env validation in test environments
  const { db } = await import('@/lib/db/client');
  const { sql } = await import('drizzle-orm');
  await db.execute(
    sql`INSERT INTO private.redaction_maps
          (document_id, original_text_iv, encrypted_original, redacted_placeholder, pii_type, confidence)
        VALUES
          (${entry.documentId}, ${entry.iv}, ${entry.encryptedOriginal},
           ${entry.redactedPlaceholder}, ${entry.piiType}, ${entry.confidence})`,
  );
}
