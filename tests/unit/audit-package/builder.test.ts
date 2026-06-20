// @MX:NOTE [AUTO] TDD RED — audit package ZIP builder (SPEC-REGULA-AUDITOR-VIEW-001).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5, #6)

import { createUnzip } from 'node:zlib';
import { type AuditPackageInput, buildAuditPackage } from '@/lib/audit-package/builder';
import { computeFileSha256, parseManifestFromZip } from '@/lib/audit-package/manifest';
import { describe, expect, it } from 'vitest';

function makeInput(): AuditPackageInput {
  return {
    requesterId: 'user-auditor-1',
    requesterEmail: 'inspector@fda.gov',
    dateRange: { start: '2025-06-21', end: '2026-06-21' },
    auditLog: [
      {
        id: 'log-1',
        createdAt: '2026-01-15T10:00:00Z',
        action: 'signature.applied',
        actorId: 'user-ra-lead',
        resourceType: 'signature',
        resourceId: 'sig-1',
        metaJson: { meaning: 'approve' },
      },
    ],
    signedAnswers: [
      {
        id: 'sig-1',
        messageId: 'msg-1',
        signerName: 'Dr. Lee',
        signerTitle: 'RA Lead',
        meaning: 'I approve',
        recordHash: 'deadbeef',
        signedAt: '2026-01-15T10:00:00Z',
        isRevoked: false,
      },
    ],
    citations: [
      {
        id: 'cit-1',
        source: 'FDA Guidance',
        url: 'https://example.com/fda',
        referencedBy: 'msg-1',
      },
    ],
    expertReviews: [
      {
        id: 'rev-1',
        status: 'approved',
        reviewerId: 'user-ra-lead',
        decidedAt: '2026-02-01T00:00:00Z',
        message: 'clinically validated',
      },
    ],
    complianceReports: [
      { id: 'rep-1', type: 'predicate-comparison', generatedAt: '2026-03-01T00:00:00Z' },
    ],
  };
}

describe('SPEC-REGULA-AUDITOR-VIEW-001 — audit package builder (AC #4, #5, #6)', () => {
  it('returns a Buffer (valid ZIP binary)', async () => {
    const pkg = await buildAuditPackage(makeInput());
    expect(Buffer.isBuffer(pkg.zipBuffer)).toBe(true);
    // ZIP magic bytes
    expect(pkg.zipBuffer.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  it('ZIP contains a manifest.json entry', async () => {
    const pkg = await buildAuditPackage(makeInput());
    const manifest = await parseManifestFromZip(pkg.zipBuffer);
    expect(manifest).not.toBeNull();
    expect(manifest?.schemaVersion).toBe(1);
    expect(manifest?.requesterId).toBe('user-auditor-1');
  });

  it('manifest lists every included file with a SHA-256 hash', async () => {
    const pkg = await buildAuditPackage(makeInput());
    const manifest = await parseManifestFromZip(pkg.zipBuffer);

    expect(manifest?.files.length).toBeGreaterThanOrEqual(5);
    for (const f of manifest?.files ?? []) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(f.path.length).toBeGreaterThan(0);
      expect(f.size).toBeGreaterThan(0);
    }
  });

  it('ZIP contains the 5 required content sections', async () => {
    const pkg = await buildAuditPackage(makeInput());
    const manifest = await parseManifestFromZip(pkg.zipBuffer);
    const paths = (manifest?.files ?? []).map((f) => f.path);

    // AC #4: audit log, signed answers, citations, expert reviews, compliance reports
    expect(paths.some((p) => p.startsWith('audit-log/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('signed-answers/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('citations/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('expert-reviews/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('compliance-reports/'))).toBe(true);
  });

  it('every file hash in the manifest matches the actual ZIP content (integrity)', async () => {
    const pkg = await buildAuditPackage(makeInput());
    const manifest = await parseManifestFromZip(pkg.zipBuffer);
    expect(manifest).not.toBeNull();
    if (!manifest) return;

    for (const entry of manifest.files) {
      const content = pkg.readFile(entry.path);
      expect(content).not.toBeNull();
      // Asserted non-null above; narrow for the hash computation.
      if (!content) continue;
      const actualHash = computeFileSha256(content.toString('utf8'));
      expect(actualHash).toBe(entry.sha256);
    }
  });

  it('date range is reflected in the manifest', async () => {
    const pkg = await buildAuditPackage(makeInput());
    const manifest = await parseManifestFromZip(pkg.zipBuffer);
    expect(manifest?.dateRange).toEqual({ start: '2025-06-21', end: '2026-06-21' });
  });

  it('generatedAt timestamp is ISO-8601 UTC', async () => {
    const pkg = await buildAuditPackage(makeInput());
    const manifest = await parseManifestFromZip(pkg.zipBuffer);
    expect(manifest?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('package size for a 12-month range stays bounded (AC #6 — < 60s implies bounded size)', async () => {
    const big: AuditPackageInput = {
      ...makeInput(),
      auditLog: Array.from({ length: 1000 }, (_, i) => ({
        id: `log-${i}`,
        createdAt: '2026-01-15T10:00:00Z',
        action: 'signature.applied',
        actorId: 'user-x',
        resourceType: 'signature',
        resourceId: `sig-${i}`,
        metaJson: {},
      })),
    };
    const pkg = await buildAuditPackage(big);
    // Sanity ceiling: a 1000-entry package should be well under 10 MB.
    expect(pkg.zipBuffer.length).toBeLessThan(10 * 1024 * 1024);
  });
});
