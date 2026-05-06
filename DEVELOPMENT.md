# Regula — Development Guide

This document is the canonical onboarding reference for the Regula codebase.
For the product/architecture overview, see `RA-bot-design/design_handoff_regula/README.md`.

## Prerequisites

- **Node.js 20 LTS** or newer (`engines.node >= 20.0.0` in `package.json`)
- **pnpm 9.x** as the package manager (`packageManager: pnpm@9.12.0`)
  - Install via Corepack: `corepack enable && corepack prepare pnpm@9.12.0 --activate`
- **PostgreSQL 16** with the `pgvector` extension (local or via Supabase / Neon)
- A modern terminal — on Windows use Git Bash, WSL, or PowerShell 7+

Optional but recommended:
- **Biome VS Code extension** for in-editor lint/format feedback
- **Drizzle Studio** (`pnpm db:studio`) for browsing the schema

## Setup

1. `git clone https://github.com/holee9/ra-med-bot.git && cd ra-med-bot`
2. `pnpm install`
3. `pnpm dev:bootstrap` — generates `.env.local` with dev placeholders
4. Configure a PostgreSQL 16 + pgvector database and run `pnpm db:migrate`
5. `pnpm dev`

`lib/env.ts` validates required variables on first import and throws a
`ZodError` listing every missing/invalid field. The bootstrap script writes
`dev-placeholder-*` markers for secret values; replace them with real
credentials before the application talks to live LLM, SSO, or telemetry
providers. In production, `lib/env.ts` rejects any `dev-placeholder-*`
value so these markers cannot leak past local development.

## Development Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the Next.js 15 dev server at `http://localhost:3000` |
| `pnpm build` | Production build (`.next/`) |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` against `tsconfig.json` (strict mode) |
| `pnpm lint` | `biome check .` (lint + format check) |
| `pnpm lint:fix` | Apply Biome's safe fixes |
| `pnpm format` | Format only (no lint) |
| `pnpm db:generate` | Generate Drizzle migrations from `lib/db/schema.ts` |
| `pnpm db:migrate` | Push the schema to `DATABASE_URL` |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm test:e2e:setup` | Start local E2E DB, push schema, and seed deterministic smoke data |
| `pnpm test:e2e:local` | Run Playwright with `.env.test` loaded |

## Testing

Tests are organised by tier under `tests/`:

- `tests/unit/**` — pure logic, runs in Node (`vitest run`)
- `tests/integration/**` — exercises database / API boundaries
- `tests/e2e/**` — Playwright browser tests (`pnpm test:e2e`)

Run the suites with:

```bash
pnpm test          # unit + integration via Vitest
pnpm test:watch    # watch mode for TDD
pnpm test:e2e      # Playwright (requires `pnpm exec playwright install` once)
```

Coverage reports land in `coverage/` (HTML at `coverage/index.html`).
The TRUST 5 target is **>= 85%** on the `lib/` and `app/api/` directories.

### Local E2E Stack

#80 defines the local E2E prerequisite for #22 and later work.

1. Copy `.env.test.example` to `.env.test`.
2. Keep `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, and `PLAYWRIGHT_AUTH_STATE` unset unless a dedicated non-production SSO test account exists.
3. Run `pnpm test:e2e:setup`.
4. Run `pnpm test:e2e:local -- --project=chromium`.
5. Stop the DB with `pnpm db:test:down`.

Useful commands:

```bash
docker compose -f docker-compose.test.yml config
pnpm db:test:up
pnpm db:test:migrate
pnpm db:test:seed
pnpm test:e2e:local -- --project=chromium
pnpm db:test:down
```

Auth-dependent tests skip unless an auth state file is generated. Non-auth
smoke tests can run against the local dev server with the seeded database.

## Quality Gates

Regula uses a 17-step pre-flight pipeline before every production deploy:

```bash
pnpm preflight:fast   # format + lint + typecheck + test + build (local, ~2 min)
pnpm preflight        # all 17 steps including E2E and LLM eval (CI)
```

Local execution guard:

- Run potentially long commands with an explicit timeout and report progress before retrying.
- Do not leave watch-mode commands (`pnpm dev`, `pnpm test:watch`, Playwright UI) unattended.
- If a local `next build` hangs, record it as inconclusive instead of a pass and rely on CI build evidence until a bounded local run completes.
- In Windows shells where `git`, `node`, or `pnpm` are missing from `PATH`, verify the absolute tool path before starting validation.

Individual gate aliases:

| Alias | What it runs |
|-------|-------------|
| `pnpm tokens:check` | Token symmetry check (design tokens) |
| `pnpm modules:check` | Module boundary enforcement |
| `pnpm contrast:check` | WCAG 2.1 AA contrast ratio check |
| `pnpm i18n:check` | i18n key completeness |
| `pnpm a11y` | Axe accessibility E2E test |
| `pnpm rbac:check` | RBAC coverage check |
| `pnpm audit:check` | Regulatory citation completeness |
| `pnpm eval:ci` | LLM eval harness (promptfoo, 55 scenarios) |

## Architecture Overview

The system consists of:

1. **Next.js 15 App Router** — frontend + API routes (`app/api/ra/*`)
2. **RAG Pipeline** — intent → query rewrite → hybrid search → LLM citation
3. **Neon PostgreSQL + pgvector** — conversation, audit, and corpus storage
4. **Auth.js v5** — SSO authentication (SAML/OIDC)
5. **Vercel** — deployment (iad1 region, consult route nodejs runtime)

For system diagrams and data flow, see [`docs/architecture.md`](docs/architecture.md).

## Compliance Overview

Regula is designed for 21 CFR Part 11 compliance:

- **Append-only audit logs** — `audit_logs` table blocks UPDATE/DELETE/TRUNCATE
- **7-year retention** — enforced via partitioned table configuration
- **Expert review gating** — low-confidence answers require RA lead review
- **Citation enforcement** — every LLM claim links to a source document

For full compliance documentation, see [`docs/compliance.md`](docs/compliance.md).

## Troubleshooting

- **`ZodError` on startup** — `lib/env.ts` reports the missing field; copy
  `.env.example` to `.env.local` and fill it in.
- **`pnpm install` complains about the lockfile** — run
  `pnpm install --frozen-lockfile=false` once, then commit the updated
  `pnpm-lock.yaml`.
- **`pnpm db:migrate` fails with `extension "vector" does not exist`** — your
  Postgres instance is missing pgvector. Run
  `CREATE EXTENSION IF NOT EXISTS vector;` against the database referenced
  by `DATABASE_URL`.
- **Biome flags a hex colour** — that is intentional. Replace the literal
  with a Tailwind token (e.g. `bg-brand-800`) per the design tokens skill;
  raw `#rrggbb` is not allowed inside `app/`, `components/`, or `lib/`.
- **`Cannot find module '@/...'`** — verify the path alias matches
  `tsconfig.json` and `vitest.config.ts`. Restart the TS server after edits.
- **Next.js complains about `experimental.serverActions`** — Server Actions
  are GA in Next 15; only the `bodySizeLimit` sub-option is needed.
- **`promptfoo install` fails on Windows** — use `pnpm add -D promptfoo --ignore-scripts` to skip the better-sqlite3 native build. Core eval functionality is unaffected.
- **`preflight.sh` exits early** — run `bash scripts/preflight.sh --skip-e2e --skip-eval` to bypass optional steps during local dev.
