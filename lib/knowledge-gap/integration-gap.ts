// @MX:NOTE [AUTO] Integration-gap recorder — bridges hybrid BFF errors into the
// audit trail (Issue #156 AC4).
// @MX:SPEC SPEC-INTEGRATION-001 AC4 (REQ-INTEGRATION-010)
//
// When a hybrid BFF route (sync-status / audit-status / audit-export) catches a
// HybridRaClientError of kind auth/timeout/schema_mismatch/server_error/network,
// we record an audit log so the integration failure is tracked in the same
// 21 CFR Part 11 trail as regulatory knowledge gaps. The 'unconfigured' kind is
// SKIPPED — it's a legitimate "feature not enabled" state, not a bug.
//
// We deliberately do NOT insert into unanswered_queue: that table has NOT NULL
// FK constraints on conversation_id + message_id, which don't exist for hybrid
// integration failures (no user consult happened). The audit row alone is the
// canonical record and surfaces in the SLA dashboard.
//
// Best-effort, non-blocking: recorder failures are swallowed. The BFF route must
// still return its error JSON to the caller regardless of recorder outcome.

import type { HybridRaErrorKind } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';

/** Kinds that represent real bugs worth tracking (vs. 'unconfigured' = feature off). */
const TRACKED_KINDS: ReadonlySet<HybridRaErrorKind> = new Set([
  'auth',
  'timeout',
  'schema_mismatch',
  'server_error',
  'network',
]);

/** Inputs for the recorder — supplied by the hybrid BFF catch block. */
export interface IntegrationGapRecord {
  kind: HybridRaErrorKind;
  endpoint: string;
  statusCode: number;
  tenantId: string | null;
  /** Actor UUID when known (session user). Null for unauthenticated/system. */
  actorId: string | null;
}

/**
 * Record an integration-gap audit entry when the error kind is tracked.
 * Returns immediately for 'unconfigured' (no audit row) so callers can invoke
 * it unconditionally in catch blocks without filtering.
 *
 * Best-effort: failures are swallowed so the BFF route never crashes due to
 * recorder issues.
 */
export async function recordIntegrationGap(rec: IntegrationGapRecord): Promise<void> {
  if (!TRACKED_KINDS.has(rec.kind)) return;

  try {
    await writeAudit({
      actor_id: rec.actorId,
      action: 'knowledge_gap_created',
      resource_type: 'integration',
      resource_id: rec.endpoint,
      meta_json: {
        source: 'integration',
        kind: rec.kind,
        endpoint: rec.endpoint,
        status_code: rec.statusCode,
        tenant_id: rec.tenantId,
      },
    });
  } catch {
    // Swallow — recorder must never break the BFF route.
  }
}
