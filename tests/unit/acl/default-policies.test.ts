// RED Phase: Tests for lib/acl/default-policies.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8B-2

import { describe, expect, it } from 'vitest';
import { DocClass } from '@/lib/ingest/doc-class';
import { DEFAULT_DOCUMENT_POLICIES } from '@/lib/acl/default-policies';

describe('DEFAULT_DOCUMENT_POLICIES', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(DEFAULT_DOCUMENT_POLICIES)).toBe(true);
    expect(DEFAULT_DOCUMENT_POLICIES.length).toBeGreaterThan(0);
  });

  it('should have at least 20 policy entries (8 classes × some roles)', () => {
    expect(DEFAULT_DOCUMENT_POLICIES.length).toBeGreaterThanOrEqual(20);
  });

  it('each policy should have required fields', () => {
    for (const policy of DEFAULT_DOCUMENT_POLICIES) {
      expect(policy).toHaveProperty('docClass');
      expect(policy).toHaveProperty('role');
      expect(policy).toHaveProperty('canRead');
      expect(policy).toHaveProperty('canWrite');
      expect(typeof policy.canRead).toBe('boolean');
      expect(typeof policy.canWrite).toBe('boolean');
    }
  });

  it('should cover all DocClass values', () => {
    const coveredClasses = new Set(DEFAULT_DOCUMENT_POLICIES.map((p) => p.docClass));
    for (const cls of Object.values(DocClass)) {
      expect(coveredClasses.has(cls)).toBe(true);
    }
  });

  it('admin should have canRead and canWrite for all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      const adminPolicy = DEFAULT_DOCUMENT_POLICIES.find(
        (p) => p.docClass === cls && p.role === 'admin',
      );
      expect(adminPolicy).toBeDefined();
      expect(adminPolicy?.canRead).toBe(true);
      expect(adminPolicy?.canWrite).toBe(true);
    }
  });

  it('viewer should only have canRead for issued_certificate and submission_success', () => {
    const viewerReadable = ['issued_certificate', 'submission_success'];
    const viewerNonReadable = Object.values(DocClass).filter(
      (cls) => !viewerReadable.includes(cls),
    );

    for (const cls of viewerReadable) {
      const policy = DEFAULT_DOCUMENT_POLICIES.find(
        (p) => p.docClass === cls && p.role === 'viewer',
      );
      expect(policy?.canRead).toBe(true);
    }

    for (const cls of viewerNonReadable) {
      const policy = DEFAULT_DOCUMENT_POLICIES.find(
        (p) => p.docClass === cls && p.role === 'viewer',
      );
      if (policy) {
        expect(policy.canRead).toBe(false);
      }
    }
  });
});
