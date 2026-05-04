// @MX:ANCHOR [AUTO] Document metadata Zod schemas — 8 class-specific schemas + registry.
// @MX:REASON fan_in >= 3: upload form, document detail page, and ingest pipeline all validate with these.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-078)
import { z } from 'zod';
import { DocClass } from '../ingest/doc-class';

/** Metadata schema for issued_certificate class documents. */
export const IssuedCertificateMetaSchema = z.object({
  fdaKNumber: z.string().optional(),
  deviceName: z.string(),
  decisionDate: z.string().optional(),
  productCode: z.string().optional(),
  regulatoryClass: z.enum(['I', 'II', 'III']).optional(),
});

/** Metadata schema for submission_success class documents. */
export const SubmissionSuccessMetaSchema = z.object({
  submissionNumber: z.string(),
  targetAgency: z.string(),
  approvalDate: z.string().optional(),
});

/** Metadata schema for submission_inprogress class documents. */
export const SubmissionInprogressMetaSchema = z.object({
  submissionNumber: z.string(),
  targetAgency: z.string(),
  submittedAt: z.string(),
});

/** Metadata schema for clinical_report class documents. */
export const ClinicalReportMetaSchema = z.object({
  studyType: z.string(),
  subjects: z.number().optional(),
  reportDate: z.string().optional(),
});

/** Metadata schema for checklist_template class documents. */
export const ChecklistTemplateMetaSchema = z.object({
  templateVersion: z.string(),
  regulatoryFramework: z.string(),
});

/** Metadata schema for surveillance_report class documents. */
export const SurveillanceReportMetaSchema = z.object({
  reportingPeriod: z.string(),
  deviceModel: z.string().optional(),
});

/** Metadata schema for internal_sop class documents. */
export const InternalSopMetaSchema = z.object({
  sopNumber: z.string(),
  revision: z.string(),
  effectiveDate: z.string().optional(),
});

/** Metadata schema for audit_response class documents. */
export const AuditResponseMetaSchema = z.object({
  observationCount: z.number(),
  respondedAt: z.string(),
});

/** Registry mapping each DocClass to its metadata validation schema. */
export const docClassMetaSchemas: Record<DocClass, z.ZodSchema> = {
  [DocClass.issued_certificate]: IssuedCertificateMetaSchema,
  [DocClass.submission_success]: SubmissionSuccessMetaSchema,
  [DocClass.submission_inprogress]: SubmissionInprogressMetaSchema,
  [DocClass.clinical_report]: ClinicalReportMetaSchema,
  [DocClass.checklist_template]: ChecklistTemplateMetaSchema,
  [DocClass.surveillance_report]: SurveillanceReportMetaSchema,
  [DocClass.internal_sop]: InternalSopMetaSchema,
  [DocClass.audit_response]: AuditResponseMetaSchema,
};

// Inferred TypeScript types for each schema
export type IssuedCertificateMeta = z.infer<typeof IssuedCertificateMetaSchema>;
export type SubmissionSuccessMeta = z.infer<typeof SubmissionSuccessMetaSchema>;
export type SubmissionInprogressMeta = z.infer<typeof SubmissionInprogressMetaSchema>;
export type ClinicalReportMeta = z.infer<typeof ClinicalReportMetaSchema>;
export type ChecklistTemplateMeta = z.infer<typeof ChecklistTemplateMetaSchema>;
export type SurveillanceReportMeta = z.infer<typeof SurveillanceReportMetaSchema>;
export type InternalSopMeta = z.infer<typeof InternalSopMetaSchema>;
export type AuditResponseMeta = z.infer<typeof AuditResponseMetaSchema>;
