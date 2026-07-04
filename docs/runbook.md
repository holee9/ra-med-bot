# Regula Operations Runbook

> This runbook covers production deployment, incident response, and operational procedures for the Regula RA expert chatbot system (Vercel + Neon).

---

## 1. Deployment Procedure

### 1.0 Current Verified Baseline

| Item | State |
|---|---|
| Baseline commit | `8b3a983` |
| Branch | `main` |
| Latest CI | success |
| Latest Deploy workflow | success |
| Latest Security Scan | success |
| Playwright CI | success with browser test step skipped when staging URL is missing |
| Local E2E | #80 groundwork exists; full local DB + Playwright evidence still requires Docker Desktop engine |

For the full implementation review, see [`docs/implementation-status.md`](implementation-status.md).

### 1.0.1 T3610 Field Validation Access

Use this access order when validating the T3610-hosted app from an SSH session or another browser device.

| Priority | URL | Current use |
|---|---|---|
| 1 | `http://100.119.79.28:3000` | Tailscale validation path. Use this before Cloudflare Tunnel is healthy. |
| 2 | `http://192.168.100.200:3000` | LAN validation path when the browser device is on the same network. |
| 3 | `https://regula.abyz-lab.work/` | Public Cloudflare hostname. Use only after the tunnel connector is healthy. |

Current verified state on 2026-06-15 KST:

| Check | Result |
|---|---|
| Next.js listener | `0.0.0.0:3000`, `next-server` PID `1913371` |
| Tailscale IP | `100.119.79.28` |
| Tailscale HTTP check | `curl -I http://100.119.79.28:3000` returns `307` to `/login` |
| Public hostname check | `curl -I https://regula.abyz-lab.work/` returns `307` to `/login` |
| Cloudflare Tunnel host | `raspi5p` |
| Cloudflare Tunnel origin | `http://100.119.79.28:3000` |

Do not use `localhost` from a remote SSH client browser. `localhost` points to the user's local machine, not the T3610. For browser validation before Cloudflare is restored, use the Tailscale URL above.

Start the public validation server with:

```bash
pnpm dev:public
```

This command fails before binding `0.0.0.0:3000` when required runtime env values are
missing. Do not use `SKIP_ENV_VALIDATION=1` for `next dev` or `next start`; that bypass
is allowed only by the build script.

Before a full E2E pass, warm the public validation routes once to remove dev cold-compile
noise from latency measurements:

```bash
for path in / /chat /history /dashboard /predicate /workflows /workflows/dhf /admin/documents; do
  curl -I "http://100.119.79.28:3000$path"
done
```

Use these local validation targets unless a SPEC defines stricter thresholds:

| Surface | Warm target |
|---|---|
| HTML route | < 2s |
| Read API | < 500ms |
| LLM/SSE route | progress event visible, no silent stall |

### 1.0.2 Cloudflare 502 Triage for `regula.abyz-lab.work`

`Bad gateway Error code 502` with Cloudflare and browser both shown as working means the edge reached Cloudflare, but Cloudflare could not reach the origin path for `regula.abyz-lab.work`.

The current working topology is:

```text
Browser -> Cloudflare -> raspi5p cloudflared -> http://100.119.79.28:3000 -> T3610 Next.js
```

Run these checks from T3610 and `raspi5p`:

```bash
tailscale ip -4
ss -ltnp
curl -I http://100.119.79.28:3000
curl -I https://regula.abyz-lab.work/
ssh raspi5p 'systemctl is-active cloudflared'
ssh raspi5p 'sudo sed -n "/hostname: regula.abyz-lab.work/,+1p" /etc/cloudflared/config.yml'
```

Interpretation:

| Finding | Action |
|---|---|
| Tailscale URL returns `307 /login` but Cloudflare returns `502` | App is reachable; restore Cloudflare Tunnel/DNS origin mapping. |
| `raspi5p` tunnel rule points at `http://localhost:4000` | Change only the `regula.abyz-lab.work` ingress service to `http://100.119.79.28:3000` and restart `cloudflared`. |
| Tunnel is healthy but hostname still returns `502` | Verify `raspi5p` can `curl -I http://100.119.79.28:3000`; if not, fix Tailscale/LAN reachability to T3610. |
| Custom HTTPS hostname is restored | Set `NEXTAUTH_URL=https://regula.abyz-lab.work` and add OAuth redirect URI `https://regula.abyz-lab.work/api/auth/callback/google`, then restart the app. |

### 1.0.3 Planned T3610-Native Tunnel

The current `raspi5p` tunnel path is acceptable for browser validation because the Regula app still runs on T3610. For long-term operation, move the public hostname to a T3610-native Cloudflare connector:

```text
Browser -> Cloudflare -> T3610 cloudflared -> http://127.0.0.1:3000 -> T3610 Next.js
```

Track this migration in GitHub Issue #160. Do not remove the `raspi5p` ingress until the T3610 connector is healthy and `https://regula.abyz-lab.work/login` returns `200` through the T3610-native tunnel.

### 1.1 Pre-Deployment Checklist

Run the full pre-flight checklist before every production deployment:

```bash
# Full preflight (requires running server for E2E — use fast mode for local)
pnpm preflight:fast

# Full preflight with E2E and load tests (CI environment)
pnpm preflight
```

All 17 steps must pass. If any step fails, do not proceed to deployment.

If a local preflight/build command hangs, treat the local result as inconclusive, stop the runaway process, and use the GitHub Actions build result as the deployment gate. Do not mark `next build` as passing unless a bounded run completed.

Bounded local build procedure:

- Run local build checks with a 10-minute timeout.
- If the process exceeds the timeout or stays silent for more than 5 minutes, stop it and record the result as inconclusive.
- Check for orphan `node`, `next`, or `esbuild` processes before starting a second build attempt.
- Use the latest green GitHub Actions `CI` run on `main` as the authoritative build gate when local execution is inconclusive.
- Log locations: GitHub Actions run page > `CI Gates` > `Build` step, local terminal transcript, and the orphan-process command output below.

PowerShell cleanup check:

```powershell
Get-Process node,next,esbuild -ErrorAction SilentlyContinue
```

### 1.2 Deployment Automation

Regula deploys through `.github/workflows/deploy.yml`:

| Trigger | Target | Gate |
|---------|--------|------|
| Pull request to `main` | Vercel preview | `vercel-preview` output is passed to post-deploy smoke |
| Push to `main` | Cloudflare staging | Node.js 22 + Wrangler CLI; staging deploy is skipped with a notice when Cloudflare secrets are absent |
| `release/v*` publication | Vercel production | `production-vercel` environment approval |

Post-deploy smoke must receive a non-empty `BASE_URL`; the script fails fast instead of falling back to localhost. If a deploy job does not produce a URL, smoke is not triggered for that target.

**Manual deploy (emergency):**
```bash
vercel --prod
```

**Required environment variables** — see `docs/deployment/env-matrix.md` for full matrix.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key (ZDR mode enabled) |
| `AUTH_SECRET` | ✅ | Auth.js session signing secret |
| `NEXTAUTH_URL` | ✅ | Public canonical URL |
| `SENTRY_DSN` | ✅ | Sentry error tracking DSN |
| `LANGFUSE_PUBLIC_KEY` | ✅ | Langfuse observability public key |
| `LANGFUSE_SECRET_KEY` | ✅ | Langfuse observability secret key |

### 1.3 Post-Deployment Smoke Test

After every deploy, run the smoke test against the deployed URL:

```bash
BASE_URL=https://regula.app bash scripts/post-deploy-smoke.sh
```

Expected output: all checks passing with expected HTTP status codes, required security headers, and unauthenticated API checks returning 401.

---

## 2. Rollback Procedure

### 2.1 Instant Rollback (Vercel)

```bash
# List recent deployments
vercel ls --prod

# Rollback to previous deployment
vercel rollback [deployment-url]
```

Rollback completes in under 60 seconds. No database migration is reversed automatically.

### 2.2 Database Rollback

Regula uses append-only audit logs and forward-only migrations. If a migration must be reversed:

1. Identify the migration file in `db/migrations/`
2. Create a compensating migration (never delete the original)
3. Apply via `pnpm db:migrate`
4. Verify via `pnpm ci:migrations`

### 2.3 pgEnum ADD VALUE — drizzle-kit push limitation (Issue 321)

`drizzle-kit push` does **not** apply `ALTER TYPE ... ADD VALUE` (pgEnum ADD VALUE) statements automatically — it cannot introspect enum-value additions. Migrations adding enum values (e.g. `0105_inbox_approve_failed_audit.sql`) must be applied manually.

**Procedure** (when a migration contains `ALTER TYPE ... ADD VALUE`):
1. Detect: `grep -l 'ADD VALUE' migrations/*.sql` (CI `check-migrations` validates file shape but does not apply).
2. Apply manually against the target DB:
   ```bash
   docker exec regula-test-db psql -U postgres -d regula_test -f migrations/<NNNN>_*.sql
   # production: psql "$DATABASE_URL" -f migrations/<NNNN>_*.sql
   ```
3. Verify the enum value: `SELECT unnest(enum_range(NULL::audit_action));`
4. `pnpm ci:migrations` to confirm schema/migration parity.

**Future automation** (separate issue): extend `scripts/ci/check-migrations.ts` to detect `ADD VALUE` statements and emit a "manual apply required" hint, or wire a CI step that applies enum-bearing migrations via `psql` (not `drizzle-kit push`).

---

## 3. Incident Response

### 3.1 Severity Levels

| Level | Response Time | Examples |
|-------|--------------|---------|
| P1 — Critical | < 15 min | System down, data breach, auth failure |
| P2 — High | < 1 hour | RAG pipeline down, >50% error rate |
| P3 — Medium | < 4 hours | Slow responses, single corpus unavailable |
| P4 — Low | Next business day | UI glitches, non-critical warnings |

### 3.2 Incident Checklist

**Detection:**
- Check Sentry dashboard for error spikes
- Check Vercel deployment logs: `vercel logs --prod`
- Check Langfuse for LLM trace errors
- Check Neon dashboard for database issues

**Triage:**
```bash
# Check current deployment status
vercel ls --prod | head -5

# Check error rate in last 1 hour (via Sentry API or dashboard)
# Check LLM trace latency (Langfuse dashboard)
```

**Escalation:**
- P1/P2: Page on-call engineer immediately
- P3/P4: Create GitHub issue, assign to team

### 3.3 Common Issues

**Consult API timeout (>60s):**
- Check Langfuse for slow RAG retrievals
- Check pgvector index health in Neon
- Temporarily reduce `topK` in RAG config

**Authentication failure:**
- Verify `AUTH_SECRET` matches in all environments
- Check `NEXTAUTH_URL` is set correctly (no trailing slash)
- Verify OAuth provider credentials

**LLM eval failures:**
- Check `ANTHROPIC_API_KEY_EVAL` is set in CI secrets
- Check promptfoo version compatibility

---

## 4. Monitoring and Alerting

### 4.1 Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Vercel | vercel.com/dashboard | Deployment status, logs, functions |
| Sentry | sentry.io | Error tracking, performance |
| Langfuse | langfuse.com | LLM traces, eval scores |
| PostHog | posthog.com | Product analytics, feature flags |

### 4.2 Key Metrics

- **Consult first token p95** — target < 1500ms (k6 threshold)
- **Consult full response p95** — target < 8000ms (k6 threshold)
- **HTTP error rate** — target < 1%
- **LCP (Core Web Vitals)** — target < 2500ms p95

### 4.3 Alert Thresholds

Alerts fire when:
- Error rate exceeds 5% over 5-minute window → P2
- Consult API p95 exceeds 15s → P3
- Build failure on `main` → P2
- Dependency audit failure → P3

---

## 5. Maintenance Procedures

### 5.1 Regulatory Corpus Update

When FDA/EU MDR/MFDS/NMPA/PMDA guidance documents are updated:

```bash
# Trigger corpus re-ingestion (see SPEC-REGULA-CORPUS-001)
pnpm seed:fda    # FDA corpus
pnpm db:migrate  # Apply any schema changes
```

Re-run LLM eval after corpus update:
```bash
pnpm eval:ci
```

### 5.2 Dependency Updates

```bash
# Check for vulnerabilities
pnpm audit --audit-level=high

# Update dependencies (review changelog before major bumps)
pnpm update

# Run full preflight after updates
pnpm preflight:fast
```

### 5.3 Database Maintenance (Neon)

- Neon handles automatic vacuuming and backups
- Point-in-time recovery: available for 7 days (Pro tier)
- Connection pooling: handled by Neon's built-in pooler

---

## 6. Compliance and Audit

### 6.1 Audit Log Access

Audit logs are stored in the `audit_logs` table. They are **append-only** (no UPDATE/DELETE/TRUNCATE allowed).

```sql
-- View recent audit entries (read-only connection recommended)
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100;
```

### 6.2 21 CFR Part 11 Compliance

- Audit logs retain for 7 years minimum
- All LLM responses include citation tracking
- Expert review gating for low-confidence answers
- User actions are logged with timestamp and user ID

See `docs/compliance.md` for full compliance documentation.

### 6.3 Security Incident Response

If a security incident is suspected:

1. Immediately rotate `AUTH_SECRET` and `ANTHROPIC_API_KEY`
2. Check Sentry for PII exposure (beforeSend redaction should prevent this)
3. Check gitleaks scan results: `.github/workflows/security.yml`
4. Review `docs/security/pentest-plan.md` for scope and SLAs
5. Notify stakeholders per `docs/security/threat-model.md` response plan

---

## 7. Architecture Documentation (2026-06-17)

### 7.1 Codebase Overview

**Current System Scale**:
- TypeScript files: 377
- API routes: 67
- Database tables: 18
- lib modules: 27
- components categories: 11

**Key Architecture Components**:
- **Frontend**: Next.js 15 App Router with React 18
- **Backend**: Next.js Route Handlers with Drizzle ORM
- **Database**: PostgreSQL 16 + pgvector extension
- **AI/ML**: Multi-LLM strategy (Sonnet 4.5 + Haiku 4.5)
- **RAG Pipeline**: Hybrid retrieval (pgvector + FTS) with citation enforcement

### 7.2 Documentation Structure

**Architecture Documentation**:
- `.moai/project/codemaps/overview.md` - System boundaries and patterns
- `.moai/project/codemaps/modules.md` - 12 core modules detailed
- `.moai/project/codemaps/dependencies.md` - 110+ dependencies breakdown
- `.moai/project/codemaps/entry-points.md` - 67 API routes catalogued
- `.moai/project/codemaps/data-flow.md` - RAG pipeline and data flows

**Operational Documentation**:
- `README.md` - Project overview and quick start
- `docs/architecture.md` - Detailed system architecture
- `docs/implementation-status.md` - Implementation baseline and status
- `docs/runbook.md` - This operational runbook

### 7.3 Recent Updates

**2026-06-17 Documentation Refresh**:
- ✅ README.md - Added codebase analysis section
- ✅ docs/architecture.md - Enhanced with latest metrics
- ✅ docs/implementation-status.md - Updated with documentation status
- ✅ docs/runbook.md - Added architecture documentation section
- ✅ `.moai/project/codemaps/` - All 5 codemap files updated with 2026-06-17 timestamp

---

## Re-seed local corpus

When the ra-project or MD-process SOPs change, re-seed the local corpus so
citations reflect the latest content. Each re-seed writes fresh provenance
fields (migration 0059) so citations remain reproducible.

```bash
# 1. Set the env vars (required in production, dev falls back with a warning)
export RA_PROJECT_PATH=/path/to/ra-project
export MD_PROCESS_PATH=/path/to/MD-process
export DATABASE_URL=postgresql://user:pass@localhost:5432/regula
export OPENAI_API_KEY=sk-...   # optional; FTS-only mode if absent

# 2. Run the seed script
pnpm tsx scripts/seed-local-docs.ts
```

The script upserts `sources` rows (reusing existing rows by title) and inserts
fresh `source_sections` with a new `ingestion_run_id` on each run. Duplicate
`(source_id, anchor)` rows are skipped (unique constraint).

See [docs/knowledge-source-boundary.md](./knowledge-source-boundary.md) for the
provenance column contract.

---

*Last updated: 2026-06-17 | Regula v1.0.0*
