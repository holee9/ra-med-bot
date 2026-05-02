// @MX:ANCHOR Audit log writer — single entry point for all 21 CFR Part 11 events.
// @MX:REASON Every regulated action (consult, source access, expert flag) flows
// through this function. fan_in will reach 3+ in Phase 2 (RAG handler) and
// Phase 5 (auth callbacks). Any new audit action MUST go through here so
// the static-analysis sweep in regula-compliance-qa stays effective.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-048, REQ-FND-049, REQ-FND-049a)
//
// 7-year retention policy (21 CFR Part 11)
// NOTE: writeAudit() is defined here but NOT called in Phase 1 code.
// Phase 2: wire llm.call, source.access (RAG handler).
// Phase 5: wire auth.login, auth.logout, expert_review.* (auth callbacks).

import { db } from './db/client';
import { auditLogs } from './db/schema';

// Phase 1 audit_action values. Extending this union requires:
//   1. ALTER TYPE audit_action ADD VALUE ... (new migration)
//   2. Update lib/db/schema.ts auditActionEnum
//   3. Update this type
// Keep them in lock-step or the runtime insert will fail.
export type AuditAction = 'llm.call' | 'source.access' | 'expert_review.flag';

export interface AuditEvent {
  /** User UUID, or null for system-initiated events. */
  actor_id: string | null;
  action: AuditAction;
  /** e.g. 'message', 'source', 'conversation'. */
  resource_type: string;
  /** Free-form ID — UUID for DB rows, opaque string for external resources. */
  resource_id: string;
  /** Optional FK so audit-trail queries can join by conversation. */
  conversation_id?: string | null;
  /**
   * Non-PII context only. PII rule: never include question text, answer text,
   * email, phone, or any free-form prose. Use `messageId` to indirect-reference.
   */
  meta_json?: Record<string, unknown>;
}

/**
 * Insert an immutable audit row. Failures propagate to the caller — the
 * regulated workflow MUST fail closed if the audit write fails. Do NOT
 * swallow this error.
 */
export async function writeAudit(params: AuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: params.actor_id,
    action: params.action,
    resourceType: params.resource_type,
    resourceId: params.resource_id,
    conversationId: params.conversation_id ?? null,
    metaJson: params.meta_json ?? {},
  });
}
