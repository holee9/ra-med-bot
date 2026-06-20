// @MX:ANCHOR [AUTO] checkDocumentPermission — ACL enforcement for document access.
// @MX:REASON fan_in >= 3: withDocumentPermission HOF, default-policies seeder, and ACL tests all call this.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-1)

import type { Role } from '@/lib/auth/rbac';
import { DocClass } from '@/lib/ingest/doc-class';

export type DocumentAction = 'read' | 'write' | 'admin';

export interface DocumentPermission {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
}

// ACL matrix per role: which classes can be read/written/administered.
// - admin: full access to everything
// - ra-lead: read all, write all except audit_response, no admin
// - ra-member: read issued_certificate + submission_success; write none of audit_response
// - viewer: read issued_certificate + submission_success only
type AclEntry = {
  readAll: boolean;
  readClasses: DocClass[];
  writeAll: boolean;
  writeClasses: DocClass[];
  canAdmin: boolean;
};

const ACL_MATRIX: Record<Role, AclEntry> = {
  admin: {
    readAll: true,
    readClasses: [],
    writeAll: true,
    writeClasses: [],
    canAdmin: true,
  },
  'ra-lead': {
    readAll: true,
    readClasses: [],
    writeAll: false,
    writeClasses: [
      DocClass.issued_certificate,
      DocClass.submission_success,
      DocClass.submission_inprogress,
      DocClass.clinical_report,
      DocClass.checklist_template,
      DocClass.surveillance_report,
      DocClass.internal_sop,
    ],
    canAdmin: false,
  },
  'qa-lead': {
    readAll: true,
    readClasses: [],
    writeAll: false,
    writeClasses: [
      DocClass.issued_certificate,
      DocClass.submission_success,
      DocClass.submission_inprogress,
      DocClass.clinical_report,
      DocClass.checklist_template,
      DocClass.surveillance_report,
      DocClass.internal_sop,
    ],
    canAdmin: false,
  },
  'ra-member': {
    readAll: false,
    readClasses: [
      DocClass.issued_certificate,
      DocClass.submission_success,
      DocClass.submission_inprogress,
      DocClass.clinical_report,
      DocClass.checklist_template,
      DocClass.surveillance_report,
      DocClass.internal_sop,
    ],
    writeAll: false,
    writeClasses: [],
    canAdmin: false,
  },
  viewer: {
    readAll: false,
    readClasses: [DocClass.issued_certificate, DocClass.submission_success],
    writeAll: false,
    writeClasses: [],
    canAdmin: false,
  },
  // SPEC-REGULA-AUDITOR-VIEW-001: external inspector persona — read-all, write-none.
  auditor: {
    readAll: true,
    readClasses: [],
    writeAll: false,
    writeClasses: [],
    canAdmin: false,
  },
};

/**
 * Checks whether a user with the given role can perform an action on a document class.
 *
 * @param role - The user's role
 * @param docClass - The document class being accessed
 * @param projectId - The project context (null = org-wide)
 * @param userProjectIds - List of project IDs the user is assigned to
 * @param action - The action being attempted: 'read' | 'write' | 'admin'
 */
export function checkDocumentPermission(
  role: Role,
  docClass: DocClass,
  _projectId: string | null,
  _userProjectIds: string[],
  action: DocumentAction,
): boolean {
  const entry = ACL_MATRIX[role];

  if (action === 'admin') {
    return entry.canAdmin;
  }

  if (action === 'read') {
    if (entry.readAll) return true;
    return entry.readClasses.includes(docClass);
  }

  // action === 'write'
  if (entry.writeAll) return true;
  return entry.writeClasses.includes(docClass);
}
