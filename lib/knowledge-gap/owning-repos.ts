// @MX:NOTE [AUTO] Owning-target → GitHub repo+token configuration map (Issue #157).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC2/AC3 (REQ-KNOWLEDGE-GAP-006 extension)
// @MX:REASON External system integration point (per-target GitHub REST API).
//
// Token separation (least privilege):
//   - KNOWLEDGE_GAP_GITHUB_TOKEN  — triage backlog issue-write (existing, #35)
//   - OWNING_ISSUE_GITHUB_TOKEN   — owning-project issue-write (NEW, #157)
//   - READ_GITHUB_TOKEN           — read-only source ingestion (separate concern)
//
// Degrade-to-queue contract: when a target's repo OR token is unconfigured,
// `readOwningRepoConfig` returns `null` and the router falls back to 'queue'.
// The capture flow is never aborted by missing configuration.

/** The 4 owning-project targets + the queue fallback. Deterministic output of router.ts. */
export type OwningTarget = 'ra-project' | 'md-process' | 'gitea-wiki' | 'hybrid-ra-saas' | 'queue';

/** Repo + token configuration for a single owning target. */
export interface OwningRepoConfig {
  repo: string;
  apiBase: string;
  token: string;
}

/**
 * Env var name → owning target. Single source of truth so router + owning-issue
 * agree on the mapping without a circular import.
 */
const OWNING_TARGET_ENV: Record<Extract<OwningTarget, string>, { repo: string; label: string }> = {
  'ra-project': { repo: 'OWNING_ISSUE_GITHUB_REPO_RA_PROJECT', label: 'ra-project' },
  'md-process': { repo: 'OWNING_ISSUE_GITHUB_REPO_MD_PROCESS', label: 'md-process' },
  'gitea-wiki': { repo: 'OWNING_ISSUE_GITHUB_REPO_GITEA_WIKI', label: 'gitea-wiki' },
  'hybrid-ra-saas': { repo: 'OWNING_ISSUE_GITHUB_REPO_HYBRID', label: 'hybrid-ra-saas' },
  queue: { repo: '', label: 'queue' },
};

/**
 * Read the repo + token config for a target. Returns null when either the repo
 * or the shared OWNING_ISSUE_GITHUB_TOKEN is absent — callers MUST treat null
 * as "target unconfigured, degrade to queue" (REQ-DEGRADE-TO-QUEUE).
 *
 * Mirrors readRepoConfig()'s https-only SSRF guard: a non-https apiBase is
 * rejected and the canonical https://api.github.com endpoint is substituted,
 * preventing authenticated requests toward attacker-controlled hosts.
 */
export function readOwningRepoConfig(
  target: Exclude<OwningTarget, 'queue'>,
): OwningRepoConfig | null {
  const env = OWNING_TARGET_ENV[target];
  if (!env) return null;
  const repo = process.env[env.repo] ?? '';
  // Per-target API base override is optional; defaults to canonical GitHub.
  // .replaceAll handles multi-hyphen targets like 'hybrid-ra-saas' → 'HYBRID_RA_SAAS'.
  const rawApiBase =
    process.env[`OWNING_ISSUE_GITHUB_API_BASE_${target.toUpperCase().replaceAll('-', '_')}`] ??
    'https://api.github.com';
  // SECURITY: reject non-https apiBase to prevent SSRF / PAT leak via Authorization header.
  const apiBase = rawApiBase.startsWith('https://') ? rawApiBase : 'https://api.github.com';
  const token = process.env.OWNING_ISSUE_GITHUB_TOKEN ?? '';
  if (!repo || !token) return null;
  return { repo, apiBase, token };
}
