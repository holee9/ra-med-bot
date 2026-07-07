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
  | 'knowledgesources.manage'
  | 'knowledgesources.view'
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
  | 'sourcegov.view'
  // SPEC-REGULA-RLHF-001 (Issue #56, REQ-RLHF-004): RLHF feedback submission.
  // ra-member+ — inline answer feedback is a team-wide activity. NOT granted
  // to viewer (feedback shapes retrieval re-ranking; needs active users).
  | 'rlhf.feedback'
  // SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50, REQ-KNOWLEDGE-PROMO-007/008).
  // promote: ra-lead/admin ONLY — promotion is a regulatory signoff decision
  //          (21 CFR Part 11 audit-material). Mirrors label.approve / capa.close.
  // view: ra-member+ — team knowledge library is transparent across the RA team.
  | 'knowledgepromo.promote'
  | 'knowledgepromo.view'
  // Project memory actions (SPEC-REGULA-PROJECT-MEMORY-001, Issue #51)
  // manage: ra-lead ONLY — memory create/update/invalidate/approve is a 21 CFR
  //   Part 11 audit-material regulatory decision (Charter [지양-4] no auto-finalize).
  //   Mirrors knowledgepromo.promote / label.approve.
  // view: ra-member+ — project context is shared across the RA team.
  | 'projectmemory.manage'
  | 'projectmemory.view'
  // Standards actions (SPEC-REGULA-STANDARDS-001, Issue #62).
  // manage: ra-lead ONLY — catalog/applicability-rule writes are audit-material.
  // read: viewer+ — broad read access because applicable-standards results are
  //   decision-support for the whole RA team (Charter [지양-4] RA Lead reviews).
  | 'standards.manage'
  | 'standards.read'
  // SPEC-V3-INBOX-001 (Issue 320, REQ-V3-INBOX-020): Inbox RBAC actions.
  // manage: ra-lead ONLY — triage (state transitions), assignment, escalation,
  //   and promotion are 21 CFR Part 11 audit-material regulatory decisions.
  //   Mirrors label.approve / capa.close / knowledgepromo.promote.
  // view: ra-member+ — Kanban board transparency across the RA team.
  | 'inbox.manage'
  | 'inbox.view'
  // SPEC-V3-INBOX-001 (Issue 320, REQ-V3-INBOX-001): ask.create permission.
  // RA employees ask regulatory questions via /api/ask. Viewer-level access
  // for Charter alignment — 전사 인허가 도우미 (mirrors consult.create pattern).
  | 'ask.create'
  // SPEC-V3-CONSULT-001 (Issue 341, REQ-CONS-001..007): RA Power Chat RBAC.
  // ra-member+: create sessions, create turns, view own sessions (Charter [지양-4]).
  // ra-lead/admin: view all org sessions, delete sessions (21 CFR Part 11 audit).
  | 'consult.session.create'
  | 'consult.session.view'
  | 'consult.session.delete'
  | 'consult.turn.create'
  // SPEC-V3-IMPACT-001 M10: Impact wizard RBAC actions.
  | 'impact.view'
  | 'impact.self_check'
  | 'impact.ra_escalate'
  // SPEC-REGULA-VALIDATION-001 (Issue #49, REQ-VAL-003~013): IQ/OQ/PQ evidence
  //   read: admin/qa-lead/ra-lead — release validation report transparency across
  //         QA + RA leads (21 CFR Part 11 §11.10(i) evidence visibility).
  //   run: admin/qa-lead — evidence COLLECTION (IQ/OQ/PQ) + change-control
  //        assessment execution. Distinct from read because collection mutates
  //        state (inserts validation_evidence / change_control rows) and is a
  //        release-gate action. plan.md line 64 requires validation:run RBAC.
  //   approve: admin ONLY — release sign-off is a regulatory approval decision
  //            (21 CFR Part 11 §11.50/11.100). Stricter than risk.approve
  //            because release sign-off closes the validation lifecycle.
  | 'validation.read'
  | 'validation.run'
  | 'validation.approve';

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
  // @MX:NOTE [AUTO] opened to viewer (2026-06-28) — 전사 인허가 도우미 정체성:
  // RA 담당자 업무 포화 분산을 위해 전사 직원(viewer)이 Q&A 셀프서비스.
  // Rate limit 30/min/user (app/api/ra/consult/route.ts)로 LLM 비용/남용 방지.
  'consult.create': { minRole: 'viewer', scope: 'org', resourceType: 'consult' },

  // conversation actions
  // @MX:NOTE [AUTO] conversation.view opened to viewer (2026-06-28) — 전사 직원이
  // 본인 Q&A 히스토리 조회 가능 (RA 분산). conversation.delete는 ra-lead 유지.
  'conversation.view': { minRole: 'viewer', scope: 'org', resourceType: 'conversation' },
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
  // Issue #307: 지식베이스 연결(git repo) 관리. ra-lead 관리, ra-member+ 조회.
  'knowledgesources.manage': { minRole: 'ra-lead', scope: 'org', resourceType: 'knowledgeSource' },
  'knowledgesources.view': { minRole: 'ra-member', scope: 'org', resourceType: 'knowledgeSource' },
  'knowledgegap.classify': { minRole: 'ra-lead', scope: 'org', resourceType: 'knowledgeGap' },
  'knowledgegap.replay': { minRole: 'ra-lead', scope: 'org', resourceType: 'knowledgeGap' },

  // @MX:NOTE [AUTO] classify.* — SPEC-REGULA-CLASSIFY-001 (Issue #59).
  // @MX:SPEC SPEC-REGULA-CLASSIFY-001
  // generate: ra-lead only — multi-jurisdiction classification drives submission
  // pathway decisions (510(k)/PMA/CE etc.), so it is a judgment call (지양-4).
  // view: ra-member+ (2026-06-29 정정) — 전사 직원(viewer) 사이드바에서 기기 분류 제외됨.
  // 일관성: 사이드바 showClassify(ra-member)와 정렬. 전사 직원은 /chat Q&A로 분류 질문.
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

  // @MX:NOTE [AUTO] rlhf.feedback — SPEC-REGULA-RLHF-001 (Issue #56, REQ-RLHF-004).
  // @MX:SPEC SPEC-REGULA-RLHF-001
  // Inline answer feedback. ra-member+ — team-wide activity that shapes
  // retrieval re-ranking. NOT granted to viewer (feedback is an active signal).
  'rlhf.feedback': { minRole: 'ra-member', scope: 'org', resourceType: 'answerFeedback' },

  // @MX:NOTE [AUTO] knowledgepromo.* — SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50).
  // @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-KNOWLEDGE-PROMO-007/008)
  // promote: ra-lead ONLY — promotion is a 21 CFR Part 11 audit-material
  //   regulatory signoff (Charter [지양-4] no auto-finalize). Mirrors
  //   label.approve / capa.close / sourcegov.manage.
  // view: ra-member+ — team knowledge library is transparent across the RA team
  //   (REQ-008 / AC-06). NOT granted to viewer (library retrieval shapes RAG).
  'knowledgepromo.promote': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'promotedAnswer',
  },
  'knowledgepromo.view': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'promotedAnswer',
  },
  // @MX:NOTE [AUTO] projectmemory.* — SPEC-REGULA-PROJECT-MEMORY-001 (Issue #51).
  // @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-006, REQ-011, REQ-014)
  // manage: ra-lead ONLY — memory create/update/invalidate/approve is a 21 CFR
  //   Part 11 audit-material regulatory signoff (Charter [지양-4] no
  //   auto-finalize). Mirrors knowledgepromo.promote / label.approve.
  // view: ra-member+ — project context is shared across the RA team so any
  //   member can see decisions and benefit from injection. NOT granted to
  //   viewer (injection shapes RAG; viewer is read-only persona).
  'projectmemory.manage': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'projectMemory',
  },
  'projectmemory.view': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'projectMemory',
  },
  // @MX:NOTE [AUTO] standards.* — SPEC-REGULA-STANDARDS-001 (Issue #62).
  // @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-022, Charter [지양-4])
  // manage: ra-lead ONLY — catalog/applicability-rule writes are audit-material
  //   regulatory signoffs. Mirrors projectmemory.manage / knowledgepromo.promote.
  // read: viewer+ — broad read access because applicable-standards results are
  //   decision-support for the whole RA team (Charter [지양-4] RA Lead reviews,
  //   but the list is transparent). Viewer can see but not act.
  'standards.manage': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'standardsCatalog',
  },
  'standards.read': {
    minRole: 'viewer',
    scope: 'org',
    resourceType: 'standardsCatalog',
  },
  // @MX:ANCHOR [AUTO] inbox.manage — RA-lead ONLY inbox management gate.
  // @MX:REASON REQ-V3-INBOX-020: triage, assignment, escalation, and promotion are
  //            21 CFR Part 11 audit-material regulatory decisions. Mirrors
  //            label.approve / capa.close / knowledgepromo.promote.
  // @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-020, Issue 320)
  'inbox.manage': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'inboxTicket',
  },
  // @MX:NOTE [AUTO] inbox.view — Kanban board transparency.
  // @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-007, Issue 320)
  // ra-member+ can view the Kanban board (triage states, SLA status).
  // Transparency across the RA team for operational visibility.
  'inbox.view': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'inboxTicket',
  },
  // @MX:NOTE [AUTO] ask.create — RA employee regulatory question submission (H-4 fix).
  // @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001, Issue 320, Charter [지양-4])
  // viewer-level access — 전사 인허가 도우미 (mirrors consult.create pattern).
  // Question submission is a CREATE activity, NOT read-only consult.
  // Rate limit 30/min/user recommended (follow-up — not implemented in this fix).
  'ask.create': {
    minRole: 'viewer',
    scope: 'org',
    resourceType: 'inboxTicket',
  },
  // @MX:NOTE [AUTO] consult.session.create — RA Power Chat session creation.
  // @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-001, Issue 341, Charter [지양-4])
  // ra-member+ — RA deep-research sessions are RA-team scoped (mirrors ask.create
  // ra-tier gating, NOT viewer-level). Power Chat is a RA specialist tool.
  'consult.session.create': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'consultSession',
  },
  // @MX:NOTE [AUTO] consult.session.view — session list + detail (with turns).
  // @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-002, REQ-CONS-003, Issue 341)
  // ra-member+: own sessions only (app-level userId filter). ra-lead/admin: all org.
  'consult.session.view': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'consultSession',
  },
  // @MX:ANCHOR [AUTO] consult.session.delete — ra-lead/admin ONLY soft-delete gate.
  // @MX:REASON REQ-CONS-006: session deletion is a 21 CFR Part 11 audit-material
  //            regulatory records decision. Mirrors inbox.manage / capa.close.
  // @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-006, Issue 341)
  'consult.session.delete': {
    minRole: 'ra-lead',
    scope: 'org',
    resourceType: 'consultSession',
  },
  // @MX:NOTE [AUTO] consult.turn.create — add a Q+A turn to a session.
  // @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-004, Issue 341)
  // ra-member+ — turn creation triggers RAG pipeline (rate-limited, M-1 follow-up).
  'consult.turn.create': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'consultTurn',
  },
  // SPEC-V3-IMPACT-001 M10: Impact wizard RBAC.
  // impact.view: ra-member+ — view impact assessments (transparency across team).
  // impact.self_check: viewer+ — self-service impact check wizard (employee role
  //   does not exist in the Role union; viewer is the lowest general role).
  // impact.ra_escalate: ra-member+ — escalate to RA team for manual review.
  // @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-11, AC-IMP-12, AC-IMP-13)
  'impact.view': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'impactAssessment',
  },
  'impact.self_check': {
    minRole: 'viewer',
    scope: 'org',
    resourceType: 'impactAssessment',
  },
  'impact.ra_escalate': {
    minRole: 'ra-member',
    scope: 'org',
    resourceType: 'impactAssessment',
  },

  // @MX:ANCHOR [AUTO] validation.read — IQ/OQ/PQ evidence + change-control read access.
  // @MX:REASON Release validation transparency for QA + RA leads (21 CFR Part 11 §11.10(i)).
  //   admin: hierarchy; qa-lead: independent QA oversight; ra-lead: release owner.
  //   viewer/ra-member must NOT see pre-release evidence (inspector-ready only).
  // @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-006, Issue #49)
  'validation.read': {
    minRole: 'ra-lead',
    additionalRoles: ['qa-lead'],
    scope: 'org',
    resourceType: 'validationEvidence',
  },

  // @MX:ANCHOR [AUTO] validation.run — IQ/OQ/PQ evidence collection + change-control exec.
  // @MX:REASON Evidence collection (collect-iq/oq/pq) and change-control assessment
  //   (classify-changes) mutate regulated state — they insert validation_evidence
  //   and change_control rows that close the validation lifecycle. plan.md line 64
  //   explicitly assigns `validation:run` RBAC to these POST handlers. admin is
  //   the minRole because release-gate evidence collection is a QA-owned activity
  //   that must not be delegated to ra-member/viewer. qa-lead is added explicitly
  //   to reflect independent QA oversight (21 CFR Part 11 §11.10(i)).
  // @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-003, REQ-VAL-004, REQ-VAL-005,
  //   REQ-VAL-006, REQ-VAL-007, Issue #49)
  'validation.run': {
    minRole: 'admin',
    additionalRoles: ['qa-lead'],
    scope: 'org',
    resourceType: 'validationEvidence',
  },

  // @MX:ANCHOR [AUTO] validation.approve — release validation sign-off (admin ONLY).
  // @MX:REASON Release sign-off closes the IQ/OQ/PQ validation lifecycle. This is
  //   a 21 CFR Part 11 §11.50/§11.100 regulatory approval record. Stricter than
  //   risk.approve because it attests the whole release is validated for use.
  // @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-013, Issue #49)
  'validation.approve': { minRole: 'admin', scope: 'org', resourceType: 'validationSignoff' },
};
