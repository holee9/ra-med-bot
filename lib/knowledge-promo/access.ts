// @MX:NOTE [AUTO] IDOR guard for knowledge-promo routes.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (AC-01, AC-03, 21 CFR Part 11)
// @MX:REASON RLS is INERT project-wide (#239 debt), so org isolation MUST be
//           enforced at the query layer. withPermission('knowledgepromo.*')
//           proves the caller is a member of their OWN org — it does not bind
//           the request body messageId to that org. Without this guard, an
//           org-A user could promote/search org-B messages (cross-tenant
//           corruption of the team knowledge library). Mirrors the RLHF
//           assertMessageInOrg pattern (lib/rlhf/access.ts, C-1/C-2 hardening).
//
// AC-03 (M-2 fix, 2026-06-26): cross-org (IDOR) 403 denials MUST be audit
// logged. withPermission logs `rbac.permission_deny` for RBAC role failures,
// but the IDOR 403 below is a SEPARATE gate — if it returns 403 WITHOUT
// writing audit, a ra-lead attempting cross-org promote leaves no trail
// (21 CFR Part 11 violation). The assert functions below now write the denial
// audit row before returning 403, matching the withPermission denial pattern.
//
// RLS intentionally not applied in resolve* helpers below (project-wide inert,
// #239); the JS orgId comparison in assert*InOrg is the authoritative gate.
// Wrapping these reads in withTenantScope would be defense-in-depth but adds
// no real protection while RLS is inert and would imply a guarantee that does
// not hold. When #239 is resolved (RLS FORCE ON), revisit these reads to rely
// on the DB-level gate.

import { writeAudit } from '@/lib/kernel/audit';
import { db } from '@/lib/kernel/db/client';
import { conversations, messages, projects, promotedAnswers } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Resolve the organizationId that owns `messageId` via the canonical 3-hop
 * join messages -> conversations -> projects. Returns null when the message
 * does not exist or the conversation has no project.
 */
export async function resolveMessageOrg(messageId: string): Promise<string | null> {
  const [row] = await db
    .select({ orgId: projects.organizationId })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(projects, eq(projects.id, conversations.projectId))
    .where(eq(messages.id, messageId))
    .limit(1);
  return row?.orgId ?? null;
}

/**
 * IDOR guard: verify `messageId` belongs to `organizationId`.
 * Returns true when the message exists AND its project's org matches.
 */
export async function messageBelongsToOrg(
  messageId: string,
  organizationId: string,
): Promise<boolean> {
  const orgId = await resolveMessageOrg(messageId);
  return orgId !== null && orgId === organizationId;
}

/**
 * Resolve the organizationId that owns a promoted_answers row by its id.
 * Returns null when the promoted answer does not exist.
 */
export async function resolvePromotedAnswerOrg(promotedId: string): Promise<string | null> {
  const [row] = await db
    .select({ orgId: promotedAnswers.orgId })
    .from(promotedAnswers)
    .where(eq(promotedAnswers.id, promotedId))
    .limit(1);
  return row?.orgId ?? null;
}

/**
 * Parameters for the IDOR assert helpers. The audit row attributes the denial
 * to `actorId` (the caller's session user id) so a ra-lead attempting a
 * cross-org promote/unpromote leaves an inspectable trail (AC-03).
 */
export interface AssertAccessParams {
  /** Caller's session user id (audit actor). */
  actorId: string;
  /** Caller's org id (the org the caller belongs to). */
  organizationId: string;
  /** RBAC action being guarded, e.g. 'knowledgepromo.promote'. */
  action: string;
}

/**
 * Audit a cross-org (IDOR) denial. Best-effort: if the audit write itself
 * fails we still return 403 (fail-closed on access) but log so the regulated
 * workflow can detect audit-log outages. 21 CFR Part 11: the denial MUST be
 * recorded even when the access check fails.
 */
async function auditIdorDenial(
  params: AssertAccessParams,
  reason: string,
  resourceId: string,
): Promise<void> {
  try {
    await writeAudit({
      actor_id: params.actorId,
      action: 'rbac.permission_deny',
      resource_type: 'knowledgepromo',
      resource_id: resourceId,
      meta_json: {
        required: params.action,
        reason,
        orgId: params.organizationId,
      },
    });
  } catch {
    // Do NOT swallow silently — surface to server logs. Access still denied.
    // Regulatory note: if audit write fails, the request still fails closed
    // (403 returned) so no unauthorized access occurs; only the trail is
    // incomplete, which Sentry/observability should catch.
  }
}

/**
 * Assert form: returns a 403 Response when the message does not belong to the
 * caller's org, or null when access is granted. AC-03: writes a
 * `rbac.permission_deny` audit row on denial before returning 403.
 */
export async function assertMessageInOrg(
  messageId: string,
  params: AssertAccessParams,
): Promise<Response | null> {
  const allowed = await messageBelongsToOrg(messageId, params.organizationId);
  if (allowed) return null;
  await auditIdorDenial(params, 'message_not_in_org', messageId);
  return Response.json({ error: 'message_not_in_org' }, { status: 403 });
}

/**
 * Assert form: returns a 403 Response when the promoted answer does not belong
 * to the caller's org, or null when access is granted. Used by unpromote.
 * AC-03: writes a `rbac.permission_deny` audit row on denial before 403.
 */
export async function assertPromotedAnswerInOrg(
  promotedId: string,
  params: AssertAccessParams,
): Promise<Response | null> {
  const orgId = await resolvePromotedAnswerOrg(promotedId);
  if (orgId !== null && orgId === params.organizationId) return null;
  await auditIdorDenial(params, 'promoted_answer_not_in_org', promotedId);
  return Response.json({ error: 'promoted_answer_not_in_org' }, { status: 403 });
}

/**
 * Check if a message has already been promoted in the caller's org.
 * Returns the existing promoted row id (for re-activation) or null.
 */
export async function findExistingPromotion(
  messageId: string,
  orgId: string,
): Promise<{ id: string; status: 'active' | 'unpromoted' } | null> {
  const [row] = await db
    .select({ id: promotedAnswers.id, status: promotedAnswers.status })
    .from(promotedAnswers)
    .where(and(eq(promotedAnswers.sourceMessageId, messageId), eq(promotedAnswers.orgId, orgId)))
    .limit(1);
  return row ?? null;
}
