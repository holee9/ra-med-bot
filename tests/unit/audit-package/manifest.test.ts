// @MX:NOTE [AUTO] TDD RED — audit package manifest schema + SHA-256 (SPEC-REGULA-AUDITOR-VIEW-001).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #5)

import {
  type AuditPackageManifest,
  type ManifestFileEntry,
  buildManifest,
  computeFileSha256,
  verifyManifest,
} from '@/lib/audit-package/manifest';
import { describe, expect, it } from 'vitest';

const sampleEntry: ManifestFileEntry = {
  path: 'audit-log/2026-01.jsonl',
  size: 1024,
  sha256: 'a'.repeat(64),
};

describe('SPEC-REGULA-AUDITOR-VIEW-001 — audit package manifest (AC #5)', () => {
  describe('ManifestFileEntry shape', () => {
    it('has path, size, sha256 fields', () => {
      expect(sampleEntry.path).toBe('audit-log/2026-01.jsonl');
      expect(sampleEntry.size).toBe(1024);
      expect(sampleEntry.sha256.length).toBe(64); // SHA-256 hex
    });
  });

  describe('buildManifest', () => {
    it('produces a manifest with required top-level fields', () => {
      const now = new Date('2026-06-21T10:00:00Z');
      const manifest = buildManifest({
        generatedAt: now,
        requesterId: 'user-auditor-1',
        requesterEmail: 'inspector@fda.gov',
        dateRange: { start: '2025-06-21', end: '2026-06-21' },
        files: [sampleEntry],
      });

      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.generatedAt).toBe(now.toISOString());
      expect(manifest.requesterId).toBe('user-auditor-1');
      expect(manifest.dateRange).toEqual({ start: '2025-06-21', end: '2026-06-21' });
      expect(manifest.files).toHaveLength(1);
    });

    it('manifest is JSON-serializable (no Date objects, no Buffer)', () => {
      const now = new Date('2026-06-21T10:00:00Z');
      const manifest = buildManifest({
        generatedAt: now,
        requesterId: 'user-auditor-1',
        requesterEmail: 'inspector@fda.gov',
        dateRange: { start: '2025-06-21', end: '2026-06-21' },
        files: [sampleEntry],
      });

      const json = JSON.stringify(manifest);
      const parsed = JSON.parse(json) as AuditPackageManifest;
      expect(parsed.generatedAt).toBe(now.toISOString());
      expect(parsed.files[0]?.sha256).toBe(sampleEntry.sha256);
    });
  });

  describe('computeFileSha256', () => {
    it('computes deterministic SHA-256 hex for UTF-8 content', () => {
      const hash = computeFileSha256('hello world');
      // Known SHA-256 of "hello world"
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('produces 64-character lowercase hex', () => {
      const hash = computeFileSha256('any content');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifyManifest', () => {
    it('returns true when every file hash matches provided content map', () => {
      const content = 'hello world';
      const realHash = computeFileSha256(content);
      const manifest: AuditPackageManifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        requesterId: 'u1',
        dateRange: { start: '2025-01-01', end: '2026-01-01' },
        files: [{ path: 'a.txt', size: content.length, sha256: realHash }],
      };

      const result = verifyManifest(manifest, new Map([['a.txt', content]]));
      expect(result.valid).toBe(true);
      expect(result.mismatches).toEqual([]);
    });

    it('returns false + lists mismatched paths when a hash differs', () => {
      const content = 'tampered';
      const manifest: AuditPackageManifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        requesterId: 'u1',
        dateRange: { start: '2025-01-01', end: '2026-01-01' },
        files: [{ path: 'a.txt', size: 999, sha256: '0'.repeat(64) }],
      };

      const result = verifyManifest(manifest, new Map([['a.txt', content]]));
      expect(result.valid).toBe(false);
      expect(result.mismatches).toContain('a.txt');
    });

    it('flags missing files as mismatches', () => {
      const manifest: AuditPackageManifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        requesterId: 'u1',
        dateRange: { start: '2025-01-01', end: '2026-01-01' },
        files: [{ path: 'missing.txt', size: 10, sha256: '0'.repeat(64) }],
      };

      const result = verifyManifest(manifest, new Map());
      expect(result.valid).toBe(false);
      expect(result.mismatches).toContain('missing.txt');
    });
  });
});
