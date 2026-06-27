// @MX:ANCHOR [AUTO] Shared Gitea URL allow-policy (SSRF guard) for issue + read paths.
// @MX:REASON fan_in = 2 (owning-repos.ts issue-write path, ingest-gitea-wiki.ts
//   read path). The Gitea token always travels as an Authorization header —
//   a non-https apiBase would leak it over the wire to an attacker-controlled
//   or passive-listening host. BUT the deployed Gitea is an internal LAN host
//   over plain HTTP (GITEA_URL=http://diskstation:7001 per .env.example),
//   so a blanket https-only rejection silently disables the entire integration.
//   The policy below preserves the SSRF guard for the real threat surface
//   (public untrusted HTTP) while allowing trusted-internal HTTP.
//   Dependency-free by design: no DB, logger, or env imports.

/**
 * True if `url` is a host we trust to receive a Gitea token over plain HTTP.
 * The LAN-host allowlist mirrors operator-deployed patterns:
 *
 *   - `localhost` / `127.0.0.1` / `::1` — local dev + sidecar Gitea.
 *   - `diskstation` — the documented Synology NAS host in .env.example:89.
 *   - `*.local` / `*.internal` — mDNS + RFC 8375 home/enterprise patterns.
 *   - Private IPv4 ranges (10/8, 172.16/12, 192.168/16, 127/8).
 *   - Link-local + unique-local IPv6 (fe80::/10, fc00::/7 incl. fd00::/8).
 *
 * Public HTTP hosts (e.g. `http://evil.example.com`) are NOT internal and
 * fall through to the caller's rejection path — the SSRF guard is preserved
 * where the threat is real.
 *
 * Parsing is deliberately defensive: an unparseable URL returns false so the
 * caller rejects rather than silently allowing.
 */
export function isInternalHost(rawUrl: string): boolean {
  let host: string;
  try {
    const u = new URL(rawUrl);
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;

  // IPv6 loopback + link-local + unique-local (strip brackets).
  const v6 = host.replace(/^\[|\]$/g, '');
  if (v6 === '::1') return true;
  if (v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) return true;

  // IPv4 private ranges.
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  const m172 = /^172\.(\d+)\./.exec(host);
  if (m172) {
    const sub = Number(m172[1]);
    if (sub >= 16 && sub <= 31) return true;
  }

  // Hostname allowlist (literal + suffix matches).
  if (host === 'localhost') return true;
  if (host === 'diskstation') return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;

  return false;
}

/**
 * Policy predicate: is `rawUrl` an allowed Gitea apiBase?
 *
 *   - `https://*` always allowed (encrypted wire — token safe).
 *   - internal host over any scheme allowed (trusted LAN — token acceptable
 *     per operator deployment; the LAN segment is the trust boundary).
 *
 * Returns false for public untrusted HTTP (the SSRF threat surface).
 */
export function isGiteaUrlAllowed(rawUrl: string): boolean {
  if (!rawUrl) return false;
  if (rawUrl.startsWith('https://')) return true;
  return isInternalHost(rawUrl);
}

/**
 * Throw a clear Error if `rawUrl` is not an allowed Gitea apiBase.
 * Used by both the issue-write path and the read path so neither can drift
 * away from the shared policy. The message is intentionally generic (no
 * raw URL echoed — it may carry query-string secrets) and free of PII.
 */
export function assertGiteaUrlAllowed(rawUrl: string): void {
  if (!isGiteaUrlAllowed(rawUrl)) {
    throw new Error(
      'Gitea URL rejected by SSRF guard: must be https OR an internal/private host. ' +
        'Public untrusted HTTP is not allowed because the Gitea token travels as an ' +
        'Authorization header.',
    );
  }
}
