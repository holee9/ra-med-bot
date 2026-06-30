// @MX:NOTE [AUTO] Git URL parser — extracts host, owner, repo from HTTPS/SSH URLs.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

/**
 * Parsed Git URL components.
 */
export interface ParsedGitUrl {
  host: string;
  owner: string;
  repo: string;
}

/**
 * Parse a Git URL into its components.
 * Supports both HTTPS and SSH formats:
 * - HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
 * - SSH: git@github.com:owner/repo.git or git@github.com:owner/repo
 *
 * @param gitUrl - The Git URL to parse
 * @returns Parsed components or null if invalid
 */
export function parseGitUrl(gitUrl: string): ParsedGitUrl | null {
  if (!gitUrl) return null;

  // HTTPS format: https://github.com/owner/repo(.git)
  // Regex has exactly 3 capturing groups; on a successful match, indices 1-3
  // are guaranteed-defined strings. Guards below keep the type system honest
  // without changing runtime behavior.
  const httpsRegex = /^https:\/\/([^\/]+)\/([^\/]+)\/([^\/]+?)(\.git)?$/;
  const httpsMatch = gitUrl.match(httpsRegex);
  const httpsHost = httpsMatch?.[1];
  const httpsOwner = httpsMatch?.[2];
  const httpsRepo = httpsMatch?.[3];
  if (httpsHost && httpsOwner && httpsRepo) {
    return { host: httpsHost, owner: httpsOwner, repo: httpsRepo };
  }

  // SSH format: git@github.com:owner/repo(.git)
  const sshRegex = /^git@([^:]+):([^\/]+)\/([^\/]+?)(\.git)?$/;
  const sshMatch = gitUrl.match(sshRegex);
  const sshHost = sshMatch?.[1];
  const sshOwner = sshMatch?.[2];
  const sshRepo = sshMatch?.[3];
  if (sshHost && sshOwner && sshRepo) {
    return { host: sshHost, owner: sshOwner, repo: sshRepo };
  }

  return null;
}
