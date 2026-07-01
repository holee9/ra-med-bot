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
  // After SPEC-REGULA-RLS-ENFORCE-001 Phase 4 this is the non-superuser
  // `regula_app` role (BYPASSRLS=false); all org-scoped reads rely on the
  // `app.current_org_id` GUC set by withTenantScope.
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Optional service-role DB URL — connects with a BYPASSRLS role for
  // bootstrap queries that cannot have a tenant GUC (Auth.js session
  // callback derives orgId FROM this read, so it must see rows regardless
  // of RLS). Falls back to DATABASE_URL when unset, so local dev with a
  // single superuser role keeps working unchanged.
  // @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 Phase 4 (M-1)
  SERVICE_DATABASE_URL: z.string().url('SERVICE_DATABASE_URL must be a valid URL').optional(),

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

  // Phase C (#318): external LLM API keys fully removed — gx10 Ollama is the
  // sole chat + embedding backend (on-prem, keyless on the 192.168.100.x trust
  // network). ANTHROPIC_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN are gone.
  // @MX:NOTE [AUTO] All optional — defaults in lib/ai/llm-provider.ts and
  //           lib/ai/embedding-provider.ts point at gx10 (http://192.168.100.1:11434/v1)
  //           so the app boots with an empty .env.local in the gx10 environment.
  LLM_PROVIDER: z.string().optional(), // retained for operator visibility; no routing effect (ollama-only)
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  OLLAMA_FAST_MODEL: z.string().optional(),
  EMBEDDING_BASE_URL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(), // gx10 is keyless; sentinel fallback in embedding-provider

  // Optional: label shown in the UI for the LLM model.
  NEXT_PUBLIC_LLM_MODEL_LABEL: z.string().optional(),

  // Optional: hybrid-ra-saas integration (Issue #170).
  // These stay optional so deployments without hybrid-ra-saas still boot cleanly.
  HYBRID_RA_API_BASE_URL: z.string().url().optional(),
  HYBRID_RA_API_TOKEN: z.string().optional(),
  HYBRID_RA_TENANT_ID: z.string().optional(),

  // Optional: inbound webhook authentication (Issue #188).
  // These stay optional so deployments without inbound webhooks still boot cleanly.
  REGULA_API_KEY: z.string().optional(),
  CRAWL_PUSH_SECRET: z.string().optional(),

  // Optional: Gitea wiki ingestion (Issue #155).
  // These stay optional so deployments without Gitea wiki still boot cleanly.
  // GITEA_URL/TOKEN/WIKI_REPO are the read-only ingestion scope (AC3).
  GITEA_URL: z.string().url().optional(),
  GITEA_TOKEN: z.string().optional(),
  GITEA_WIKI_REPO: z.string().optional(),

  // Optional: Gitea issue creation — write scope (Issue #155 AC4).
  // Separated from GITEA_TOKEN (read) for least-privilege: the ingestion
  // script never needs issue-write, and the issue provider never needs
  // wiki-read. When unset, owning-repos.readOwningRepoConfig returns null
  // for 'gitea-wiki' and the router degrades to 'queue' (safe fallback).
  GITEA_ISSUE_TOKEN: z.string().optional(),
  GITEA_ISSUE_REPO: z.string().optional(),
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
    // Build-time bypass: Next.js needs this for route data collection.
    // The guard above keeps this path limited to pnpm build; runtime callers
    // still validate env on startup and never receive this empty object.
    return {} as Env;
  }

  // Auth.js historically used several env-var names for the Microsoft Entra
  // provider. Accept any of them so contributors are not blocked by naming.
  const microsoftId =
    source.AUTH_MICROSOFT_ID ?? source.AUTH_MICROSOFT_ENTRA_ID ?? source.AZURE_AD_CLIENT_ID;
  const microsoftSecret = source.AUTH_MICROSOFT_SECRET ?? source.AZURE_AD_CLIENT_SECRET;

  return envSchema.parse({
    DATABASE_URL: source.DATABASE_URL,
    SERVICE_DATABASE_URL: source.SERVICE_DATABASE_URL,
    AUTH_SECRET: source.AUTH_SECRET,
    NEXTAUTH_URL: source.NEXTAUTH_URL,
    AUTH_MICROSOFT_ID: microsoftId,
    AUTH_MICROSOFT_SECRET: microsoftSecret,
    AUTH_GOOGLE_ID: source.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: source.AUTH_GOOGLE_SECRET,
    LLM_PROVIDER: source.LLM_PROVIDER,
    OLLAMA_BASE_URL: source.OLLAMA_BASE_URL,
    OLLAMA_MODEL: source.OLLAMA_MODEL,
    OLLAMA_FAST_MODEL: source.OLLAMA_FAST_MODEL,
    EMBEDDING_BASE_URL: source.EMBEDDING_BASE_URL,
    EMBEDDING_MODEL: source.EMBEDDING_MODEL,
    EMBEDDING_API_KEY: source.EMBEDDING_API_KEY,
    NEXT_PUBLIC_LLM_MODEL_LABEL: source.NEXT_PUBLIC_LLM_MODEL_LABEL,
    HYBRID_RA_API_BASE_URL: source.HYBRID_RA_API_BASE_URL,
    HYBRID_RA_API_TOKEN: source.HYBRID_RA_API_TOKEN,
    HYBRID_RA_TENANT_ID: source.HYBRID_RA_TENANT_ID,
    REGULA_API_KEY: source.REGULA_API_KEY,
    CRAWL_PUSH_SECRET: source.CRAWL_PUSH_SECRET,
    // Gitea — ra-llm-wiki (DR_RnD/ra-llm-wiki) read-only ingestion (Issue #155)
    GITEA_URL: source.GITEA_URL,
    GITEA_TOKEN: source.GITEA_TOKEN,
    GITEA_WIKI_REPO: source.GITEA_WIKI_REPO,
    // Gitea issue-write scope (AC4) — independent from the read scope above.
    GITEA_ISSUE_TOKEN: source.GITEA_ISSUE_TOKEN,
    GITEA_ISSUE_REPO: source.GITEA_ISSUE_REPO,
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
