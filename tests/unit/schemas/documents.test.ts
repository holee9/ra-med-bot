import { describe, expect, it } from 'vitest';
import { DocClass } from '../../../lib/ingest/doc-class';
import {
  AuditResponseMetaSchema,
  ChecklistTemplateMetaSchema,
  ClinicalReportMetaSchema,
  InternalSopMetaSchema,
  IssuedCertificateMetaSchema,
  SubmissionInprogressMetaSchema,
  SubmissionSuccessMetaSchema,
  SurveillanceReportMetaSchema,
  docClassMetaSchemas,
} from '../../../lib/kernel/schemas/documents';

describe('IssuedCertificateMetaSchema', () => {
  it('validates valid data', () => {
    const result = IssuedCertificateMetaSchema.safeParse({
      deviceName: 'VitalMonitor Pro',
      fdaKNumber: 'K241234',
      productCode: 'DXN',
      regulatoryClass: 'II',
      decisionDate: '2024-03-15',
    });
    expect(result.success).toBe(true);
  });

  it('requires deviceName', () => {
    const result = IssuedCertificateMetaSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('regulatoryClass accepts I, II, III only', () => {
    expect(
      IssuedCertificateMetaSchema.safeParse({ deviceName: 'X', regulatoryClass: 'IV' }).success,
    ).toBe(false);
    expect(
      IssuedCertificateMetaSchema.safeParse({ deviceName: 'X', regulatoryClass: 'II' }).success,
    ).toBe(true);
  });
});

describe('SubmissionSuccessMetaSchema', () => {
  it('validates valid data', () => {
    const result = SubmissionSuccessMetaSchema.safeParse({
      submissionNumber: 'K241234',
      targetAgency: 'FDA',
      approvalDate: '2024-03-15',
    });
    expect(result.success).toBe(true);
  });

  it('requires submissionNumber and targetAgency', () => {
    const result = SubmissionSuccessMetaSchema.safeParse({ targetAgency: 'FDA' });
    expect(result.success).toBe(false);
  });
});

describe('SubmissionInprogressMetaSchema', () => {
  it('validates valid data', () => {
    const result = SubmissionInprogressMetaSchema.safeParse({
      submissionNumber: 'EU-MDR-2024-001',
      targetAgency: 'EU Notified Body',
      submittedAt: '2024-01-15',
    });
    expect(result.success).toBe(true);
  });

  it('requires all three fields', () => {
    const result = SubmissionInprogressMetaSchema.safeParse({
      submissionNumber: 'EU-MDR-2024-001',
      targetAgency: 'EU NB',
    });
    expect(result.success).toBe(false);
  });
});

describe('ClinicalReportMetaSchema', () => {
  it('validates valid data', () => {
    const result = ClinicalReportMetaSchema.safeParse({
      studyType: 'Randomized Controlled Trial',
      subjects: 150,
      reportDate: '2024-06-01',
    });
    expect(result.success).toBe(true);
  });

  it('requires studyType', () => {
    const result = ClinicalReportMetaSchema.safeParse({ subjects: 100 });
    expect(result.success).toBe(false);
  });
});

describe('ChecklistTemplateMetaSchema', () => {
  it('validates valid data', () => {
    const result = ChecklistTemplateMetaSchema.safeParse({
      templateVersion: '2.0',
      regulatoryFramework: 'ISO 13485',
    });
    expect(result.success).toBe(true);
  });

  it('requires both fields', () => {
    expect(ChecklistTemplateMetaSchema.safeParse({ templateVersion: '1.0' }).success).toBe(false);
  });
});

describe('SurveillanceReportMetaSchema', () => {
  it('validates valid data', () => {
    const result = SurveillanceReportMetaSchema.safeParse({
      reportingPeriod: '2024-Q1',
      deviceModel: 'VM-Pro-100',
    });
    expect(result.success).toBe(true);
  });

  it('requires reportingPeriod', () => {
    const result = SurveillanceReportMetaSchema.safeParse({ deviceModel: 'VM-Pro' });
    expect(result.success).toBe(false);
  });
});

describe('InternalSopMetaSchema', () => {
  it('validates valid data', () => {
    const result = InternalSopMetaSchema.safeParse({
      sopNumber: 'QM-003',
      revision: 'Rev. C',
      effectiveDate: '2024-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('requires sopNumber and revision', () => {
    const result = InternalSopMetaSchema.safeParse({ sopNumber: 'QM-001' });
    expect(result.success).toBe(false);
  });
});

describe('AuditResponseMetaSchema', () => {
  it('validates valid data', () => {
    const result = AuditResponseMetaSchema.safeParse({
      observationCount: 3,
      respondedAt: '2024-02-15',
    });
    expect(result.success).toBe(true);
  });

  it('requires observationCount as number', () => {
    const result = AuditResponseMetaSchema.safeParse({ observationCount: 'three' });
    expect(result.success).toBe(false);
  });
});

describe('docClassMetaSchemas registry', () => {
  it('has a schema for all 8 DocClass values', () => {
    const classes = Object.values(DocClass);
    expect(classes).toHaveLength(8);
    for (const cls of classes) {
      expect(docClassMetaSchemas[cls], `Missing schema for ${cls}`).toBeDefined();
    }
  });

  it('each schema is a Zod schema with safeParse method', () => {
    for (const [cls, schema] of Object.entries(docClassMetaSchemas)) {
      expect(typeof schema.safeParse, `${cls} schema missing safeParse`).toBe('function');
    }
  });
});
