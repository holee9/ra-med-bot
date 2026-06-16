# DNS and Domain Configuration Guide

**SPEC**: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-039)  
**Last Updated**: 2026-05-03

This guide covers DNS configuration, custom domain setup, HTTPS/TLS, and HSTS for Regula.
The production-style Vercel path remains documented below. T3610 field validation uses
Tailscale first, then Cloudflare Tunnel when the connector is healthy.

---

## Overview

Regula has three domain/access paths:

| Path | URL | Purpose |
|---|---|---|
| T3610 validation | `http://100.119.79.28:3000` | Browser validation before Cloudflare Tunnel is connected. |
| T3610 public hostname | `https://regula.abyz-lab.work/` | Cloudflare-proxied hostname for real-user validation after tunnel recovery. |
| Vercel production path | project custom domain | Managed production deployment path. |

For Vercel-hosted production, Vercel handles TLS certificate provisioning automatically via
Let's Encrypt. The primary steps are:

1. Add the custom domain in Vercel.
2. Create the CNAME record at your DNS provider.
3. Verify ownership (Vercel checks propagation automatically).
4. Enable HSTS and apply for HSTS preloading (post-launch hardening).

---

## T3610 Cloudflare Tunnel for `regula.abyz-lab.work`

Before the Cloudflare Tunnel is healthy, validate the app in a browser through Tailscale:

```bash
tailscale ip -4
# Current T3610 value: 100.119.79.28
```

Open:

```text
http://100.119.79.28:3000
```

The local app must listen on all interfaces:

```bash
pnpm dev:public
```

`pnpm dev:public` validates `.env.local`-backed runtime variables before opening the
public listener. Do not start public validation with `SKIP_ENV_VALIDATION=1`; runtime
env bypass is reserved for `next build` only and will fail fast in app startup code.

Current field status recorded on 2026-06-15 KST:

| Check | Result |
|---|---|
| `http://100.119.79.28:3000` | Reachable; redirects to `/login` |
| `https://regula.abyz-lab.work/` | Reachable through Cloudflare; redirects to `/login` |
| Cloudflare Tunnel host | `raspi5p` |
| Cloudflare Tunnel service | `cloudflared.service` active |
| Cloudflare Tunnel origin | `http://100.119.79.28:3000` |

The current working topology is:

```text
Browser -> Cloudflare -> raspi5p cloudflared -> http://100.119.79.28:3000 -> T3610 Next.js
```

This topology is a validation bridge. The planned steady-state topology is tracked in GitHub Issue #160:

```text
Browser -> Cloudflare -> T3610 cloudflared -> http://127.0.0.1:3000 -> T3610 Next.js
```

Keep the `raspi5p` ingress in place until the T3610 connector is installed, healthy, and smoke-tested.

To restore the public hostname after a 502 regression, update the existing `raspi5p` Cloudflare Tunnel ingress rule:

| Field | Value |
|---|---|
| Public hostname | `regula.abyz-lab.work` |
| Service type | `HTTP` |
| Service URL | `http://100.119.79.28:3000` |

On `raspi5p`, the rule should look like:

```yaml
- hostname: regula.abyz-lab.work
  service: http://100.119.79.28:3000
```

After editing `/etc/cloudflared/config.yml`, restart the connector:

```bash
ssh raspi5p 'sudo systemctl restart cloudflared && systemctl is-active cloudflared'
```

After the connector shows Healthy in Cloudflare Zero Trust, verify:

```bash
curl -I http://100.119.79.28:3000/
curl -I https://regula.abyz-lab.work/
```

Expected result is no Cloudflare `502`; unauthenticated app access should redirect to `/login` or return the configured login page.

If Google OAuth is used through the public hostname, also set:

```bash
NEXTAUTH_URL=https://regula.abyz-lab.work
```

and add this redirect URI in Google Cloud Console:

```text
https://regula.abyz-lab.work/api/auth/callback/google
```

---

## Step 1 — Add Custom Domain in Vercel

1. Open **Vercel Dashboard → Project → Settings → Domains**.
2. Click **Add Domain**.
3. Enter your domain (e.g., `regula.example.com`).
4. Vercel shows the required DNS record (CNAME or A record).

---

## Step 2 — CNAME Record

For apex domains (`example.com`) Vercel recommends using an A record or ALIAS record.
For subdomains (`app.example.com`, `regula.example.com`) use a CNAME record.

### CNAME configuration

| Type | Host / Name | Value | TTL |
|------|-------------|-------|-----|
| `CNAME` | `regula` (or `@` for apex via ALIAS) | `cname.vercel-dns.com` | 3600 |

> **Note**: Some DNS providers do not support CNAME on apex domains. Use ALIAS or ANAME
> if your provider supports it, or use Vercel's A record (`76.76.21.21`) as fallback.

### Vercel A record (apex fallback)

| Type | Host | Value | TTL |
|------|------|-------|-----|
| `A` | `@` | `76.76.21.21` | 3600 |

---

## Step 3 — Verify and Wait for Propagation

- DNS propagation can take up to 48 hours (typically under 1 hour).
- Vercel automatically issues a TLS certificate once the domain is verified.
- Check status in **Vercel Dashboard → Project → Settings → Domains** — the domain shows
  a green checkmark when active.

You can also check via CLI:

```bash
# Verify CNAME resolution
nslookup regula.example.com

# Verify TLS certificate
curl -I https://regula.example.com
```

---

## Step 4 — SSL/TLS Certificate

Vercel provisions TLS certificates automatically via **Let's Encrypt** at no cost.

- Certificates are renewed automatically before expiry.
- TLS 1.2 minimum is enforced by Vercel's edge network.
- No manual certificate management is needed.

To check certificate details:

```bash
openssl s_client -connect regula.example.com:443 -servername regula.example.com </dev/null \
  | openssl x509 -noout -dates
```

---

## Step 5 — HSTS (HTTP Strict Transport Security)

### What is HSTS?

HSTS instructs browsers to only communicate with the domain over HTTPS. The
`Strict-Transport-Security` response header must be present and must have a `max-age`
of at least 1 year (31536000 seconds).

### Enable HSTS in Vercel

Add the `Strict-Transport-Security` header in `vercel.json` under the `headers` key:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

> **Important**: The `preload` directive should only be added **after** the domain is
> fully operational on HTTPS and you are ready to submit to the HSTS preload list.

### HSTS Preload Submission (Post-launch)

After the site has been live on HTTPS with a valid HSTS header for at least 30 days:

1. Verify your site at [hstspreload.org](https://hstspreload.org).
2. Ensure the header includes `max-age=31536000; includeSubDomains; preload`.
3. Submit the domain using the form at hstspreload.org.
4. Preloading takes 2–4 weeks to propagate to all browsers.

> This step is **post-launch hardening** and not required for initial go-live.

---

## Step 6 — Vercel Domain Verification

Vercel may request a TXT record to verify domain ownership:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| `TXT` | `_vercel` | `<token from Vercel Dashboard>` | 3600 |

The token is shown in the Vercel domain settings when domain verification is needed.

---

## EU Region (Post-launch)

The Vercel project is configured with `fra1` (Frankfurt) region settings for EU data
residency compliance. This region is **not yet activated** for production.

When activating:
1. Update **Vercel Dashboard → Project → Settings → Functions → Region** to `fra1`.
2. Ensure `DATABASE_URL` points to a PostgreSQL instance in the EU region.
3. Redeploy after region change.

No DNS changes are required for region switching — Vercel handles routing internally.

---

## Checklist

- [ ] Custom domain added in Vercel Dashboard
- [ ] CNAME (or A/ALIAS) record created at DNS provider
- [ ] DNS propagation confirmed (green checkmark in Vercel)
- [ ] TLS certificate issued (HTTPS works in browser)
- [ ] `Strict-Transport-Security` header present in HTTP response
- [ ] HSTS preload submission (post-launch, 30+ days after go-live)

---

## References

- [Vercel Custom Domains documentation](https://vercel.com/docs/projects/domains)
- [HSTS Preload List](https://hstspreload.org)
- [Let's Encrypt](https://letsencrypt.org)
