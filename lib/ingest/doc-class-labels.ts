// @MX:NOTE [AUTO] Bilingual labels for DocClass values — Korean and English display names.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-003)
import { DocClass } from './doc-class';

/** Bilingual display labels for each DocClass. */
export const docClassLabels: Record<DocClass, { ko: string; en: string }> = {
  [DocClass.issued_certificate]: { ko: '취득 인증서', en: 'Issued Certificate' },
  [DocClass.submission_success]: { ko: '승인 제출', en: 'Submission Success' },
  [DocClass.submission_inprogress]: { ko: '심사 중 제출', en: 'Submission In Progress' },
  [DocClass.clinical_report]: { ko: '임상 보고서', en: 'Clinical Report' },
  [DocClass.checklist_template]: { ko: '체크리스트 양식', en: 'Checklist Template' },
  [DocClass.surveillance_report]: { ko: '시판 후 감시 보고서', en: 'Surveillance Report' },
  [DocClass.internal_sop]: { ko: '내부 SOP', en: 'Internal SOP' },
  [DocClass.audit_response]: { ko: '감사 응답', en: 'Audit Response' },
};
