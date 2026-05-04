import { describe, it, expect } from 'vitest';
import { DocClass } from '../../../lib/ingest/doc-class';
import { docClassLabels } from '../../../lib/ingest/doc-class-labels';

describe('docClassLabels', () => {
  it('has labels for all 8 DocClass values', () => {
    const classes = Object.values(DocClass);
    expect(classes).toHaveLength(8);
    for (const cls of classes) {
      expect(docClassLabels[cls], `Missing label for ${cls}`).toBeDefined();
    }
  });

  it('each label has ko and en fields', () => {
    for (const [cls, label] of Object.entries(docClassLabels)) {
      expect(typeof label.ko, `${cls} missing ko`).toBe('string');
      expect(label.ko.length, `${cls} ko is empty`).toBeGreaterThan(0);
      expect(typeof label.en, `${cls} missing en`).toBe('string');
      expect(label.en.length, `${cls} en is empty`).toBeGreaterThan(0);
    }
  });

  it('issued_certificate has correct labels', () => {
    expect(docClassLabels[DocClass.issued_certificate]).toEqual({
      ko: '취득 인증서',
      en: 'Issued Certificate',
    });
  });

  it('clinical_report has correct labels', () => {
    expect(docClassLabels[DocClass.clinical_report]).toEqual({
      ko: '임상 보고서',
      en: 'Clinical Report',
    });
  });

  it('audit_response has correct labels', () => {
    expect(docClassLabels[DocClass.audit_response]).toEqual({
      ko: '감사 응답',
      en: 'Audit Response',
    });
  });
});
