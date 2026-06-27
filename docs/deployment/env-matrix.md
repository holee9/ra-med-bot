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
| `AUTH_SECRET` | Auth.js v5 signing secret (≥32 chars) | Generated locally | Vercel secret | Vercel secret (rotate quarterly) | Yes |
| `NEXTAUTH_URL` | Canonical app URL for OAuth callbacks | `http://localhost:3000` | Auto-set by Vercel | `https://regula.example.com` | No |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key for chat inference | Test/personal key | Preview key | Production key | Yes |
| `OPENAI_API_KEY` | OpenAI API key (embedding/fallback/eval) | Required by runtime validation | Preview key | Production key | Yes |
| `AUTH_MICROSOFT_ID` | Azure AD / Entra ID client ID. `AUTH_MICROSOFT_ENTRA_ID` and `AZURE_AD_CLIENT_ID` are accepted aliases. | Local/test ID | Preview ID | Required if SSO enabled | Yes |
| `AUTH_MICROSOFT_SECRET` | Azure AD client secret | Optional | Optional | Required if SSO enabled | Yes |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Optional | Optional | Required if Google SSO | Yes |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Optional | Optional | Required if Google SSO | Yes |
| `NEXT_PUBLIC_LLM_MODEL_LABEL` | Optional UI label for selected LLM model | Optional | Optional | Optional | No |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking (public) | Empty / test DSN | Preview DSN | Production DSN | No |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (public) | Optional | Optional | Required | No |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host | `https://eu.i.posthog.com` | Same | Same | No |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key for LLM tracing | Optional | Optional | Required | Yes |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key | Optional | Optional | Required | No |
| `LANGFUSE_BASEURL` | Langfuse API base URL | `https://cloud.langfuse.com` | Same | Same | No |
| `ANTHROPIC_API_KEY_EVAL` | Separate Anthropic key for eval harness | Test key | Test key | Eval pipeline key | Yes |
| `HYBRID_RA_API_BASE_URL` | Base URL for outbound hybrid-ra-saas API calls from `createHybridRaClient()` | Optional local hybrid runtime URL | Preview hybrid API URL | Production hybrid API URL — T3610 로컬(.env.local)에 SET됨(실제 프로덕션). GitHub Actions Vercel 배포는 현재 Secrets 미설정으로 스킵. | No |
| `HYBRID_RA_API_TOKEN` | Bearer token for outbound hybrid-ra-saas API calls | Optional local token | Preview integration token | Production integration token — T3610 로컬(.env.local)에 SET됨(실제 프로덕션). GitHub Actions Vercel 배포는 현재 Secrets 미설정으로 스킵. | Yes |
| `HYBRID_RA_TENANT_ID` | Tenant scope sent as `X-Tenant-Id` to hybrid-ra-saas | Optional local tenant | Preview tenant ID | Production tenant ID — T3610 로컬(.env.local)에 SET됨(실제 프로덕션). GitHub Actions Vercel 배포는 현재 Secrets 미설정으로 스킵. | Yes |
| `REGULA_API_KEY` | Shared secret for `POST /api/webhooks/audit` and `POST /api/webhooks/ifu` from hybrid-ra-saas customer runtime | Optional local test secret | Preview webhook secret | Production webhook secret | Yes |
| `CRAWL_PUSH_SECRET` | Shared secret for `POST /api/webhooks/knowledge-sync` from hybrid-ra-saas cloud control plane | Optional local test secret | Preview crawl push secret | Production crawl push secret | Yes |
| `ROUTING_ENABLED` | Master switch for owning-project issue routing (#157). Default off. Set `true` to enable classifier + owning-issue creation + cross-link. | `false` | `false` | `true` (after owning repos configured) | No |
| `OWNING_ISSUE_GITHUB_TOKEN` | Issue-write PAT for the 4 owning-project repos (#157). Separate from `KNOWLEDGE_GAP_GITHUB_TOKEN` (triage) and `READ_GITHUB_TOKEN` (read-only). | Optional | Optional | Required when `ROUTING_ENABLED=true` | Yes |
| `OWNING_ISSUE_GITHUB_REPO_RA_PROJECT` | Target repo (`owner/name`) for regulation knowledge gaps routed to ra-project | Optional | Optional | `acme/ra-project` | No |
| `OWNING_ISSUE_GITHUB_REPO_MD_PROCESS` | Target repo for internal policy/process gaps routed to MD-process | Optional | Optional | `acme/MD-process` | No |
| `OWNING_ISSUE_GITHUB_REPO_GITEA_WIKI` | Target repo for wiki content gaps routed to gitea ra-llm-wiki | Optional | Optional | `acme/ra-llm-wiki` | No |
| `OWNING_ISSUE_GITHUB_REPO_HYBRID` | Target repo for backend/API bugs routed to hybrid-ra-saas | Optional | Optional | `acme/hybrid-ra-saas` | No |
| `READ_GITHUB_TOKEN` | Read-only PAT for source ingestion. Least privilege — never used for issue writes. | Optional | Optional | Required for FDA/EU MDR ingestion | Yes |
| `SKIP_ENV_VALIDATION` | Build-only validation bypass flag. Must be paired with `REGULA_ALLOW_ENV_VALIDATION_SKIP=build`. | Only for `pnpm build` | CI build only | CI build only | No |
| `REGULA_ALLOW_ENV_VALIDATION_SKIP` | Guard that makes the env validation bypass explicit for Next build route-data collection. | `build` only with `SKIP_ENV_VALIDATION=1` | `build` only | `build` only | No |

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

- Rotate `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `HYBRID_RA_API_TOKEN`, `REGULA_API_KEY`, and `CRAWL_PUSH_SECRET` at least quarterly.
- After rotation: update Vercel env vars, then redeploy.
- For webhook secret rotation, update the sending hybrid-ra-saas deployment and receiving Regula deployment during the same maintenance window.

---

## Notes

- `NEXT_PUBLIC_*` variables are bundled into the client-side JavaScript. Do **not** use them for secrets.
- EU data residency (fra1 region) is prepared but **not yet activated**. No additional env vars are needed until activation.
- `lib/env.ts` validates required variables on startup using Zod (REQ-FND-010a).
- `SKIP_ENV_VALIDATION=1` is allowed only for the explicit Next build path when `REGULA_ALLOW_ENV_VALIDATION_SKIP=build` is also set. Runtime commands must validate env normally.
- E2E CI can run without a checked-in `.env.test` when all required env vars are supplied by the workflow environment; `scripts/e2e-env.ts` falls back to process env in that case.
