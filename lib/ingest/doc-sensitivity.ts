// @MX:NOTE [AUTO] PII sensitivity level per DocClass — determines redaction pipeline depth.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-004)
// critical_phi = PHI (Protected Health Information) requiring all 3 redaction layers
import { DocClass } from './doc-class';

export type SensitivityLevel = 'low' | 'medium' | 'high' | 'critical_phi';

/** PII sensitivity level for each DocClass.
 * critical_phi triggers all 3 redaction layers (regex + Workers AI + Presidio). */
export const docSensitivity: Record<DocClass, SensitivityLevel> = {
  [DocClass.issued_certificate]: 'low',
  [DocClass.submission_success]: 'high',
  [DocClass.submission_inprogress]: 'high',
  [DocClass.clinical_report]: 'critical_phi',
  [DocClass.checklist_template]: 'low',
  [DocClass.surveillance_report]: 'high',
  [DocClass.internal_sop]: 'medium',
  [DocClass.audit_response]: 'critical_phi',
};
