// @MX:ANCHOR [AUTO] GitHub Issue automation for knowledge gaps — create + append.
// @MX:REASON External system integration point (GitHub REST API). fan_in will reach 3+
//          (capture flow on new cluster, append flow on existing cluster, replay resolve).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-005, REQ-006, REQ-007, REQ-015, Issue #35)
//
// Design reference: design.md §3 (loop flow) and §7.2 (GitHub API Integration).
//   - Labels (REQ-KNOWLEDGE-GAP-007): knowledge-gap, ra-auto, needs-classification.
//   - Issue body (REQ-KNOWLEDGE-GAP-006): question summary, failure reason, missing-source
//     candidates, conversation/message ids, redaction_hash. PII is ALREADY redacted by
//     the detector before this code ever sees the question.
//
// Client strategy: there is NO existing GitHub client in this repo (verified by search).
// Adding @octokit/rest would touch package.json + lockfile for only 2 endpoints (create
// issue, create comment). Instead we use plain fetch against the stable GitHub REST API,
// behind an injectable GitHubIssuesClient interface so tests mock it without hitting the
// network. Configuration lives in env vars:
//   - KNOWLEDGE_GAP_GITHUB_TOKEN  (PAT with `repo` scope; never logged)
//   - KNOWLEDGE_GAP_GITHUB_REPO   (e.g. "acme/regula-knowledge-backlog")
//   - KNOWLEDGE_GAP_GITHUB_API_BASE (optional; defaults to https://api.github.com)
// When the token is absent, the functions short-circuit and return null so the RAG
// pipeline still succeeds — GitHub tracking is a best-effort ops convenience, not a
// safety gate. The audit log records the no-op so the SLA dashboard can flag it.

import { writeAudit } from '@/lib/kernel/audit';

/** Labels applied to every auto-created knowledge-gap issue (REQ-KNOWLEDGE-GAP-007). */
export const KNOWLEDGE_GAP_LABELS = ['knowledge-gap', 'ra-auto', 'needs-classification'] as const;

/** Context needed to create or append a GitHub issue for a gap. */
export interface GapIssueContext {
  /** PII-free question (already redacted by detector). */
  redactedQuestion: string;
  /** SHA-256 of the ORIGINAL question — for de-dup, not for display. */
  redactionHash: string;
  /** Machine reason enum (low_confidence | low_citation | no_results | policy_blocked). */
  reason: string;
  /** Cluster id this gap belongs to. */
  clusterId: string;
  /** For the body's traceability section. */
  conversationId: string;
  messageId: string;
}

/** Injectable GitHub client — production uses fetchGitHubClient, tests pass a mock. */
export interface GitHubIssuesClient {
  /** Create a new issue. Returns the issue number from GitHub. */
  createIssue(params: {
    title: string;
    body: string;
    labels: readonly string[];
  }): Promise<{ number: number; htmlUrl: string }>;
  /** Add a comment to an existing issue. */
  createComment(params: { issueNumber: number; body: string }): Promise<{ htmlUrl: string }>;
}

/** Read repo config once per call so tests can stub process.env per-case. */
function readRepoConfig(): { repo: string; apiBase: string; hasToken: boolean } {
  const repo = process.env.KNOWLEDGE_GAP_GITHUB_REPO ?? '';
  const rawApiBase = process.env.KNOWLEDGE_GAP_GITHUB_API_BASE ?? 'https://api.github.com';
  // SECURITY (M2 fix): reject non-https apiBase to prevent SSRF — an operator who
  // points KNOWLEDGE_GAP_GITHUB_API_BASE at http:// or a file:// / ldap:// style
  // URL would otherwise cause the server to issue authenticated requests toward
  // an attacker-controlled host (the PAT would leak in the Authorization header).
  // Default to the canonical https GitHub endpoint when the env value is invalid.
  const apiBase = rawApiBase.startsWith('https://') ? rawApiBase : 'https://api.github.com';
  const hasToken = Boolean(process.env.KNOWLEDGE_GAP_GITHUB_TOKEN);
  return { repo, apiBase, hasToken };
}

/**
 * Default client backed by the GitHub REST API via fetch.
 * When GitHub is not configured (no token/repo), methods return null so callers
 * treat it as a best-effort no-op rather than crashing the RAG pipeline.
 */
export const fetchGitHubClient: GitHubIssuesClient = {
  async createIssue({ title, body, labels }) {
    const { repo, apiBase, hasToken } = readRepoConfig();
    if (!repo || !hasToken) return NULL_GITHUB_RESULT;
    const res = await fetch(`${apiBase}/repos/${repo}/issues`, {
      method: 'POST',
      headers: githubHeaders(),
      body: JSON.stringify({ title, body, labels: [...labels] }),
    });
    if (!res.ok) throw new Error(`GitHub createIssue failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { number: number; html_url: string };
    return { number: json.number, htmlUrl: json.html_url };
  },
  async createComment({ issueNumber, body }) {
    const { repo, apiBase, hasToken } = readRepoConfig();
    if (!repo || !hasToken) return { htmlUrl: '' };
    const res = await fetch(`${apiBase}/repos/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: githubHeaders(),
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitHub createComment failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { html_url: string };
    return { htmlUrl: json.html_url };
  },
};

/**
 * Sentinel for "GitHub unconfigured" so callers can detect a no-op consistently.
 * createIssue returns this when KNOWLEDGE_GAP_GITHUB_TOKEN/REPO are absent; the
 * orchestration helpers translate it to `null` in their public return type.
 */
const NULL_GITHUB_RESULT = { number: -1, htmlUrl: '' };

function githubHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.KNOWLEDGE_GAP_GITHUB_TOKEN ?? ''}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function buildIssueTitle(ctx: GapIssueContext): string {
  // Truncate to keep issue lists readable; redacted text is already PII-free.
  const snippet =
    ctx.redactedQuestion.length > 80
      ? `${ctx.redactedQuestion.slice(0, 80)}…`
      : ctx.redactedQuestion;
  return `[knowledge-gap][${ctx.reason}] ${snippet}`;
}

function buildIssueBody(ctx: GapIssueContext): string {
  // REQ-KNOWLEDGE-GAP-006: question summary, failure reason, traceability, redaction hash.
  // No PII: redactedQuestion is already filtered, and we never include the original.
  return [
    '### Unanswered question (auto-captured)',
    '',
    `> [redacted] ${ctx.redactedQuestion}`,
    '',
    `**Failure reason:** \`${ctx.reason}\``,
    `**Cluster:** \`${ctx.clusterId}\``,
    '',
    '### Traceability',
    '',
    `- Conversation: \`${ctx.conversationId}\``,
    `- Message: \`${ctx.messageId}\``,
    `- Redaction hash: \`${ctx.redactionHash}\``,
    '',
    '_This issue was created automatically by Regula knowledge-gap detection. ' +
      'The question text has been PII-redacted before capture._',
  ].join('\n');
}

/**
 * Create a new GitHub issue for a new gap cluster (REQ-KNOWLEDGE-GAP-006, REQ-007).
 * Returns the issue number, or null if GitHub is not configured (no-op).
 *
 * The caller MUST persist the returned number on the unanswered_queue row so that
 * subsequent similar gaps can append to this issue via appendGitHubIssue().
 */
export async function createGitHubIssue(
  ctx: GapIssueContext,
  client: GitHubIssuesClient = fetchGitHubClient,
): Promise<{ number: number; htmlUrl: string } | null> {
  const created = await client.createIssue({
    title: buildIssueTitle(ctx),
    body: buildIssueBody(ctx),
    labels: KNOWLEDGE_GAP_LABELS,
  });
  // The default client signals "unconfigured" via the sentinel; a custom client
  // always returns a real issue number, so this branch is a no-op for it.
  if (created.number < 0) return null;
  return created;
}

/**
 * Append a comment to an existing issue when a new gap joins an existing cluster
 * (REQ-KNOWLEDGE-GAP-005). Returns the comment URL, or null if GitHub is not
 * configured.
 */
export async function appendGitHubIssue(
  issueNumber: number,
  ctx: GapIssueContext,
  client: GitHubIssuesClient = fetchGitHubClient,
): Promise<{ htmlUrl: string } | null> {
  const body = [
    '### Additional occurrence of this knowledge gap',
    '',
    `> [redacted] ${ctx.redactedQuestion}`,
    '',
    `**Reason this time:** \`${ctx.reason}\``,
    `- Message: \`${ctx.messageId}\``,
    `- Redaction hash: \`${ctx.redactionHash}\``,
  ].join('\n');

  const result = await client.createComment({ issueNumber, body });
  // Empty htmlUrl is the default client's "unconfigured" sentinel.
  return result.htmlUrl === '' ? null : result;
}

/**
 * Post a resolution comment on an existing issue when replay passes
 * (REQ-KNOWLEDGE-GAP-015). Best-effort — never throws into the replay flow.
 */
export async function commentGapResolved(
  issueNumber: number,
  evidence: { answerWithCitations: string; sourceTitles: string[] },
  client: GitHubIssuesClient = fetchGitHubClient,
): Promise<void> {
  try {
    const body = [
      '### Resolved via KB augmentation',
      '',
      'Replay test passed — the knowledge base now answers this question with citations.',
      '',
      '**Cited sources:**',
      ...evidence.sourceTitles.map((t) => `- ${t}`),
      '',
      '<details><summary>Replay answer (redacted)</summary>',
      '',
      evidence.answerWithCitations.slice(0, 4000),
      '',
      '</details>',
    ].join('\n');

    const result = await client.createComment({ issueNumber, body });
    // htmlUrl === '' means GitHub is unconfigured — nothing to audit-fail, just exit.
    if (result.htmlUrl === '') return;
  } catch (err) {
    // Best-effort: resolution must not fail because GitHub is down.
    await writeAudit({
      actor_id: null,
      action: 'knowledge_gap_resolved',
      resource_type: 'unanswered_queue',
      resource_id: String(issueNumber),
      meta_json: {
        github_comment_status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      },
    }).catch(() => undefined);
  }
}
