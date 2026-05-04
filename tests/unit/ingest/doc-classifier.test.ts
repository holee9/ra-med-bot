import { describe, expect, it } from 'vitest';
import { DocClass } from '../../../lib/ingest/doc-class';
import { classifyDocument } from '../../../lib/ingest/doc-classifier';

describe('classifyDocument', () => {
  it('returns suggestedClass and confidence', () => {
    const result = classifyDocument({ filename: 'unknown.pdf' });
    expect(result).toHaveProperty('suggestedClass');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.confidence).toBe('number');
  });

  it('filename with 510k → submission_success with confidence >= 0.8', () => {
    const result = classifyDocument({ filename: 'device-510k-clearance.pdf' });
    expect(result.suggestedClass).toBe(DocClass.submission_success);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('filename with K12 → submission_success', () => {
    const result = classifyDocument({ filename: 'K123456_summary.pdf' });
    expect(result.suggestedClass).toBe(DocClass.submission_success);
  });

  it('filename with SOP → internal_sop with confidence >= 0.8', () => {
    const result = classifyDocument({ filename: 'SOP-QM-001-procedure.pdf' });
    expect(result.suggestedClass).toBe(DocClass.internal_sop);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('filename with certificate → issued_certificate', () => {
    const result = classifyDocument({ filename: 'ISO13485-certificate.pdf' });
    expect(result.suggestedClass).toBe(DocClass.issued_certificate);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('filename with CE → issued_certificate', () => {
    const result = classifyDocument({ filename: 'CE-marking-cert.pdf' });
    expect(result.suggestedClass).toBe(DocClass.issued_certificate);
  });

  it('filename with CER → clinical_report', () => {
    const result = classifyDocument({ filename: 'CER-device-2024.pdf' });
    expect(result.suggestedClass).toBe(DocClass.clinical_report);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('filename with PSUR → surveillance_report', () => {
    const result = classifyDocument({ filename: 'PSUR-annual-2024.pdf' });
    expect(result.suggestedClass).toBe(DocClass.surveillance_report);
  });

  it('filename with PMS → surveillance_report', () => {
    const result = classifyDocument({ filename: 'PMS-report-2024.pdf' });
    expect(result.suggestedClass).toBe(DocClass.surveillance_report);
  });

  it('filename with checklist → checklist_template', () => {
    const result = classifyDocument({ filename: 'design-checklist-template.docx' });
    expect(result.suggestedClass).toBe(DocClass.checklist_template);
  });

  it('filename with 483 → audit_response', () => {
    const result = classifyDocument({ filename: 'FDA-483-response.pdf' });
    expect(result.suggestedClass).toBe(DocClass.audit_response);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('filename with CAPA → audit_response', () => {
    const result = classifyDocument({ filename: 'CAPA-plan-2024.pdf' });
    expect(result.suggestedClass).toBe(DocClass.audit_response);
  });

  it('unknown filename → internal_sop with low confidence (0.3)', () => {
    const result = classifyDocument({ filename: 'document-2024.pdf' });
    expect(result.suggestedClass).toBe(DocClass.internal_sop);
    expect(result.confidence).toBe(0.3);
  });

  it('firstPageText can boost confidence', () => {
    const result = classifyDocument({
      filename: 'document.pdf',
      firstPageText: 'This is a 510(k) premarket notification submission',
    });
    expect(result.suggestedClass).toBe(DocClass.submission_success);
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('confidence is between 0 and 1', () => {
    const cases = [
      'unknown.pdf',
      'SOP-001.pdf',
      'K123456.pdf',
      'certificate.pdf',
      'CER-device.pdf',
    ];
    for (const filename of cases) {
      const result = classifyDocument({ filename });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
