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
  const httpsRegex = /^https:\/\/([^\/]+)\/([^\/]+)\/([^\/]+?)(\.git)?$/;
  const httpsMatch = gitUrl.match(httpsRegex);
  if (httpsMatch) {
    return {
      host: httpsMatch[1]!,
      owner: httpsMatch[2]!,
      repo: httpsMatch[3]!,
    };
  }

  // SSH format: git@github.com:owner/repo(.git)
  const sshRegex = /^git@([^:]+):([^\/]+)\/([^\/]+?)(\.git)?$/;
  const sshMatch = gitUrl.match(sshRegex);
  if (sshMatch) {
    return {
      host: sshMatch[1]!,
      owner: sshMatch[2]!,
      repo: sshMatch[3]!,
    };
  }

  return null;
}
