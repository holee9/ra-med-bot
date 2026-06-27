// @MX:NOTE [AUTO] Cross-link comments between triage issue and owning issue (Issue #157).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC3 (cross-link-back contract)
//
// SECURITY: comment bodies contain ONLY issue URLs — never the redacted question.
// The triage issue already holds the (redacted) question; cross-posting it would
// multiply the PII surface and break redaction revision history.
//
// Best-effort: link-back failures are swallowed (caught + ignored). The owning
// issue already exists; a missing comment is a cosmetic gap, not a regulatory
// failure. The capture flow is never aborted by a comment failure.

import { type GitHubIssuesClient, fetchGitHubClient } from './github-issue';
import { targetGithubClient } from './owning-issue';
import type { OwningTarget } from './owning-repos';

/**
 * Post a mutual cross-link: comment on triage issue → owning URL, and comment
 * on owning issue → triage URL. Bodies are URLs only (no question text).
 *
 * Best-effort: both comments are posted in parallel and individual failures are
 * swallowed. Never throws into the capture flow.
 */
export async function linkBackIssues(
  triageIssueNumber: number,
  owning: { number: number; htmlUrl: string; target: Exclude<OwningTarget, 'queue'> },
  opts: {
    triageClient?: GitHubIssuesClient;
    owningClient?: GitHubIssuesClient;
  } = {},
): Promise<void> {
  const triageClient = opts.triageClient ?? fetchGitHubClient;
  const owningClient = opts.owningClient ?? targetGithubClient(owning.target);

  const triageRepo = process.env.KNOWLEDGE_GAP_GITHUB_REPO ?? '';
  const triageIssueUrl = triageRepo
    ? `https://github.com/${triageRepo}/issues/${triageIssueNumber}`
    : '';

  const tasks: Promise<unknown>[] = [];

  // §1. Comment on triage issue pointing forward to owning issue.
  tasks.push(
    triageClient
      .createComment({
        issueNumber: triageIssueNumber,
        body: `Routed to owning project (${owning.target}):\n\n${owning.htmlUrl}`,
      })
      .catch(() => undefined),
  );

  // §2. Comment on owning issue pointing back to triage issue.
  if (owning.number > 0 && triageIssueUrl) {
    tasks.push(
      owningClient
        .createComment({
          issueNumber: owning.number,
          body: `Triage issue (canonical, holds the redacted question):\n\n${triageIssueUrl}`,
        })
        .catch(() => undefined),
    );
  }

  await Promise.all(tasks);
}
