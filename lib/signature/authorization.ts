// @MX:ANCHOR [AUTO] Signature message authorization — tenant boundary for answer signatures.
// @MX:REASON Signature routes are UUID-addressable and must not expose cross-tenant messages.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-006)

import { and, eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { conversations, messages, projects } from '../db/schema';

interface SignatureSession {
  user: {
    id: string;
    organizationId?: string | null;
  };
}

export interface AuthorizedSignatureMessage {
  id: string;
  contentProse: string;
}

/**
 * Returns the message only when the caller can access the answer record.
 *
 * Project-scoped answers are authorized by the caller's organization.
 * Projectless answers are authorized by direct conversation ownership.
 * Returning null for both "not found" and "not allowed" avoids UUID probing.
 */
export async function getAuthorizedSignatureMessage(
  messageId: string,
  session: SignatureSession,
  database = db,
): Promise<AuthorizedSignatureMessage | null> {
  const [message] = await database
    .select({
      id: messages.id,
      contentProse: messages.contentProse,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(projects, eq(projects.id, conversations.projectId))
    .where(
      and(
        eq(messages.id, messageId),
        or(
          eq(conversations.userId, session.user.id),
          eq(projects.organizationId, session.user.organizationId ?? ''),
        ),
      ),
    )
    .limit(1);

  return message ?? null;
}
