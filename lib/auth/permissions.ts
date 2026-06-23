// @MX:NOTE [AUTO] PERMISSIONS matrix — single source of truth for RBAC decisions.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-020)

import { type Role, hasRole } from './rbac';

// REQ-ENTERPRISE-020: Permission action strings.
// Each action corresponds to a specific user operation in the Regula system.
export type PermissionAction =
  | 'consult.create'
  | 'conversation.view'
  | 'conversation.delete'
  | 'expertReview.create'
  | 'dashboard.view'
  | 'dashboard.team'
  | 'expertReview.view'
  | 'expertReview.assign'
  | 'expertReview.resolve'
  | 'auditLogs.view'
  | 'profile.edit'
  | 'project.create'
  | 'project.manage'
  | 'sources.ingest'
  | 'templates.edit'
  | 'workflow.execute'
  | 'rbac.manage'
  | 'checklist.generate'
  | 'checklist.view'
  | 'checklist.update'
  | 'traceability.scan'
  | 'traceability.view'
  | 'traceability.impact'
  // Evidence API (hybrid-ra-saas integration — Issue #168)
  | 'evidence.link'
  | 'evidence.binder'
  // Authoring API (hybrid-ra-saas integration — Issue #171)
  | 'authoring.create'
  | 'authoring.view'
  | 'authoring.approve'
  // Risk management actions (SPEC-REGULA-RISK-001, Issue #46)
  | 'risk.generate'
  | 'risk.view'
  | 'risk.update'
  | 'risk.approve'
  // Electronic signature actions (SPEC-REGULA-ESIG-001, Issue #88)
  | 'signature.sign'
  // Auditor view actions (SPEC-REGULA-AUDITOR-VIEW-001, Issue #92)
  // Read-only audit log access and audit package generation.
  | 'audit.read'
  | 'audit.package.generate'
  // Personal library actions (SPEC-REGULA-PERSONAL-LIB-001, Issue #86)
  // User-scoped bookmarks/tags/notes — private to each user.
  | 'personal.view'
  // Regulatory calendar actions (SPEC-REGULA-CALENDAR-001, Issue #44)
  | 'deadline.view'
  | 'deadline.manage'
  // Knowledge gap actions (SPEC-REGULA-KNOWLEDGE-GAP-001, Issue #35)
  // RA-lead classifies and triggers replay; ra-member+ can view the queue.
  | 'knowledgegap.classify'
  | 'knowledgegap.view'
  | 'knowledgegap.replay'
  // Classification wizard actions (SPEC-REGULA-CLASSIFY-001, Issue #59)
  // generate: ra-lead only — classification drives regulatory pathway decisions.
  // view: ra-member+ — transparent across the RA team.
  | 'classify.generate'
  | 'classify.view';

export interface PermissionSpec {
  minRole: Role;
  additionalRoles?: Role[];
  scope: 'org' | 'project' | 'user' | 'none';
  resourceType: string;
}

export function roleSatisfiesPermission(userRole: Role, spec: PermissionSpec): boolean {
  return hasRole(userRole, spec.minRole) || (spec.additionalRoles?.includes(userRole) ?? false);
}

/**
 * PERMISSIONS matrix — maps every action to its minimum role, scope, and
 * resource type. withPermission reads this at runtime to enforce RBAC.
 *
 * scope values:
 *   'org'     — checked via isOrgMember(userId, organizationId)
 *   'project' — checked via isProjectMember(userId, projectId)
 *   'user'    — no membership check required (user-owned resource)
 *   'none'    — no membership check required
 */
export const PERMISSIONS: Record<PermissionAction, PermissionSpec> = {
  // @MX:ANCHOR consult.create requires global scope for routes without project ID
  // @MX:REASON Routes like /api/ra/consult, refine, workflows need org-level access (REQ-CHAT-001)
  'consult.create': { minRole: 'ra-member', scope: 'org', resourceType: 'consult' },

  // conversation actions
  'conversation.view': { minRole: 'ra-member', scope: 'org', resourceType: 'conversation' },
  'conversation.delete': { minRole: 'ra-lead', scope: 'org', resourceType: 'conversation' },

  // expertReview actions
  'expertReview.create': { minRole: 'ra-member', scope: 'org', resourceType: 'expertReview' },
  'expertReview.view': { minRole: 'ra-lead', scope: 'org', resourceType: 'expertReview' },
  'expertReview.assign': { minRole: 'ra-lead', scope: 'org', resourceType: 'expertReview' },
  'expertReview.resolve': { minRole: 'ra-lead', scope: 'org', resourceType: 'expertReview' },

  // dashboard actions
  'dashboard.view': { minRole: 'ra-member', scope: 'org', resourceType: 'dashboard' },
  'dashboard.team': { minRole: 'ra-lead', scope: 'org', resourceType: 'dashboard' },

  // profile actions (user-scoped — no membership check needed)
  'profile.edit': { minRole: 'ra-member', scope: 'user', resourceType: 'profile' },

  // project actions
  'project.create': { minRole: 'ra-lead', scope: 'org', resourceType: 'project' },
  'project.manage': { minRole: 'ra-lead', scope: 'project', resourceType: 'project' },

  // admin-only actions
  'auditLogs.view': { minRole: 'admin', scope: 'org', resourceType: 'auditLogs' },
  'sources.ingest': { minRole: 'admin', scope: 'org', resourceType: 'sources' },
  'templates.edit': { minRole: 'ra-lead', scope: 'org', resourceType: 'templates' },
  // workflow actions
  'workflow.execute': { minRole: 'ra-member', scope: 'none', resourceType: 'workflow' },

  'rbac.manage': { minRole: 'admin', scope: 'org', resourceType: 'rbac' },

  // checklist actions (hybrid-ra-saas integration — Issue #170)
  'checklist.generate': { minRole: 'ra-member', scope: 'org', resourceType: 'checklist' },
  'checklist.view': { minRole: 'ra-member', scope: 'org', resourceType: 'checklist' },
  'checklist.update': { minRole: 'ra-member', scope: 'org', resourceType: 'checklist' },

  // traceability actions (hybrid-ra-saas integration — Issue #169)
  'traceability.scan': { minRole: 'ra-member', scope: 'org', resourceType: 'traceability' },
  'traceability.view': { minRole: 'ra-member', scope: 'org', resourceType: 'traceability' },
  'traceability.impact': { minRole: 'ra-member', scope: 'org', resourceType: 'traceability' },

  // Evidence API (hybrid-ra-saas integration — Issue #168)
  'evidence.link': { minRole: 'ra-member', scope: 'org', resourceType: 'evidence' },
  'evidence.binder': { minRole: 'ra-member', scope: 'org', resourceType: 'evidence' },

  // Authoring API (hybrid-ra-saas integration — Issue #171)
  'authoring.create': { minRole: 'ra-member', scope: 'org', resourceType: 'authoring' },
  'authoring.view': { minRole: 'ra-member', scope: 'org', resourceType: 'authoring' },
  'authoring.approve': { minRole: 'ra-lead', scope: 'org', resourceType: 'authoring' },

  // @MX:ANCHOR [AUTO] risk.approve — RA-lead ONLY approval gate invariant.
  // @MX:REASON ISO 14971 legal responsibility: only qualified RA-lead may approve risk management report. Critical RBAC invariant.
  // @MX:SPEC SPEC-REGULA-RISK-001 (T0.8, REQ-RISK-034)
  // Risk management actions (SPEC-REGULA-RISK-001, Issue #46)
  'risk.generate': { minRole: 'ra-member', scope: 'org', resourceType: 'risk' },
  'risk.view': { minRole: 'ra-member', scope: 'org', resourceType: 'risk' },
  'risk.update': { minRole: 'ra-member', scope: 'org', resourceType: 'risk' },
  'risk.approve': { minRole: 'ra-lead', scope: 'org', resourceType: 'risk' },

  // @MX:ANCHOR [AUTO] signature.sign — 21 CFR Part 11 signing gate invariant.
  // @MX:REASON Only qualified roles (ra-lead, qa-lead, admin) may apply electronic signatures.
  //            Critical RBAC invariant for regulatory compliance (REQ-ESIG-006).
  // @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-006)
  'signature.sign': {
    minRole: 'ra-lead',
    additionalRoles: ['qa-lead'],
    scope: 'org',
    resourceType: 'signature',
  },

  // @MX:ANCHOR [AUTO] audit.read — auditor + admin read-only audit log access.
  // @MX:REASON External inspector persona (SPEC-REGULA-AUDITOR-VIEW-001) needs read access
  //            to audit trail. Auditor is granted via additionalRoles; admin via hierarchy.
  //            The auditor write-block in withPermission guarantees no mutation.
  // @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #1, #7)
  'audit.read': {
    minRole: 'admin',
    additionalRoles: ['auditor'],
    scope: 'org',
    resourceType: 'auditLogs',
  },

  // @MX:ANCHOR [AUTO] audit.package.generate — 1-click audit package generation.
  // @MX:REASON Auditor compiles compliance evidence into a ZIP. Read-only operation
  //            (no DB mutation), but gated so only auditor + admin can trigger it.
  // @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5, #6)
  'audit.package.generate': {
    minRole: 'admin',
    additionalRoles: ['auditor'],
    scope: 'org',
    resourceType: 'auditPackage',
  },

  // @MX:NOTE [AUTO] personal.view — user-scoped personal library (bookmarks/tags/notes).
  // @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (Issue #86)
  // Private layer — no org membership check; row-level userId isolation enforces privacy.
  'personal.view': { minRole: 'ra-member', scope: 'user', resourceType: 'personalBookmark' },

  // @MX:NOTE [AUTO] deadline.view/manage — regulatory deadline RBAC.
  // @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-004, Issue #44)
  // scope: org — projectId arrives via query/body (not route param), so project
  // membership is enforced inside each handler via isProjectMember().
  // ra-member can view; ra-lead required to manage.
  'deadline.view': { minRole: 'ra-member', scope: 'org', resourceType: 'deadline' },
  'deadline.manage': { minRole: 'ra-lead', scope: 'org', resourceType: 'deadline' },

  // @MX:NOTE [AUTO] knowledgegap.* — SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35, REQ-KNOWLEDGE-GAP-008).
  // @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001
  // view: ra-member+ can see the unanswered queue (transparency across the RA team).
  // classify + replay: ra-lead only — classification is a judgment call that drives
  // KB augmentation, and replay triggers resolution that closes GitHub issues.
  'knowledgegap.view': { minRole: 'ra-member', scope: 'org', resourceType: 'knowledgeGap' },
  'knowledgegap.classify': { minRole: 'ra-lead', scope: 'org', resourceType: 'knowledgeGap' },
  'knowledgegap.replay': { minRole: 'ra-lead', scope: 'org', resourceType: 'knowledgeGap' },

  // @MX:NOTE [AUTO] classify.* — SPEC-REGULA-CLASSIFY-001 (Issue #59).
  // @MX:SPEC SPEC-REGULA-CLASSIFY-001
  // generate: ra-lead only — multi-jurisdiction classification drives submission
  // pathway decisions (510(k)/PMA/CE etc.), so it is a judgment call.
  // view: ra-member+ — classification results are shared across the RA team.
  'classify.generate': { minRole: 'ra-lead', scope: 'org', resourceType: 'deviceClassification' },
  'classify.view': { minRole: 'ra-member', scope: 'org', resourceType: 'deviceClassification' },
};
