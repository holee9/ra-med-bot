// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-2)

import type { Role } from '@/lib/auth/rbac';
import { DocClass } from '@/lib/ingest/doc-class';

export interface DefaultPolicy {
  docClass: DocClass;
  role: Role;
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
}

/**
 * Default document access policies: 8 DocClasses × 4 roles = 32 entries.
 * Seed data for the document_access_policies table.
 *
 * Policy matrix:
 *   admin:     all classes — read + write + admin
 *   ra-lead:   all classes — read + write (except audit_response write = false)
 *   ra-member: issued_certificate + submission_success — read only
 *              all others — none
 *   viewer:    issued_certificate + submission_success — read only
 */
export const DEFAULT_DOCUMENT_POLICIES: DefaultPolicy[] = [
  // ---- admin: full access to all 8 classes ----
  ...Object.values(DocClass).map((cls) => ({
    docClass: cls,
    role: 'admin' as Role,
    canRead: true,
    canWrite: true,
    canAdmin: true,
  })),

  // ---- ra-lead: read all, write most (not audit_response), no admin ----
  ...Object.values(DocClass).map((cls) => ({
    docClass: cls,
    role: 'ra-lead' as Role,
    canRead: true,
    canWrite: cls !== DocClass.audit_response,
    canAdmin: false,
  })),

  // ---- ra-member: read selected, no write, no admin ----
  ...Object.values(DocClass).map((cls) => ({
    docClass: cls,
    role: 'ra-member' as Role,
    canRead: [DocClass.issued_certificate, DocClass.submission_success].includes(cls),
    canWrite: false,
    canAdmin: false,
  })),

  // ---- viewer: read selected only ----
  ...Object.values(DocClass).map((cls) => ({
    docClass: cls,
    role: 'viewer' as Role,
    canRead: [DocClass.issued_certificate, DocClass.submission_success].includes(cls),
    canWrite: false,
    canAdmin: false,
  })),
];
