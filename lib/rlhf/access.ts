// @MX:ANCHOR [AUTO] assertMessageInOrg — IDOR guard for RLHF feedback routes.
// @MX:REASON RLS is INERT project-wide (#239 debt), so org isolation MUST be
//           enforced at the query layer. withPermission('rlhf.feedback') only
//           proves the caller is a member of their OWN org — it does not bind
//           the request body messageId to that org. Without this guard, an
//           org-A user can read/write feedback on org-B messages (cross-tenant
//           Part 11 audit corruption). Mirrors assertPmsProjectAccess (#69) and
//           assertInvestigationAccess patterns.
// @MX:SPEC SPEC-REGULA-RLHF-001 (C-1/C-2 IDOR hardening, 21 CFR Part 11)

import { db } from '@/lib/kernel/db/client';
import { conversations, messages, projects } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Resolve the organizationId that owns `messageId` via the canonical 3-hop
 * join messages -> conversations -> projects. Returns null when the message
 * does not exist or the conversation has no project (data-integrity gap).
 *
 * Exposed (not inline) so the regression test can assert the join path is
 * real and not a placeholder.
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
 * C-1/C-2 IDOR guard: verify `messageId` belongs to `organizationId`.
 * Returns true when the message exists AND its project's org matches.
 * Returns false otherwise (caller surfaces 403 — RLHF routes return 403, not
 * 404, because the feedback endpoint is not a resource-probing surface; the
 * messageId is already known to the caller from their own org's consult flow).
 */
export async function messageBelongsToOrg(
  messageId: string,
  organizationId: string,
): Promise<boolean> {
  const orgId = await resolveMessageOrg(messageId);
  return orgId !== null && orgId === organizationId;
}

/**
 * Assert form: returns a 403 Response when the message does not belong to the
 * caller's org, or null when access is granted. Mirrors assertPmsProjectAccess.
 */
export async function assertMessageInOrg(
  messageId: string,
  organizationId: string,
): Promise<Response | null> {
  const allowed = await messageBelongsToOrg(messageId, organizationId);
  if (allowed) return null;
  return Response.json({ error: 'message_not_in_org' }, { status: 403 });
}
