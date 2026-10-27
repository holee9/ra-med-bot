// RED Phase: Tests for lib/acl/document-acl.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8B-1

import { checkDocumentPermission } from '@/lib/acl/document-acl';
import { DocClass } from '@/lib/ingest/doc-class';
import { describe, expect, it } from 'vitest';

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

describe('checkDocumentPermission - ra role', () => {
  it('ra can read all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('ra', cls, null, [], 'read')).toBe(true);
    }
  });

  it('ra can write most DocClasses', () => {
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
      expect(checkDocumentPermission('ra', cls, null, [], 'write')).toBe(true);
    }
  });

  it('ra cannot admin DocClasses', () => {
    expect(checkDocumentPermission('ra', DocClass.issued_certificate, null, [], 'admin')).toBe(
      false,
    );
  });
});

describe('checkDocumentPermission - ra role', () => {
  it('ra can read issued_certificate', () => {
    expect(checkDocumentPermission('ra', DocClass.issued_certificate, null, [], 'read')).toBe(true);
  });

  it('ra can read submission_success', () => {
    expect(checkDocumentPermission('ra', DocClass.submission_success, null, [], 'read')).toBe(true);
  });

  it('ra cannot write audit_response', () => {
    expect(checkDocumentPermission('ra', DocClass.audit_response, null, [], 'write')).toBe(false);
  });

  it('ra cannot admin any DocClass', () => {
    for (const cls of Object.values(DocClass)) {
      expect(checkDocumentPermission('ra', cls, null, [], 'admin')).toBe(false);
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
