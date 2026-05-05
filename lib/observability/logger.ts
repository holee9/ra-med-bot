// @MX:ANCHOR: [AUTO] Structured logger — single logging gateway for the entire application.
// @MX:REASON: Called from 30 files across lib/, app/api/, workers/, scripts/. All console.* calls route here.
// @MX:WARN: [AUTO] PII scrubbing on meta fields — mask must cover all sensitive field names.
// @MX:REASON: Logs may be ingested by external log aggregators. Leaking PII violates GDPR/HIPAA.
// @MX:SPEC: SPEC-REGULA-RELEASE-HARDENING-001 (TASK-004)

/** Fields in log meta that must be redacted before output. */
const PII_FIELDS = new Set(['email', 'password', 'token', 'apiKey', 'api_key', 'secret', 'userId']);

/**
 * Recursively scrub PII fields from a metadata object.
 * Replaces matched field values with '[REDACTED]'.
 */
function scrubPii(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (PII_FIELDS.has(key)) {
      out[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = scrubPii(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Serialize an unknown error value to a plain object safe for logging.
 * Avoids logging raw Error instances to prevent stack trace leakage in production.
 */
function serializeError(err: Error | unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { raw: String(err) };
}

const isProduction = process.env.NODE_ENV === 'production';

function emit(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  meta?: Record<string, unknown>,
): void {
  const scrubbed = meta ? scrubPii(meta) : undefined;

  if (isProduction) {
    const entry: Record<string, unknown> = { level, message, ts: new Date().toISOString() };
    if (scrubbed) entry.meta = scrubbed;
    // stdout output — consumed by log aggregators (Datadog, CloudWatch, etc.)
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  } else {
    // Development: delegate to console for readable output
    if (scrubbed) {
      // biome-ignore lint/suspicious/noConsole: intentional dev passthrough
      console[level](message, scrubbed);
    } else {
      // biome-ignore lint/suspicious/noConsole: intentional dev passthrough
      console[level](message);
    }
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    emit('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    emit('warn', message, meta);
  },

  /**
   * Log an error. The error object is serialized to name+message only in
   * production to avoid leaking stack traces to log aggregators.
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const combined: Record<string, unknown> = {};
    if (error !== undefined) Object.assign(combined, serializeError(error));
    if (meta) Object.assign(combined, scrubPii(meta));
    emit('error', message, Object.keys(combined).length > 0 ? combined : undefined);
  },

  debug(message: string, meta?: Record<string, unknown>): void {
    emit('debug', message, meta);
  },
};
