// @MX:ANCHOR [AUTO] DocClass — canonical 8-class document taxonomy for Phase 8 ingest.
// @MX:REASON fan_in >= 3: doc-acl, pii/policy-by-class, schema-docingest all depend on this.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-001)

/**
 * Canonical document classification for the Regula ingest system.
 * Exactly 8 classes as specified in REQ-DOC-001.
 * Order is significant — do not reorder.
 */
export enum DocClass {
  issued_certificate = 'issued_certificate',
  submission_success = 'submission_success',
  submission_inprogress = 'submission_inprogress',
  clinical_report = 'clinical_report',
  checklist_template = 'checklist_template',
  surveillance_report = 'surveillance_report',
  internal_sop = 'internal_sop',
  audit_response = 'audit_response',
}

/** Human-readable labels for each DocClass (Korean/English). */
export const DocClassLabel: Record<DocClass, string> = {
  [DocClass.issued_certificate]: '발급 인증서 (Issued Certificate)',
  [DocClass.submission_success]: '제출 완료 (Submission Success)',
  [DocClass.submission_inprogress]: '제출 진행 중 (Submission In Progress)',
  [DocClass.clinical_report]: '임상 보고서 (Clinical Report)',
  [DocClass.checklist_template]: '체크리스트 양식 (Checklist Template)',
  [DocClass.surveillance_report]: '감시 보고서 (Surveillance Report)',
  [DocClass.internal_sop]: '내부 SOP (Internal SOP)',
  [DocClass.audit_response]: '감사 응답 (Audit Response)',
};

/** PII sensitivity level per DocClass. */
export const DocClassPiiSensitivity: Record<DocClass, 'low' | 'medium' | 'high' | 'critical'> = {
  [DocClass.issued_certificate]: 'medium',
  [DocClass.submission_success]: 'high',
  [DocClass.submission_inprogress]: 'high',
  [DocClass.clinical_report]: 'critical',
  [DocClass.checklist_template]: 'low',
  [DocClass.surveillance_report]: 'high',
  [DocClass.internal_sop]: 'medium',
  [DocClass.audit_response]: 'high',
};

/** Default ACL per DocClass: role → 'read' | 'write' | 'none'. */
export const DocClassDefaultAcl: Record<
  DocClass,
  Record<'admin' | 'ra-lead' | 'ra-member' | 'viewer', 'read' | 'write' | 'none'>
> = {
  [DocClass.issued_certificate]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'read',
  },
  [DocClass.submission_success]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'read',
  },
  [DocClass.submission_inprogress]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'none',
  },
  [DocClass.clinical_report]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'none',
  },
  [DocClass.checklist_template]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'none',
  },
  [DocClass.surveillance_report]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'none',
  },
  [DocClass.internal_sop]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'read',
    viewer: 'none',
  },
  [DocClass.audit_response]: {
    admin: 'write',
    'ra-lead': 'write',
    'ra-member': 'none',
    viewer: 'none',
  },
};
