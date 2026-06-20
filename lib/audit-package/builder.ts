// @MX:ANCHOR [AUTO] Audit package builder — assembles 1-click ZIP for external inspectors.
// @MX:REASON Single entry point for the audit-package route. Pulls the 5 required content
//            sections (audit log, signed answers, citations, expert reviews, compliance
//            reports) into a ZIP with a SHA-256 manifest (AC #4, #5).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5, #6)

import {
  type AuditPackageManifest,
  type ManifestFileEntry,
  buildManifest,
  computeFileSha256,
  parseManifestFromZip,
} from './manifest';
import { readZipEntry, writeZip } from './zip';

// @MX:NOTE Input row shapes — the route maps DB rows into these plain contracts
//          so the builder has no dependency on drizzle schema internals.
export interface AuditLogRow {
  id: string;
  createdAt: string;
  action: string;
  actorId: string | null;
  resourceType: string;
  resourceId: string;
  metaJson: unknown;
}

export interface SignedAnswerRow {
  id: string;
  messageId: string;
  signerName: string;
  signerTitle: string | null;
  meaning: string;
  recordHash: string;
  signedAt: string;
  isRevoked: boolean;
}

export interface CitationRow {
  id: string;
  source: string;
  url: string;
  referencedBy: string;
}

export interface ExpertReviewRow {
  id: string;
  status: string;
  reviewerId: string | null;
  decidedAt: string | null;
  message: string | null;
}

export interface ComplianceReportRow {
  id: string;
  type: string;
  generatedAt: string;
}

export interface AuditPackageInput {
  requesterId: string;
  requesterEmail?: string;
  dateRange: { start: string; end: string };
  auditLog: AuditLogRow[];
  signedAnswers: SignedAnswerRow[];
  citations: CitationRow[];
  expertReviews: ExpertReviewRow[];
  complianceReports: ComplianceReportRow[];
}

export interface BuiltPackage {
  zipBuffer: Buffer;
  manifest: AuditPackageManifest;
  readFile: (path: string) => Buffer | null;
}

function ndjson(rows: unknown[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}

function entryFromContent(path: string, content: string): ManifestFileEntry {
  return {
    path,
    size: Buffer.byteLength(content, 'utf8'),
    sha256: computeFileSha256(content),
  };
}

/**
 * Assembles the audit package ZIP in memory. Pure function — no DB access, no I/O.
 * The route is responsible for sourcing rows from the DB and passing them in.
 *
 * Layout (AC #4):
 *   manifest.json
 *   audit-log/<dateRange>.jsonl
 *   signed-answers/records.jsonl
 *   citations/records.jsonl
 *   expert-reviews/records.jsonl
 *   compliance-reports/records.jsonl
 */
export async function buildAuditPackage(input: AuditPackageInput): Promise<BuiltPackage> {
  const rangeLabel = `${input.dateRange.start}_${input.dateRange.end}`;

  const files: { path: string; content: string }[] = [
    {
      path: `audit-log/${rangeLabel}.jsonl`,
      content: ndjson(input.auditLog),
    },
    {
      path: 'signed-answers/records.jsonl',
      content: ndjson(input.signedAnswers),
    },
    {
      path: 'citations/records.jsonl',
      content: ndjson(input.citations),
    },
    {
      path: 'expert-reviews/records.jsonl',
      content: ndjson(input.expertReviews),
    },
    {
      path: 'compliance-reports/records.jsonl',
      content: ndjson(input.complianceReports),
    },
  ];

  const manifestEntries: ManifestFileEntry[] = files.map((f) =>
    entryFromContent(f.path, f.content),
  );

  const generatedAt = new Date();
  const manifest = buildManifest({
    generatedAt,
    requesterId: input.requesterId,
    requesterEmail: input.requesterEmail,
    dateRange: input.dateRange,
    files: manifestEntries,
  });

  // manifest.json is added last so it sits at the top of the archive view.
  const manifestJson = JSON.stringify(manifest, null, 2);
  const allFiles = [
    ...files.map((f) => ({ path: f.path, content: Buffer.from(f.content, 'utf8') })),
    { path: 'manifest.json', content: Buffer.from(manifestJson, 'utf8') },
  ];

  const zipBuffer = writeZip(allFiles);

  return {
    zipBuffer,
    manifest,
    readFile: (path: string): Buffer | null => {
      const text = readZipEntry(zipBuffer, path);
      return text === null ? null : Buffer.from(text, 'utf8');
    },
  };
}

// Re-export so tests can reach parseManifestFromZip via the builder module if needed.
export { parseManifestFromZip };
