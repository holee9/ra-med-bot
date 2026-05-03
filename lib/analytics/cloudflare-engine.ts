// @MX:NOTE [AUTO] Cloudflare Analytics Engine metric emitter for consult pipeline.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-077, REQ-CF-079)
//
// PII-free: MUST NOT include question/answer text, email, or userId.
// Any PII field in the metric payload throws a hard error (fail-closed).

/**
 * Allowed metric fields — all non-PII.
 * Extending this interface is safe. Adding PII fields is FORBIDDEN.
 */
export interface ConsultMetric {
  /** End-to-end latency in milliseconds */
  latency_ms: number;
  /** Whether the response was served from cache */
  cache_hit: boolean;
  /** Cloudflare region identifier (e.g. "us-east", "eu-west", "apac") */
  region: string;
  /** HTTP status code of the consult response */
  status_code: number;
  /** Corpus used for retrieval (e.g. "fda", "eu-mdr") */
  corpus?: string;
  /** Retrieval backend used (e.g. "vectorize", "pgvector", "autorag") */
  retrieval_backend?: string;
  /** Number of retrieved chunks */
  chunk_count?: number;
}

// PII field names that are NEVER allowed in analytics payloads
const PII_FIELDS = ['question', 'answer', 'email', 'userId', 'user_id', 'name', 'ip'] as const;

/**
 * Emits a consult performance metric to Cloudflare Analytics Engine.
 *
 * PII guard (REQ-CF-077): throws if any PII field is detected in the payload.
 * Uses Workers Bindings only — no external HTTP calls.
 *
 * @param engine - Cloudflare Analytics Engine binding (from env.ANALYTICS)
 * @param metric - Non-PII performance metric
 */
export async function emitConsultMetric(
  engine: AnalyticsEngineDataset,
  metric: ConsultMetric,
): Promise<void> {
  // PII guard — fail-closed
  const metricKeys = Object.keys(metric as Record<string, unknown>);
  const piiFound = metricKeys.filter((k) =>
    PII_FIELDS.includes(k as (typeof PII_FIELDS)[number]),
  );

  if (piiFound.length > 0) {
    throw new Error(
      `PII field(s) detected in analytics metric: ${piiFound.join(', ')}. ` +
        'Analytics Engine MUST NOT receive PII. (REQ-CF-077)',
    );
  }

  // Write non-PII datapoint to Analytics Engine
  // Analytics Engine API: writeDataPoint({ blobs?, doubles?, indexes? })
  engine.writeDataPoint({
    blobs: [
      metric.region,
      metric.corpus ?? '',
      metric.retrieval_backend ?? '',
    ],
    doubles: [
      metric.latency_ms,
      metric.cache_hit ? 1 : 0,
      metric.status_code,
      metric.chunk_count ?? 0,
    ],
    indexes: [metric.region],
  });
}
