// @MX:NOTE [AUTO] T-002 TDD RED phase — PERMISSIONS matrix static validation tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-020)

import { PERMISSIONS, type PermissionAction } from '@/lib/auth/permissions';
import { describe, expect, it } from 'vitest';

// All action strings defined in SPEC REQ-ENTERPRISE-020 plus checklist, traceability,
// evidence, and authoring integrations.
const EXPECTED_ACTIONS: PermissionAction[] = [
  'consult.create',
  'conversation.view',
  'conversation.delete',
  'expertReview.create',
  'dashboard.view',
  'dashboard.team',
  'expertReview.view',
  'expertReview.assign',
  'expertReview.resolve',
  'profile.edit',
  'project.create',
  'project.manage',
  'auditLogs.view',
  'sources.ingest',
  'templates.edit',
  'rbac.manage',
  'workflow.execute',
  'checklist.generate',
  'checklist.view',
  'checklist.update',
  'traceability.scan',
  'traceability.view',
  'traceability.impact',
  'evidence.link',
  'evidence.binder',
  'authoring.create',
  'authoring.view',
  'authoring.approve',
  'risk.generate',
  'risk.view',
  'risk.update',
  'risk.approve',
  'signature.sign',
  'audit.read',
  'audit.package.generate',
  'personal.view',
  'deadline.view',
  'deadline.manage',
  'classify.generate',
  'classify.view',
  'traceability.manage',
  'knowledgegap.classify',
  'knowledgegap.view',
  'knowledgegap.replay',
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54)
  'change.assess',
  'change.view',
  'change.export',
  // SPEC-REGULA-LABELING-001 (Issue #66)
  'label.create',
  'label.view',
  'label.approve',
  'label.export',
  // SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71)
  'modelgov.manage',
  'modelgov.approve',
  'modelgov.view',
  // SPEC-REGULA-CYBERDEVICE-001 (Issue 67)
  'cyberdevice.manage',
  'cyberdevice.view',
  // SPEC-REGULA-CORPUS-LICENSE-001 (Issue #72)
  'corpuslicense.manage',
  'corpuslicense.view',
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48)
  'sourcegov.manage',
  'sourcegov.view',
  // SPEC-REGULA-RLHF-001 (Issue #56)
  'rlhf.feedback',
  // SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50)
  'knowledgepromo.promote',
  'knowledgepromo.view',
  // SPEC-REGULA-PROJECT-MEMORY-001 (Issue #51)
  'projectmemory.manage',
  'projectmemory.view',
  // SPEC-V3-IMPACT-001 M10: Impact wizard RBAC (Issue #345)
  'impact.view',
  'impact.self_check',
  'impact.ra_escalate',
];

const VALID_ROLES = ['admin', 'qa-lead', 'ra-lead', 'ra-member', 'viewer', 'auditor'] as const;
const VALID_SCOPES = ['org', 'project', 'user', 'none'] as const;

describe('lib/auth/permissions.ts (REQ-ENTERPRISE-020) — PERMISSIONS matrix', () => {
  it('PERMISSIONS contains exactly 91 entries', () => {
    expect(Object.keys(PERMISSIONS)).toHaveLength(91); // +2 validation.* (#49 SPEC-REGULA-VALIDATION-001) +3 impact.* (#345) +86 baseline
  });

  it.each(EXPECTED_ACTIONS)('PERMISSIONS contains action: %s', (action) => {
    expect(PERMISSIONS).toHaveProperty(action);
  });

  it('no duplicate action keys', () => {
    const keys = Object.keys(PERMISSIONS);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  describe('each PERMISSIONS entry has required fields', () => {
    it.each(EXPECTED_ACTIONS)('entry %s has minRole field', (action) => {
      expect(PERMISSIONS[action]).toHaveProperty('minRole');
    });

    it.each(EXPECTED_ACTIONS)('entry %s has scope field', (action) => {
      expect(PERMISSIONS[action]).toHaveProperty('scope');
    });

    it.each(EXPECTED_ACTIONS)('entry %s has resourceType field', (action) => {
      expect(PERMISSIONS[action]).toHaveProperty('resourceType');
    });

    it.each(EXPECTED_ACTIONS)('entry %s minRole is a valid role', (action) => {
      const { minRole } = PERMISSIONS[action];
      expect(VALID_ROLES).toContain(minRole);
    });

    it.each(EXPECTED_ACTIONS)('entry %s scope is a valid scope value', (action) => {
      const { scope } = PERMISSIONS[action];
      expect(VALID_SCOPES).toContain(scope);
    });

    it.each(EXPECTED_ACTIONS)('entry %s resourceType is a non-empty string', (action) => {
      const { resourceType } = PERMISSIONS[action];
      expect(typeof resourceType).toBe('string');
      expect(resourceType.length).toBeGreaterThan(0);
    });
  });

  describe('specific minRole values from SPEC', () => {
    // 2026-06-28 전사 인허가 도우미 정체성: RA 분산을 위해 consult/conversation.view/classify.view → viewer
    it('consult.create requires viewer (전사 직원 Q&A 개방, rate limit 30/min 보호)', () => {
      expect(PERMISSIONS['consult.create'].minRole).toBe('viewer');
    });

    it('conversation.view requires viewer (전사 직원 Q&A 히스토리 조회)', () => {
      expect(PERMISSIONS['conversation.view'].minRole).toBe('viewer');
    });

    it('classify.view requires ra-member (2026-06-29 정정: 사이드바 showClassify와 정렬)', () => {
      expect(PERMISSIONS['classify.view'].minRole).toBe('ra-member');
    });

    it('classify.generate requires ra-lead (지양-4: 분류 판단은 RA 담당자)', () => {
      expect(PERMISSIONS['classify.generate'].minRole).toBe('ra-lead');
    });

    it('conversation.delete requires ra-lead', () => {
      expect(PERMISSIONS['conversation.delete'].minRole).toBe('ra-lead');
    });

    it('sources.ingest requires admin', () => {
      expect(PERMISSIONS['sources.ingest'].minRole).toBe('admin');
    });

    it('auditLogs.view requires admin', () => {
      expect(PERMISSIONS['auditLogs.view'].minRole).toBe('admin');
    });

    it('rbac.manage requires admin', () => {
      expect(PERMISSIONS['rbac.manage'].minRole).toBe('admin');
    });

    it('profile.edit requires ra-member', () => {
      expect(PERMISSIONS['profile.edit'].minRole).toBe('ra-member');
    });

    it('evidence.link requires ra-member', () => {
      expect(PERMISSIONS['evidence.link'].minRole).toBe('ra-member');
    });

    it('evidence.binder requires ra-member', () => {
      expect(PERMISSIONS['evidence.binder'].minRole).toBe('ra-member');
    });

    it('authoring.approve requires ra-lead', () => {
      expect(PERMISSIONS['authoring.approve'].minRole).toBe('ra-lead');
    });
  });

  describe('specific scope values from SPEC', () => {
    it('profile.edit is user-scoped', () => {
      expect(PERMISSIONS['profile.edit'].scope).toBe('user');
    });

    it('project.manage is project-scoped', () => {
      expect(PERMISSIONS['project.manage'].scope).toBe('project');
    });

    it('rbac.manage is org-scoped', () => {
      expect(PERMISSIONS['rbac.manage'].scope).toBe('org');
    });
  });
});
