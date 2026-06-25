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
  | 'classify.view'
  // Evidence graph management actions (SPEC-REGULA-TRACEABILITY-001, Issue #47)
  // manage: ra-lead ONLY — edge writes are audit-material regulatory records
  // (21 CFR Part 11). The existing 'traceability.view' (hybrid-ra-saas #169
  // BFF proxy scope) is reused for matrix/packet/export reads.
  | 'traceability.manage'
  // Change control actions (SPEC-REGULA-CHANGE-CONTROL-001, Issue #54)
  // assess/export: ra-lead only — change assessment drives regulatory pathway
  // decisions (new submission vs. change notification) and DHF export is a
  // 21 CFR Part 11 audit-material record. Mirrors classify.generate pattern.
  // view: ra-member+ — assessment results are transparent across the RA team.
  | 'change.assess'
  | 'change.view'
  | 'change.export'
  // Labeling actions (SPEC-REGULA-LABELING-001, Issue #66)
  // create/view: ra-member+ — structured authoring is a team-wide activity.
  // approve: ra-lead ONLY — REQ-LABEL-012 RBAC gate (21 CFR Part 11 approval
  //          authority). Mirrors risk.approve / change.assess pattern.
  // export: ra-lead ONLY — REQ-LABEL-006 unsupported-claim gate is a regulatory
  //         submission decision (audit-material record). Mirrors change.export.
  | 'label.create'
  | 'label.view'
  | 'label.approve'
  | 'label.export'
  // SPEC-REGULA-CAPA-001 (Issue #68, REQ-CAPA-012): 7 CAPA RBAC actions.
  // intake/assess/create/root_cause: ra-member+ — structured intake is a team
  //   activity. Mirrors complaint intake → reportability → CAPA creation flow.
  // close: ra-lead ONLY — REQ-010 ESIG + REQ-011 vigilance gate is a regulatory
  //        approval decision (21 CFR Part 11). Mirrors label.approve.
  // effectiveness: ra-member+ — scheduling effectiveness checks is operational.
  // qms_sync: ra-lead ONLY — REQ-009 QMS sync is a system-of-record decision.
  | 'complaint.create'
  | 'complaint.assess_reportability'
  | 'capa.create'
  | 'capa.root_cause'
  | 'capa.effectiveness'
  | 'capa.close'
  | 'capa.qms_sync'
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69). 3 RBAC actions.
  //   assess: ra-lead — gap-based necessity + pathway decisions drive regulatory
  //          submission strategy (FDA IDE vs EU MDR Article 62), so they are a
  //          judgment call (mirrors classify.generate / change.assess).
  //   manage: ra-lead — IRB package draft, protocol edits, event recording, close
  //          (21 CFR Part 11 audit-material records). Mirrors capa.close.
  //   view: ra-member+ — investigation status is shared across the RA team
  //          dashboard AC-05. Mirrors capa.create / traceability.view.
  | 'clinical_investigation.assess'
  | 'clinical_investigation.manage'
  | 'clinical_investigation.view'
  // SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-014): 3 RBAC actions.
  //   manage: admin — register/rollback model config is a platform-level decision.
  //   approve: ra-lead — combination approval is a regulatory signoff (21 CFR Part 11).
  //   view: ra-lead — model-governance state is visible to RA leads for oversight.
  | 'modelgov.manage'
  | 'modelgov.approve'
  | 'modelgov.view'
  // SPEC-REGULA-CYBERDEVICE-001 (Issue 67, REQ-CYBERDEVICE-013): 2 RBAC actions.
  //   manage: ra-member+ — import SBOM, generate threat model, run CVE analysis
  //           (team activity, mirrors risk.generate / complaint.create).
  //   view: ra-member+ — cybersecurity evidence visibility shared across RA team.
  // REQ-013 is an entitlement/view gate, not a regulatory signoff — no separate
  // approve action is needed (cyber.access_denied audit covers denial).
  | 'cyberdevice.manage'
  | 'cyberdevice.view'
  // SPEC-REGULA-CORPUS-LICENSE-001 (Issue #72, REQ-CORPUSLIC-012): 2 RBAC actions.
  //   manage: admin ONLY — license/entitlement writes are 21 CFR Part 11 audit-material
  //           records (legal exposure if unauthorised). Stricter than cyberdevice.manage.
  //   view: ra-member+ — license status visible across the RA team for retrieval checks.
  | 'corpuslicense.manage'
  | 'corpuslicense.view'
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-015): 2 RBAC actions.
  //   manage: ra-lead — approve/reject of pending_review sources is a regulatory
  //          signoff decision (21 CFR Part 11 audit-material). Mirrors label.approve.
  //   view: ra-member+ — governance dashboard visible across the RA team for
  //        oversight (counts, review-due, stale-citation artifacts).
  | 'sourcegov.manage'
  | 'sourcegov.view';

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

  // @MX:ANCHOR [AUTO] traceability.manage — ra-lead ONLY edge-write gate.
  // @MX:REASON Edge writes are 21 CFR Part 11 audit-material regulatory records.
  //            Only qualified RA-lead may create/modify/delete evidence edges.
  //            IDOR defense is layered on top in the route (org_id double-gate).
  // @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-010, Issue #47)
  'traceability.manage': { minRole: 'ra-lead', scope: 'org', resourceType: 'traceability' },

  // @MX:NOTE [AUTO] change.* — SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54).
  // @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001
  // assess: ra-lead only — change assessment produces per-jurisdiction verdicts
  // (new_submission_required / change_notification / internal_record_only /
  // not_applicable) that drive regulatory pathway decisions. Mirrors
  // classify.generate pattern (REQ-CHANGE-CONTROL-003~005).
  // export: ra-lead only — DHF/change-management attachable PDF export is a
  // 21 CFR Part 11 audit-material record (REQ-CHANGE-CONTROL-007).
  // view: ra-member+ — transparency across the RA team (REQ-CHANGE-CONTROL-011).
  'change.assess': { minRole: 'ra-lead', scope: 'org', resourceType: 'changeAssessment' },
  'change.view': { minRole: 'ra-member', scope: 'org', resourceType: 'changeAssessment' },
  'change.export': { minRole: 'ra-lead', scope: 'org', resourceType: 'changeAssessment' },

  // @MX:ANCHOR [AUTO] label.approve — RA-lead ONLY approval gate invariant.
  // @MX:REASON REQ-LABEL-012: only qualified RA-lead may approve labeling documents
  //           (21 CFR Part 11 approval authority). Mirrors risk.approve.
  // @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-LABEL-012)
  // Labeling actions (SPEC-REGULA-LABELING-001, Issue #66)
  'label.create': { minRole: 'ra-member', scope: 'org', resourceType: 'labelingDocument' },
  'label.view': { minRole: 'ra-member', scope: 'org', resourceType: 'labelingDocument' },
  'label.approve': { minRole: 'ra-lead', scope: 'org', resourceType: 'labelingDocument' },
  'label.export': { minRole: 'ra-lead', scope: 'org', resourceType: 'labelingDocument' },

  // SPEC-REGULA-CAPA-001 (Issue #68, REQ-CAPA-012): CAPA RBAC actions.
  // create/assess/root_cause/effectiveness: ra-member+ (team activity).
  // close/qms_sync: ra-lead ONLY (regulatory approval, 21 CFR Part 11).
  'complaint.create': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'complaint',
  },
  'complaint.assess_reportability': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'complaint',
  },
  'capa.create': { minRole: 'ra-member', scope: 'org', resourceType: 'capaRecord' },
  'capa.root_cause': { minRole: 'ra-member', scope: 'org', resourceType: 'capaRootCause' },
  'capa.effectiveness': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'capaEffectivenessCheck',
  },
  'capa.close': { minRole: 'ra-lead', scope: 'org', resourceType: 'capaRecord' },
  'capa.qms_sync': { minRole: 'ra-lead', scope: 'org', resourceType: 'capaRecord' },

  // @MX:NOTE [AUTO] clinical_investigation.* — SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69).
  // @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001
  // assess: ra-lead only — gap-based necessity + pathway decisions drive submission
  //         strategy (FDA IDE vs EU MDR Article 62), a regulatory judgment call.
  // manage: ra-lead only — IRB package draft, protocol edits, event recording, close
  //         (21 CFR Part 11 audit-material records). Mirrors capa.close.
  // view: ra-member+ — investigation status is shared across the RA team (AC-05 dashboard).
  'clinical_investigation.assess': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'clinicalInvestigation',
  },
  'clinical_investigation.manage': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'clinicalInvestigation',
  },
  'clinical_investigation.view': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'clinicalInvestigation',
  },
  // SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-014): 3 RBAC actions.
  // manage: admin — registering/rolling back model config is a platform-level
  //   decision (mirrors sources.ingest).
  // approve: ra-lead ONLY — combination approval is a regulatory signoff
  //   (21 CFR Part 11). Mirrors label.approve / capa.close.
  // view: ra-lead — model-governance state visible to RA leads for oversight.
  'modelgov.manage': { minRole: 'admin', scope: 'org', resourceType: 'modelGovernance' },
  'modelgov.approve': { minRole: 'ra-lead', scope: 'org', resourceType: 'modelGovernance' },
  'modelgov.view': { minRole: 'ra-lead', scope: 'org', resourceType: 'modelGovernance' },

  // SPEC-REGULA-CYBERDEVICE-001 (Issue 67, REQ-CYBERDEVICE-013): 2 RBAC actions.
  // manage: ra-member+ — SBOM import, threat-model generation, CVE analysis,
  //         evidence bundle assembly (team activity). Mirrors risk.generate.
  // view: ra-member+ — cybersecurity evidence transparency across the RA team
  //       (REQ-013 entitlement gate; denial audited as cyber.access_denied).
  'cyberdevice.manage': { minRole: 'ra-member', scope: 'org', resourceType: 'cyberdevice' },
  'cyberdevice.view': { minRole: 'ra-member', scope: 'org', resourceType: 'cyberdevice' },

  // SPEC-REGULA-CORPUS-LICENSE-001 (Issue #72, REQ-CORPUSLIC-012): 2 RBAC actions.
  // manage: admin ONLY — license/entitlement writes are audit-material records
  //         with legal exposure. Stricter than cyberdevice.manage (which is a team
  //         activity). Mirrors rbac.manage / sources.ingest admin gates.
  // view: ra-member+ — retrieval gate reads license status on every search.
  'corpuslicense.manage': { minRole: 'admin', scope: 'org', resourceType: 'sourceLicense' },
  'corpuslicense.view': { minRole: 'ra-member', scope: 'org', resourceType: 'sourceLicense' },

  // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-015): 2 RBAC actions.
  // manage: ra-lead ONLY — approve/reject of pending_review sources is a regulatory
  //   signoff (21 CFR Part 11). Mirrors label.approve / capa.close.
  // view: ra-member+ — governance dashboard is shared across the RA team (AC-06).
  'sourcegov.manage': { minRole: 'ra-lead', scope: 'org', resourceType: 'source' },
  'sourcegov.view': { minRole: 'ra-member', scope: 'org', resourceType: 'source' },
};
