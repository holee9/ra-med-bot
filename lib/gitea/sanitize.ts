// @MX:ANCHOR [AUTO] Shared Gitea token-leak sanitizer for error bodies.
// @MX:REASON fan_in = 2 (owning-issue.ts issue-write path, ingest-gitea-wiki.ts
//   read path). Gitea 4xx/5xx error bodies have been observed to echo the
//   request Authorization header back. Interpolating the raw body into a
//   thrown Error would leak the token to Sentry, logs, and audit_logs.meta_json.
//   Centralizing the sanitizer here keeps the two hot paths consistent and
//   removes the drift risk of two copies. Dependency-free by design: this
//   module must not import DB, logger, or env — so a failure in one consumer
//   cannot cascade into the other's import graph.

/**
 * Token-leak patterns. Order matters: the credential-adjacent pattern runs
 * first (catches `Bearer <T>`, `token <T>`, `Basic <b64>`), then the
 * context-scoped generic pattern catches bare long runs ONLY when near a
 * credential keyword.
 *
 * SECURITY INVARIANT: false negatives (miss a token) are acceptable; false
 * positives (mangle a legit diagnostic like a 40-hex git SHA or trace ID)
 * are not — they degrade diagnosability during incidents.
 *
 * The earlier blanket `[A-Za-z0-9_-]{32,}` regex was retired because it
 * redacted EVERY 32+ char run — including 40-hex git SHAs and trace IDs
 * that are legitimate diagnostic content in Gitea error bodies. The
 * observed leak vector (echoed Authorization header) is fully covered by
 * the first pattern; the second pattern is a belt-and-suspenders for
 * token-adjacent bare blobs only.
 */
const TOKEN_LEAK_PATTERNS = [
  // RFC 7235 + Gitea dialect: `Bearer <token>`, `token <token>`, `Basic <b64>`.
  /(?:Bearer|Token|token|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g,
  // Bare long run (40+ chars, PAT/JWT/base64url shape) ONLY when preceded
  // within 24 chars by a credential keyword. The lookahead window is tight
  // enough to avoid matching a 40-hex git SHA in a generic error message
  // while still catching a `<keyword>: <blob>` echo that the first regex
  // missed (e.g. `X-Auth-Token: <blob>` or `token:<blob>` with no space).
  /(?:token|authorization|auth|bearer|basic|password|secret|key)["'\s:=]{0,24}[A-Za-z0-9._~+/=-]{40,}/gi,
];

/**
 * Strip credential-shaped substrings from a raw upstream error body.
 * Used by both the issue-write path and the read path before the body
 * reaches a thrown Error (and from there Sentry / audit meta / logs).
 *
 * Returns the redacted string. Does NOT truncate — callers decide on
 * truncation length for their own surface.
 */
export function stripTokens(raw: string): string {
  let out = raw;
  for (const re of TOKEN_LEAK_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

/**
 * Sanitize a raw Gitea error body for safe inclusion in a thrown Error.
 * (1) Strip credential-shaped substrings. (2) Truncate to <=200 chars
 * (Gitea error bodies can be multi-KB HTML debug pages; the leading
 * slice is enough to identify the failure mode for operators).
 *
 * The HTTP status code is passed separately by callers and is always
 * safe to expose.
 */
export function sanitizeGiteaErrorBody(raw: string): string {
  const redacted = stripTokens(raw);
  return redacted.length > 200 ? `${redacted.slice(0, 200)}…` : redacted;
}
