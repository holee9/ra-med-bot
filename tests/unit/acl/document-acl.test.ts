// RED Phase: Tests for lib/acl/document-acl.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8B-1

import { describe, expect, it } from 'vitest';
import { DocClass } from '@/lib/ingest/doc-class';
import { checkDocumentPermission } from '@/lib/acl/document-acl';

describe('checkDocumentPermission - admin role', () => {
  it('admin can read all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('admin', cls, null, [], 'read')).toBe(true);
    }
  });

  it('admin can write all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('admin', cls, null, [], 'write')).toBe(true);
    }
  });

  it('admin can admin all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('admin', cls, null, [], 'admin')).toBe(true);
    }
  });
});

describe('checkDocumentPermission - ra-lead role', () => {
  it('ra-lead can read all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('ra-lead', cls, null, [], 'read')).toBe(true);
    }
  });

  it('ra-lead can write most DocClasses', () => {
    const writableClasses = [
      DocClass.issued_certificate,
      DocClass.submission_success,
      DocClass.submission_inprogress,
      DocClass.clinical_report,
      DocClass.checklist_template,
      DocClass.surveillance_report,
      DocClass.internal_sop,
    ];
    for (const cls of writableClasses) {
      expect(checkDocumentPermission('ra-lead', cls, null, [], 'write')).toBe(true);
    }
  });

  it('ra-lead cannot admin DocClasses', () => {
    expect(
      checkDocumentPermission('ra-lead', DocClass.issued_certificate, null, [], 'admin'),
    ).toBe(false);
  });
});

describe('checkDocumentPermission - ra-member role', () => {
  it('ra-member can read issued_certificate', () => {
    expect(checkDocumentPermission('ra-member', DocClass.issued_certificate, null, [], 'read')).toBe(
      true,
    );
  });

  it('ra-member can read submission_success', () => {
    expect(checkDocumentPermission('ra-member', DocClass.submission_success, null, [], 'read')).toBe(
      true,
    );
  });

  it('ra-member cannot write audit_response', () => {
    expect(checkDocumentPermission('ra-member', DocClass.audit_response, null, [], 'write')).toBe(
      false,
    );
  });

  it('ra-member cannot admin any DocClass', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('ra-member', cls, null, [], 'admin')).toBe(false);
    }
  });
});

describe('checkDocumentPermission - viewer role', () => {
  it('viewer can read issued_certificate', () => {
    expect(checkDocumentPermission('viewer', DocClass.issued_certificate, null, [], 'read')).toBe(
      true,
    );
  });

  it('viewer can read submission_success', () => {
    expect(checkDocumentPermission('viewer', DocClass.submission_success, null, [], 'read')).toBe(
      true,
    );
  });

  it('viewer cannot read clinical_report', () => {
    expect(checkDocumentPermission('viewer', DocClass.clinical_report, null, [], 'read')).toBe(
      false,
    );
  });

  it('viewer cannot write any DocClass', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('viewer', cls, null, [], 'write')).toBe(false);
    }
  });

  it('viewer cannot admin any DocClass', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('viewer', cls, null, [], 'admin')).toBe(false);
    }
  });
});
