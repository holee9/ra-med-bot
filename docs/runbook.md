# Regula Operations Runbook

> This runbook covers production deployment, incident response, and operational procedures for the Regula RA expert chatbot system (Vercel + Neon).

---

## 1. Deployment Procedure

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

### 1.2 Production Deployment

Regula deploys to Vercel via GitHub Actions on push to `main`.

**Manual deploy (emergency):**
```bash
vercel --prod
```

**Required environment variables** — see `docs/deployment/env-matrix.md` for full matrix.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key (ZDR mode enabled) |
| `NEXTAUTH_SECRET` | ✅ | Auth.js session signing secret |
| `NEXTAUTH_URL` | ✅ | Public canonical URL |
| `SENTRY_DSN` | ✅ | Sentry error tracking DSN |
| `LANGFUSE_PUBLIC_KEY` | ✅ | Langfuse observability public key |
| `LANGFUSE_SECRET_KEY` | ✅ | Langfuse observability secret key |

### 1.3 Post-Deployment Smoke Test

After every production deploy, run the smoke test:

```bash
BASE_URL=https://regula.app bash scripts/post-deploy-smoke.sh
```

Expected output: all checks passing with HTTP 200 responses and health indicators.

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
- Verify `NEXTAUTH_SECRET` matches in all environments
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

1. Immediately rotate `NEXTAUTH_SECRET` and `ANTHROPIC_API_KEY`
2. Check Sentry for PII exposure (beforeSend redaction should prevent this)
3. Check gitleaks scan results: `.github/workflows/security.yml`
4. Review `docs/security/pentest-plan.md` for scope and SLAs
5. Notify stakeholders per `docs/security/threat-model.md` response plan

---

*Last updated: 2026-05-03 | Regula v1.0.0*
