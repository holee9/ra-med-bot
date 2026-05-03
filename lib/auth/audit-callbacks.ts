// @MX:NOTE [AUTO] Auth callback audit event builders.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-029)
//
// Pure functions that construct AuditEvent objects for auth.login and auth.logout.
// Extracted for testability — the Auth.js callbacks in lib/auth.ts call these
// helpers and pass the result to writeAudit().

import type { AuditEvent } from '../audit';

/**
 * Build an AuditEvent for a user sign-in.
 *
 * @param userId - Auth.js user.id (may be null if provider did not return an id)
 * @param provider - OAuth provider identifier (e.g. 'google', 'microsoft-entra-id')
 */
export function buildLoginAuditEvent(
  userId: string | null | undefined,
  provider: string | undefined,
): AuditEvent {
  const actorId = userId ?? null;
  return {
    action: 'auth.login',
    actor_id: actorId,
    resource_type: 'session',
    resource_id: actorId ?? '',
    meta_json: { provider },
  };
}

/**
 * Build an AuditEvent for a user sign-out.
 *
 * @param userId - The user id from the session (may be null)
 * @param sessionToken - The session token being invalidated
 */
export function buildLogoutAuditEvent(
  userId: string | null | undefined,
  sessionToken: string | undefined,
): AuditEvent {
  return {
    action: 'auth.logout',
    actor_id: userId ?? null,
    resource_type: 'session',
    resource_id: sessionToken ?? '',
    meta_json: {},
  };
}
