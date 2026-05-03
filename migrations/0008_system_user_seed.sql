-- @MX:NOTE [AUTO] Phase 5 Enterprise Hardening — SYSTEM_USER_UUID seed.
-- @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-009)
--
-- Inserts the fixed system user UUID used for system-initiated audit events.
-- The UUID 00000000-0000-0000-0000-000000000001 is a reserved sentinel value.
-- ON CONFLICT DO NOTHING ensures this migration is idempotent.
--
-- This user is NEVER used for human login. It is the actor_id for:
--   - System-generated expert review flags (consult.expert_review_auto_flag)
--   - Any audit event where no human actor can be attributed
--
-- Role is 'admin' so RBAC guards do not block system operations.
-- Email domain 'regula.internal' is reserved and cannot be used for SSO login.

INSERT INTO users (id, email, name, role, locale, theme_pref, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@regula.internal',
  'System',
  'admin',
  'ko',
  'system',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Rollback (Phase 6 down script placeholder):
-- DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001';
