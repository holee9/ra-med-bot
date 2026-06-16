// @MX:NOTE [AUTO] PERMISSIONS matrix — single source of truth for RBAC decisions.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-020)

import type { Role } from './rbac';

// REQ-ENTERPRISE-020: All 15 permission action strings.
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
  | 'rbac.manage';

export interface PermissionSpec {
  minRole: Role;
  scope: 'org' | 'project' | 'user' | 'none';
  resourceType: string;
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
  // @MX:ANCHOR consult.create requires project membership verification
  // @MX:REASON OWASP A01:2021 — prevents unauthorized consult creation (REQ-CHAT-001)
  'consult.create': { minRole: 'ra-member', scope: 'project', resourceType: 'consult' },

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
};
