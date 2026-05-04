import { describe, expect, it } from 'vitest';
import { DocClass } from '../../../lib/ingest/doc-class';
import { docSensitivity } from '../../../lib/ingest/doc-sensitivity';

describe('docSensitivity', () => {
  it('has sensitivity for all 8 DocClass values', () => {
    const classes = Object.values(DocClass);
    for (const cls of classes) {
      expect(docSensitivity[cls], `Missing sensitivity for ${cls}`).toBeDefined();
    }
  });

  it('clinical_report is critical_phi (REQ-DOC-004)', () => {
    expect(docSensitivity[DocClass.clinical_report]).toBe('critical_phi');
  });

  it('audit_response is critical_phi (REQ-DOC-004)', () => {
    expect(docSensitivity[DocClass.audit_response]).toBe('critical_phi');
  });

  it('issued_certificate is low', () => {
    expect(docSensitivity[DocClass.issued_certificate]).toBe('low');
  });

  it('checklist_template is low', () => {
    expect(docSensitivity[DocClass.checklist_template]).toBe('low');
  });

  it('submission_success is high', () => {
    expect(docSensitivity[DocClass.submission_success]).toBe('high');
  });

  it('submission_inprogress is high', () => {
    expect(docSensitivity[DocClass.submission_inprogress]).toBe('high');
  });

  it('surveillance_report is high', () => {
    expect(docSensitivity[DocClass.surveillance_report]).toBe('high');
  });

  it('internal_sop is medium', () => {
    expect(docSensitivity[DocClass.internal_sop]).toBe('medium');
  });

  it('only allows valid sensitivity values', () => {
    const validValues = new Set(['low', 'medium', 'high', 'critical_phi']);
    for (const [cls, value] of Object.entries(docSensitivity)) {
      expect(validValues.has(value), `${cls} has invalid sensitivity: ${value}`).toBe(true);
    }
  });
});
