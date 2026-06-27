// @MX:NOTE [AUTO] Owning-target → provider repo+token configuration map (Issue #157, #155).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC2/AC3/AC4 (REQ-KNOWLEDGE-GAP-006 extension)
// @MX:REASON External system integration point (per-target GitHub REST or Gitea API).
//
// Token separation (least privilege):
//   - KNOWLEDGE_GAP_GITHUB_TOKEN  — triage backlog issue-write (existing, #35)
//   - OWNING_ISSUE_GITHUB_TOKEN   — owning-project issue-write on GitHub-hosted targets (#157)
//   - GITEA_ISSUE_TOKEN           — owning-project issue-write on the Gitea-hosted wiki target (#155 AC4)
//   - READ_GITHUB_TOKEN           — read-only source ingestion (separate concern)
//   - GITEA_TOKEN                 — read-only Gitea wiki ingestion (AC3, separate from issue-write)
//
// Degrade-to-queue contract: when a target's repo OR token is unconfigured,
// `readOwningRepoConfig` returns `null` and the router falls back to 'queue'.
// The capture flow is never aborted by missing configuration.

import { isGiteaUrlAllowed } from '@/lib/gitea/url-guard';

/** The 4 owning-project targets + the queue fallback. Deterministic output of router.ts. */
export type OwningTarget = 'ra-project' | 'md-process' | 'gitea-wiki' | 'hybrid-ra-saas' | 'queue';

/** Which issue API dialect to speak. Drives endpoint path + response shape parsing. */
export type IssueProvider = 'github' | 'gitea';

/** Repo + token configuration for a single owning target. */
export interface OwningRepoConfig {
  repo: string;
  apiBase: string;
  token: string;
  /** 'gitea' → `/api/v1/repos/...` + `token <T>` auth; 'github' → `/repos/...` + `Bearer <T>`. */
  provider: IssueProvider;
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
 * Read the GitHub-hosted config for a target. Shared by ra-project / md-process /
 * hybrid-ra-saas. Returns null when repo or OWNING_ISSUE_GITHUB_TOKEN is unset.
 * https-only SSRF guard mirrors readRepoConfig() in github-issue.ts.
 */
function readGithubOwningConfig(target: Exclude<OwningTarget, 'queue'>): OwningRepoConfig | null {
  const env = OWNING_TARGET_ENV[target];
  const repo = process.env[env.repo] ?? '';
  const rawApiBase =
    process.env[`OWNING_ISSUE_GITHUB_API_BASE_${target.toUpperCase().replaceAll('-', '_')}`] ??
    'https://api.github.com';
  // SECURITY: reject non-https apiBase to prevent SSRF / PAT leak via Authorization header.
  const apiBase = rawApiBase.startsWith('https://') ? rawApiBase : 'https://api.github.com';
  const token = process.env.OWNING_ISSUE_GITHUB_TOKEN ?? '';
  if (!repo || !token) return null;
  return { repo, apiBase, token, provider: 'github' };
}

/**
 * Read the Gitea-hosted config for the 'gitea-wiki' target (AC4).
 *
 * The Gitea wiki target uses its own API base + write token, separated from
 * the GitHub-hosted targets:
 *   - apiBase ← GITEA_URL (e.g. `https://gitea.example.com`)
 *   - repo    ← GITEA_ISSUE_REPO ?? GITEA_WIKI_REPO (fall back to the wiki repo
 *              itself when the operator has not designated a separate issue repo)
 *   - token   ← GITEA_ISSUE_TOKEN (write scope; NEVER GITEA_TOKEN which is read-only)
 *
 * Returns null when any of the three is absent → router degrades to 'queue'.
 * The same https-only SSRF guard applies: Gitea tokens also travel as
 * Authorization headers and must never be sent to a non-https host.
 */
function readGiteaOwningConfig(): OwningRepoConfig | null {
  const rawApiBase = process.env.GITEA_URL ?? '';
  // `??` only skips null/undefined — but tests and operators sometimes clear env
  // vars to '' rather than deleting them. An empty GITEA_ISSUE_REPO must NOT
  // shadow a populated GITEA_WIKI_REPO, so fall through to the wiki repo when
  // the issue repo is blank.
  const issueRepo = process.env.GITEA_ISSUE_REPO ?? '';
  const repo = issueRepo || (process.env.GITEA_WIKI_REPO ?? '');
  const token = process.env.GITEA_ISSUE_TOKEN ?? '';
  if (!rawApiBase || !repo || !token) return null;
  // SECURITY: SSRF guard — Gitea tokens travel as Authorization headers and
  // must never be sent to a public untrusted HTTP host. The deployed Gitea is
  // typically an internal LAN host over plain HTTP (GITEA_URL=http://diskstation:7001),
  // so the policy allows https OR a private/internal host. See lib/gitea/url-guard.ts.
  if (!isGiteaUrlAllowed(rawApiBase)) return null;
  return { repo, apiBase: rawApiBase, token, provider: 'gitea' };
}

/**
 * Read the repo + token config for a target. Returns null when either the repo
 * or the relevant token is absent — callers MUST treat null as "target
 * unconfigured, degrade to queue" (REQ-DEGRADE-TO-QUEUE).
 *
 * Dispatch:
 *   - 'gitea-wiki' → Gitea provider (GITEA_URL / GITEA_ISSUE_TOKEN / GITEA_ISSUE_REPO)
 *   - all others   → GitHub provider (per-target repo env + OWNING_ISSUE_GITHUB_TOKEN)
 *
 * Mirrors readRepoConfig()'s https-only SSRF guard on BOTH paths.
 */
export function readOwningRepoConfig(
  target: Exclude<OwningTarget, 'queue'>,
): OwningRepoConfig | null {
  if (!OWNING_TARGET_ENV[target]) return null;
  // 'gitea-wiki' is the only Gitea-hosted target today. If an operator wants
  // to route it to a GitHub-hosted mirror instead, they simply leave
  // GITEA_ISSUE_TOKEN unset and set the standard OWNING_ISSUE_GITHUB_* vars —
  // but that configuration is unusual and not the documented path.
  if (target === 'gitea-wiki') {
    const giteaCfg = readGiteaOwningConfig();
    if (giteaCfg) return giteaCfg;
    // Fall through to GitHub config so a GitHub-mirrored wiki still works as a
    // secondary option without changing operator muscle memory.
  }
  return readGithubOwningConfig(target);
}
