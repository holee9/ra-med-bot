// @MX:ANCHOR [AUTO] CloudflareEnv — single source of truth for all Workers binding types.
// @MX:REASON All Workers code that needs env bindings imports from here. fan_in will
// reach 3+ once session store, rate limiter, and hybrid router all reference this type.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-031, REQ-CF-041, REQ-CF-056)

/**
 * TypeScript type declarations for Cloudflare Workers environment bindings.
 * Import this interface in Workers-compatible code only (not in Node.js code paths).
 *
 * All binding names must match exactly what is declared in wrangler.toml.
 */
export interface CloudflareEnv {
  // ── KV Namespaces ────────────────────────────────────────────────────────
  /** Auth.js v5 session store */
  SESSION_KV: KVNamespace;
  /** Sliding-window rate limit counters */
  RATELIMIT_KV: KVNamespace;
  /** Feature flag overrides */
  FLAGS_KV: KVNamespace;
  /** Locale preference cache */
  LOCALE_KV: KVNamespace;

  // ── R2 Buckets ───────────────────────────────────────────────────────────
  /** FDA/EU MDR/MFDS/NMPA/PMDA PDF originals */
  CORPUS_PUBLIC: R2Bucket;
  /** ISO 13485/14971 internal SOPs */
  CORPUS_INTERNAL: R2Bucket;
  /** audit_logs cold storage (Iceberg format, compliance mode object lock) */
  AUDIT_COLD: R2Bucket;
  /** Submission document previews (Phase 8 rail) */
  ASSETS: R2Bucket;
  /** OpenNext.js ISR/static cache */
  OPENNEXT_CACHE: R2Bucket;

  // ── Vectorize Indexes ────────────────────────────────────────────────────
  FDA_PUBLIC: VectorizeIndex;
  EU_MDR_PUBLIC: VectorizeIndex;
  MFDS_PUBLIC: VectorizeIndex;
  NMPA_PUBLIC: VectorizeIndex;
  PMDA_PUBLIC: VectorizeIndex;

  // ── Queues ───────────────────────────────────────────────────────────────
  AUDIT_ARCHIVE_QUEUE: Queue;
  CORPUS_UPDATE_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  LANGFUSE_FLUSH_QUEUE: Queue;

  // ── Environment Variables ────────────────────────────────────────────────
  /** Dual-write mode: write to KV first then Neon. "true" | "false" */
  DUAL_WRITE_SESSIONS: string;
  /** Session grace period in seconds for KV TTL extension */
  KV_SESSION_GRACE_PERIOD_SECONDS: string;
  /**
   * HIPAA BAA scope flag. Workers AI paths MUST check this before routing
   * to AutoRAG. Pending Item #1 — set to "true" only after BAA is confirmed.
   */
  HIPAA_BAA_CONFIRMED: string;
  /** Vectorize EU GA flag. "true" once Vectorize EU region is GA. Pending Item #2. */
  VECTORIZE_EU_GA: string;

  // ── Optional Vector Backend Overrides ───────────────────────────────────
  /** Override Vectorize backend for FDA corpus (e.g. "pgvector" for canary) */
  VECTOR_BACKEND_FDA?: string;
  VECTOR_BACKEND_EU_MDR?: string;
  VECTOR_BACKEND_MFDS?: string;
  VECTOR_BACKEND_NMPA?: string;
  VECTOR_BACKEND_PMDA?: string;
}
