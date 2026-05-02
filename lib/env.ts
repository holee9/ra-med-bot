// @MX:ANCHOR Environment validation — fail-fast on missing/invalid env vars.
// REQ-FND-010a: This module MUST throw a ZodError if any required variable
// is missing, malformed, or empty. Importing this module at app startup
// guarantees the rest of the runtime can rely on `env.*` being well-typed.

import { z } from 'zod';

// Phase 1 only validates the variables required to boot the auth + db layer.
// LLM, S3, and observability vars are added incrementally in later phases
// and stay optional in `.env.example` until then.
const envSchema = z.object({
  // Database connection — Drizzle + postgres-js consume this directly.
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Auth.js v5 — AUTH_SECRET replaces the legacy NEXTAUTH_SECRET name.
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),

  // SSO providers — both Microsoft and Google are required in Phase 1
  // because the login screen renders both buttons.
  AUTH_MICROSOFT_ID: z.string().min(1, 'AUTH_MICROSOFT_ID is required'),
  AUTH_MICROSOFT_SECRET: z.string().min(1, 'AUTH_MICROSOFT_SECRET is required'),
  AUTH_GOOGLE_ID: z.string().min(1, 'AUTH_GOOGLE_ID is required'),
  AUTH_GOOGLE_SECRET: z.string().min(1, 'AUTH_GOOGLE_SECRET is required'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse `process.env` against the Zod schema. Accepts an optional override
 * map so unit tests can validate behaviour without mutating the global env.
 *
 * Throws `ZodError` (not a generic `Error`) so callers and tests can inspect
 * the per-field issues array.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // During `next build`, Next.js collects route data before env vars are set.
  // SKIP_ENV_VALIDATION=1 is injected by next.config.mjs only for that phase
  // so the DB/auth modules can be imported without crashing. Runtime callers
  // (next dev, next start, pnpm test) never have this set, so validation runs.
  if (source.SKIP_ENV_VALIDATION === '1') {
    return {} as Env;
  }

  // Auth.js historically used several env-var names for the Microsoft Entra
  // provider. Accept any of them so contributors are not blocked by naming.
  const microsoftId =
    source.AUTH_MICROSOFT_ID ?? source.AUTH_MICROSOFT_ENTRA_ID ?? source.AZURE_AD_CLIENT_ID;
  const microsoftSecret = source.AUTH_MICROSOFT_SECRET ?? source.AZURE_AD_CLIENT_SECRET;

  return envSchema.parse({
    DATABASE_URL: source.DATABASE_URL,
    AUTH_SECRET: source.AUTH_SECRET,
    NEXTAUTH_URL: source.NEXTAUTH_URL,
    AUTH_MICROSOFT_ID: microsoftId,
    AUTH_MICROSOFT_SECRET: microsoftSecret,
    AUTH_GOOGLE_ID: source.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: source.AUTH_GOOGLE_SECRET,
  });
}

// Lazily evaluated so tooling that imports this file (drizzle-kit, vitest
// config) does not crash before the user copies `.env.example`. The actual
// app bootstraps must call `getEnv()` early to enforce REQ-FND-010a.
let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv();
  return cached;
}

// Test-only hook to reset the memoised value.
export function __resetEnvCacheForTests(): void {
  cached = null;
}
