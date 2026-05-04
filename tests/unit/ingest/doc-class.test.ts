// RED Phase: Tests for lib/ingest/doc-class.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-001

import { describe, expect, it } from 'vitest';

// These imports will fail until the implementation is written (RED state expected)
import {
  DocClass,
  DocClassDefaultAcl,
  DocClassLabel,
  DocClassPiiSensitivity,
} from '@/lib/ingest/doc-class';

describe('DocClass enum', () => {
  it('should have exactly 8 values', () => {
    expect(Object.keys(DocClass).length).toBe(8);
  });

  it('should contain all required enum values in correct order', () => {
    const expectedValues = [
      'issued_certificate',
      'submission_success',
      'submission_inprogress',
      'clinical_report',
      'checklist_template',
      'surveillance_report',
      'internal_sop',
      'audit_response',
    ];
    const actualValues = Object.values(DocClass);
    expect(actualValues).toEqual(expectedValues);
  });

  it('should have matching keys and values', () => {
    for (const key of Object.keys(DocClass)) {
      expect(DocClass[key as keyof typeof DocClass]).toBe(key);
    }
  });
});

describe('DocClassLabel', () => {
  it('should have a label for every DocClass value', () => {
    for (const cls of Object.values(DocClass)) {
      expect(DocClassLabel[cls]).toBeDefined();
      expect(typeof DocClassLabel[cls]).toBe('string');
      expect(DocClassLabel[cls].length).toBeGreaterThan(0);
    }
  });
});

describe('DocClassPiiSensitivity', () => {
  it('should have a sensitivity for every DocClass value', () => {
    const validSensitivities = ['low', 'medium', 'high', 'critical'];
    for (const cls of Object.values(DocClass)) {
      expect(DocClassPiiSensitivity[cls]).toBeDefined();
      expect(validSensitivities).toContain(DocClassPiiSensitivity[cls]);
    }
  });

  it('clinical_report should be critical sensitivity', () => {
    expect(DocClassPiiSensitivity[DocClass.clinical_report]).toBe('critical');
  });

  it('checklist_template should be low sensitivity', () => {
    expect(DocClassPiiSensitivity[DocClass.checklist_template]).toBe('low');
  });

  it('issued_certificate should be medium sensitivity', () => {
    expect(DocClassPiiSensitivity[DocClass.issued_certificate]).toBe('medium');
  });
});

describe('DocClassDefaultAcl', () => {
  it('should have a default ACL for every DocClass value', () => {
    const validPermissions = ['read', 'write', 'none'];
    for (const cls of Object.values(DocClass)) {
      expect(DocClassDefaultAcl[cls]).toBeDefined();
      const acl = DocClassDefaultAcl[cls];
      // ACL should have role-permission mappings
      expect(typeof acl).toBe('object');
      for (const perm of Object.values(acl)) {
        expect(validPermissions).toContain(perm);
      }
    }
  });

  it('should define ACL for admin, ra-lead, ra-member, and viewer roles', () => {
    const requiredRoles = ['admin', 'ra-lead', 'ra-member', 'viewer'];
    for (const cls of Object.values(DocClass)) {
      const acl = DocClassDefaultAcl[cls];
      for (const role of requiredRoles) {
        expect(acl[role as keyof typeof acl]).toBeDefined();
      }
    }
  });

  it('admin should have write access to all DocClasses', () => {
    for (const cls of Object.values(DocClass)) {
      expect(DocClassDefaultAcl[cls].admin).toBe('write');
    }
  });
});
