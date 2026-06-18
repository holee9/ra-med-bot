// @MX:ANCHOR Environment validation — fail-fast on missing/invalid env vars.
// REQ-FND-010a: This module MUST throw a ZodError if any required variable
// is missing, malformed, or empty. Importing this module at app startup
// guarantees the rest of the runtime can rely on `env.*` being well-typed.

import { z } from 'zod';

// @MX:ANCHOR Dev-placeholder guard — REQ-QUAL-027.
// @MX:REASON Bootstrap (scripts/dev-bootstrap.ts) writes `dev-placeholder-*`
// markers into `.env.local` so contributors can boot without real secrets.
// In production those values must never be accepted, otherwise the app
// would silently call LLM/auth APIs with garbage credentials.
const isDevPlaceholderForbidden = (v: string): boolean =>
  process.env.NODE_ENV !== 'production' || !v.startsWith('dev-placeholder-');

const devPlaceholderMessage = (label: string): string =>
  `${label} cannot be a dev-placeholder value in production`;

// Phase 1 only validates the variables required to boot the auth + db layer.
// LLM, S3, and observability vars are added incrementally in later phases
// and stay optional in `.env.example` until then.
const envSchema = z.object({
  // Database connection — Drizzle + postgres-js consume this directly.
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Auth.js v5 — AUTH_SECRET replaces the legacy NEXTAUTH_SECRET name.
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('AUTH_SECRET')),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),

  // SSO providers — both Microsoft and Google are required in Phase 1
  // because the login screen renders both buttons.
  AUTH_MICROSOFT_ID: z
    .string()
    .min(1, 'AUTH_MICROSOFT_ID is required')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('AUTH_MICROSOFT_ID')),
  AUTH_MICROSOFT_SECRET: z
    .string()
    .min(1, 'AUTH_MICROSOFT_SECRET is required')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('AUTH_MICROSOFT_SECRET')),
  AUTH_GOOGLE_ID: z
    .string()
    .min(1, 'AUTH_GOOGLE_ID is required')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('AUTH_GOOGLE_ID')),
  AUTH_GOOGLE_SECRET: z
    .string()
    .min(1, 'AUTH_GOOGLE_SECRET is required')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('AUTH_GOOGLE_SECRET')),

  // Phase 2 LLM providers.
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, 'ANTHROPIC_API_KEY is required')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('ANTHROPIC_API_KEY')),
  OPENAI_API_KEY: z
    .string()
    .min(1, 'OPENAI_API_KEY is required')
    .refine(isDevPlaceholderForbidden, devPlaceholderMessage('OPENAI_API_KEY')),

  // Optional: label shown in the UI for the LLM model.
  NEXT_PUBLIC_LLM_MODEL_LABEL: z.string().optional(),

  // Optional: hybrid-ra-saas integration (Issue #170).
  // These stay optional so deployments without hybrid-ra-saas still boot cleanly.
  HYBRID_RA_API_BASE_URL: z.string().url().optional(),
  HYBRID_RA_API_TOKEN: z.string().optional(),
  HYBRID_RA_TENANT_ID: z.string().optional(),
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
  // The build script explicitly sets REGULA_ALLOW_ENV_VALIDATION_SKIP=build.
  // Runtime callers (next dev, next start, public validation) must never bypass
  // validation because empty env objects make downstream clients fall back to
  // unsafe defaults.
  if (source.SKIP_ENV_VALIDATION === '1') {
    if (source.REGULA_ALLOW_ENV_VALIDATION_SKIP !== 'build') {
      // @MX:WARN Runtime env validation bypass — security risk
      // @MX:REASON OWASP A05:2021 — skipping validation allows running with unsafe defaults
      throw new Error(
        'SKIP_ENV_VALIDATION=1 is allowed only for next build. Use pnpm dev:public or unset SKIP_ENV_VALIDATION for runtime validation.',
      );
    }
    // Build-time bypass: Next.js needs this for route data collection
    // This is safe because the binary won't run without env validation at startup
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
    ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    NEXT_PUBLIC_LLM_MODEL_LABEL: source.NEXT_PUBLIC_LLM_MODEL_LABEL,
    HYBRID_RA_API_BASE_URL: source.HYBRID_RA_API_BASE_URL,
    HYBRID_RA_API_TOKEN: source.HYBRID_RA_API_TOKEN,
    HYBRID_RA_TENANT_ID: source.HYBRID_RA_TENANT_ID,
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
