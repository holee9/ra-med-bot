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

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env template and fill in values
cp .env.example .env.local

# 3. (Once schema lands in Phase 1) push the schema to your local Postgres
pnpm db:migrate

# 4. Verify the toolchain
pnpm typecheck
pnpm lint
pnpm test
```

`lib/env.ts` validates required variables on first import and throws a
`ZodError` listing every missing/invalid field — fix them in `.env.local`
before running any other command.

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
