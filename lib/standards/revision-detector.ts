// @MX:NOTE [AUTO] Standards revision detector — graceful-degradation stub.
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-009/020, AC-04 structural)
//
// REQ-020 / Charter [지양-3] external-dependency isolation: all live crawlers
// are optional. When no source env is configured, detectRevisions() returns []
// immediately — the system boots and stays functional without external APIs.
//
// @MX:TODO #62-A — Implement live ISO/IEC/CEN/ASTM crawlers on lib/radar/crawlers/_base.ts.
// @MX:TODO #62-B — Import full FDA Recognized Consensus Standards DB (6000+ rows).
// @MX:TODO #62-C — EU OJ Series C crawler + DoW parser.
// These are follow-up issues; this stub only exposes the typed interface so
// the cron wiring (Inngest function + audit) is structurally complete.

export interface StandardsRawUpdate {
  standardNumber: string;
  revisionLabel: string;
  ojPublicationDate?: string;
  dateOfWithdrawal?: string;
  impactSummary?: string;
  source: string;
}

export interface RevisionSource {
  readonly name: string;
  readonly configured: boolean;
  fetch(): Promise<StandardsRawUpdate[]>;
}

export interface DetectionContext {
  /** When true, at least one source is configured and detection will run. */
  hasActiveSource: boolean;
}

/**
 * Detect standards revisions across all configured sources.
 *
 * Graceful degradation (Charter [지양-3]): returns [] immediately when no
 * source is configured. Mirrors corpus-license #72 / radar crawlers/_base.ts
 * backoff pattern — live fetch is deferred to follow-up #62-A/#62-B/#62-C.
 */
export async function detectRevisions(
  _ctx: DetectionContext = { hasActiveSource: false },
): Promise<StandardsRawUpdate[]> {
  // @MX:TODO #62-A/#62-B/#62-C — live crawlers go here. Each crawler is a
  // RevisionSource that exposes fetch(); this function fans out, collects
  // results, and deduplicates by (standardNumber, revisionLabel).
  //
  // Intentional no-op until crawlers land. The cron still runs daily and
  // records a 'standards.revision.detected' audit row with source='noop'
  // so the detection timeline is observable.
  return [];
}

/**
 * Resolve whether any live source is currently configured.
 * Reads env directly (lazy) so the module imports cleanly in test environments.
 */
export function resolveDetectionContext(): DetectionContext {
  const env = process.env;
  const hasFda = Boolean(env.FDA_RECOGNIZED_STANDARDS_API_URL);
  const hasIso = Boolean(env.ISO_STANDARDS_API_URL);
  const hasCen = Boolean(env.CEN_STANDARDS_API_URL);
  return { hasActiveSource: hasFda || hasIso || hasCen };
}
