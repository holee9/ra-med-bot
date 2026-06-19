# Environment Variables Matrix

**SPEC**: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-039)  
**Last Updated**: 2026-06-20

This document lists all environment variables required by Regula across environments.
Do **not** commit real secrets. Use Vercel project settings or your secret manager.

---

## Environments

| Environment | Branch / Target | Notes |
|-------------|-----------------|-------|
| **development** | `localhost` / `.env.local` | Local dev; values can be test keys |
| **preview** | Feature branches → Vercel Preview | Vercel auto-deploys; uses Vercel env vars scoped to Preview |
| **production** | `main` → Vercel Production | Live environment; must use rotated secrets |

---

## Variable Matrix

| Variable | Description | development | preview | production | Secret |
|----------|-------------|-------------|---------|------------|--------|
| `DATABASE_URL` | PostgreSQL 16 connection string | `postgresql://user:pw@localhost:5432/regula` | Vercel Postgres (preview DB) | Vercel Postgres (prod DB) | Yes |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | NextAuth v5 signing secret (≥32 chars). Also referenced as `NEXTAUTH_SECRET` in some libraries. | Generated locally | Vercel secret | Vercel secret (rotate quarterly) | Yes |
| `NEXTAUTH_URL` | Canonical app URL for OAuth callbacks | `http://localhost:3000` | Auto-set by Vercel | `https://regula.example.com` | No |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key for chat inference | Test/personal key | Preview key | Production key | Yes |
| `OPENAI_API_KEY` | OpenAI API key (fallback / eval) | Optional | Optional | Optional | Yes |
| `AUTH_MICROSOFT_ENTRA_ID` | Azure AD / Entra ID client ID | Optional | Optional | Required if SSO enabled | Yes |
| `AUTH_MICROSOFT_SECRET` | Azure AD client secret | Optional | Optional | Required if SSO enabled | Yes |
| `AUTH_MICROSOFT_TENANT_ID` | Azure AD tenant ID | Optional | Optional | Required if SSO enabled | No |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Optional | Optional | Required if Google SSO | Yes |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Optional | Optional | Required if Google SSO | Yes |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking (public) | Empty / test DSN | Preview DSN | Production DSN | No |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (public) | Optional | Optional | Required | No |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host | `https://eu.i.posthog.com` | Same | Same | No |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key for LLM tracing | Optional | Optional | Required | Yes |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key | Optional | Optional | Required | No |
| `LANGFUSE_BASEURL` | Langfuse API base URL | `https://cloud.langfuse.com` | Same | Same | No |
| `ANTHROPIC_API_KEY_EVAL` | Separate Anthropic key for eval harness | Test key | Test key | Eval pipeline key | Yes |
| `HYBRID_RA_API_BASE_URL` | Base URL for outbound hybrid-ra-saas API calls from `createHybridRaClient()` | Optional local hybrid runtime URL | Preview hybrid API URL | Production hybrid API URL | No |
| `HYBRID_RA_API_TOKEN` | Bearer token for outbound hybrid-ra-saas API calls | Optional local token | Preview integration token | Production integration token | Yes |
| `HYBRID_RA_TENANT_ID` | Tenant scope sent as `X-Tenant-Id` to hybrid-ra-saas | Optional local tenant | Preview tenant ID | Production tenant ID | Yes |
| `REGULA_API_KEY` | Shared secret for `POST /api/webhooks/audit` and `POST /api/webhooks/ifu` from hybrid-ra-saas customer runtime | Optional local test secret | Preview webhook secret | Production webhook secret | Yes |
| `CRAWL_PUSH_SECRET` | Shared secret for `POST /api/webhooks/knowledge-sync` from hybrid-ra-saas cloud control plane | Optional local test secret | Preview crawl push secret | Production crawl push secret | Yes |

---

## How to Configure

### Local development

1. Copy `.env.example` to `.env.local`.
2. Fill in real values for `DATABASE_URL`, `AUTH_SECRET`, and `ANTHROPIC_API_KEY`.
3. Never commit `.env.local`.

### Preview and Production (Vercel)

1. Go to **Vercel Dashboard → Project → Settings → Environment Variables**.
2. Add each secret variable with scope `Preview` or `Production` as appropriate.
3. Variables marked **Secret** must be added via the Vercel UI or Vercel CLI:
   ```bash
   vercel env add ANTHROPIC_API_KEY production
   ```
4. After adding variables, trigger a redeploy for changes to take effect.

### Secret rotation

- Rotate `AUTH_SECRET` / `NEXTAUTH_SECRET`, `ANTHROPIC_API_KEY`, `HYBRID_RA_API_TOKEN`, `REGULA_API_KEY`, and `CRAWL_PUSH_SECRET` at least quarterly.
- After rotation: update Vercel env vars, then redeploy.
- For webhook secret rotation, update the sending hybrid-ra-saas deployment and receiving Regula deployment during the same maintenance window.

---

## Notes

- `NEXT_PUBLIC_*` variables are bundled into the client-side JavaScript. Do **not** use them for secrets.
- EU data residency (fra1 region) is prepared but **not yet activated**. No additional env vars are needed until activation.
- `lib/env.ts` validates required variables on startup using Zod (REQ-FND-010a). Missing required vars cause a build error.
