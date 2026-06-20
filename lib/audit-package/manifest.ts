// @MX:ANCHOR [AUTO] Audit package manifest — SHA-256 integrity contract for evidence bundles.
// @MX:REASON The manifest is the cryptographic root of trust for an audit package.
//            FDA inspectors verify file integrity by recomputing SHA-256 against the manifest.
//            Any mismatch invalidates the evidence bundle (21 CFR Part 11 §11.10(c)).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #5)

import { createHash } from 'node:crypto';

// @MX:NOTE Manifest schema version. Bump only on breaking shape change.
export const MANIFEST_SCHEMA_VERSION = 1;

/**
 * Per-file entry inside the manifest. Each path is unique within the package.
 */
export interface ManifestFileEntry {
  /** ZIP-relative path, e.g. "audit-log/2026-01.jsonl". */
  path: string;
  /** Decompressed size in bytes. */
  size: number;
  /** SHA-256 hex digest (64 lowercase chars) of the decompressed content. */
  sha256: string;
}

/**
 * Top-level package manifest (serialized as manifest.json inside the ZIP).
 * SPEC AC #5: generation timestamp, requester identity, date range, per-file SHA-256.
 */
export interface AuditPackageManifest {
  schemaVersion: number;
  /** ISO-8601 UTC generation timestamp. */
  generatedAt: string;
  /** Auditor user ID who requested the package. */
  requesterId: string;
  /** Auditor email (display only — not used for auth). */
  requesterEmail?: string;
  /** Inclusive date range filter applied to source records. */
  dateRange: { start: string; end: string };
  /** One entry per included file. */
  files: ManifestFileEntry[];
}

interface BuildManifestInput {
  generatedAt: Date;
  requesterId: string;
  requesterEmail?: string;
  dateRange: { start: string; end: string };
  files: ManifestFileEntry[];
}

/**
 * Builds a JSON-serializable manifest. Dates are converted to ISO strings so the
 * result round-trips through JSON.stringify without mutating field types.
 */
export function buildManifest(input: BuildManifestInput): AuditPackageManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: input.generatedAt.toISOString(),
    requesterId: input.requesterId,
    requesterEmail: input.requesterEmail,
    dateRange: input.dateRange,
    files: input.files,
  };
}

/**
 * Computes the SHA-256 hex digest of UTF-8 string content.
 */
export function computeFileSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

interface VerifyResult {
  valid: boolean;
  mismatches: string[];
}

/**
 * Verifies that every file entry in the manifest matches the provided content map.
 * Returns the list of mismatched (or missing) paths.
 */
export function verifyManifest(
  manifest: AuditPackageManifest,
  contents: Map<string, string>,
): VerifyResult {
  const mismatches: string[] = [];
  for (const entry of manifest.files) {
    const content = contents.get(entry.path);
    if (content === undefined) {
      mismatches.push(entry.path);
      continue;
    }
    const actual = computeFileSha256(content);
    if (actual !== entry.sha256) {
      mismatches.push(entry.path);
    }
  }
  return { valid: mismatches.length === 0, mismatches };
}

/**
 * Extracts and parses manifest.json from a ZIP buffer.
 * Returns null if the manifest entry is absent or malformed.
 *
 * Delegates ZIP parsing to the builder module's zip-reader (kept separate so the
 * manifest module remains pure-data with no ZIP format coupling).
 */
export async function parseManifestFromZip(
  zipBuffer: Buffer,
): Promise<AuditPackageManifest | null> {
  const { readZipEntry } = await import('./zip');
  const text = readZipEntry(zipBuffer, 'manifest.json');
  if (text === null) return null;
  try {
    return JSON.parse(text) as AuditPackageManifest;
  } catch {
    return null;
  }
}
