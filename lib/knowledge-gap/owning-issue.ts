// @MX:ANCHOR [AUTO] Owning-project issue creation — idempotent, retried, target-scoped.
// @MX:REASON fan_in will reach 3+ (detector wire-in, replay re-create, admin retry route).
//          Mirrors github-issue.ts pattern but uses OWNING_ISSUE_GITHUB_TOKEN + per-target repo.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 AC2/AC3 (Issue #157)
//
// Contract:
//   - Idempotent: if queue row already has owningIssueUrl, return it — no duplicate.
//   - Retried: 3 attempts with exponential backoff (250ms → 500ms → 1000ms).
//   - Non-fatal: on 3x failure, audit 'owning_issue_creation_failed' and return null.
//     The capture flow MUST NOT crash because GitHub is down.
//   - Token safety: tokens never appear in issue bodies, audit meta, or logs.
//     The body references the triage issue by URL only (redacted question stays in triage).

import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { GapIssueContext, GitHubIssuesClient } from './github-issue';
import { type OwningTarget, readOwningRepoConfig } from './owning-repos';

/** Target label used in issue title/body for human triage. */
const TARGET_LABEL: Record<Exclude<OwningTarget, 'queue'>, string> = {
  'ra-project': 'ra-project',
  'md-process': 'MD-process',
  'gitea-wiki': 'gitea-wiki',
  'hybrid-ra-saas': 'hybrid-ra-saas',
};

/** Result of createOwningIssue — null when unconfigured or after retry exhaustion. */
export interface OwningIssueResult {
  /** GitHub issue number — needed for link-back comments on the owning side. */
  number: number;
  htmlUrl: string;
  target: Exclude<OwningTarget, 'queue'>;
}

/**
 * Per-target GitHub client. Reuses the GitHubIssuesClient interface but binds
 * to OWNING_ISSUE_GITHUB_TOKEN and the target's repo+apiBase. When the target
 * is unconfigured (readOwningRepoConfig returns null), methods return the same
 * NULL_GITHUB_RESULT sentinel shape so callers detect "no-op" uniformly.
 */
export function targetGithubClient(
  target: Exclude<OwningTarget, 'queue'>,
): GitHubIssuesClient & { configured: boolean } {
  const cfg = readOwningRepoConfig(target);
  return {
    configured: cfg !== null,
    async createIssue({ title, body, labels }) {
      if (!cfg) return { number: -1, htmlUrl: '' };
      const res = await fetch(`${cfg.apiBase}/repos/${cfg.repo}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body, labels: [...labels] }),
      });
      if (!res.ok) {
        throw new Error(`GitHub createIssue (${target}) failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as { number: number; html_url: string };
      return { number: json.number, htmlUrl: json.html_url };
    },
    async createComment({ issueNumber, body }) {
      if (!cfg) return { htmlUrl: '' };
      const res = await fetch(`${cfg.apiBase}/repos/${cfg.repo}/issues/${issueNumber}/comments`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        throw new Error(
          `GitHub createComment (${target}) failed: ${res.status} ${await res.text()}`,
        );
      }
      const json = (await res.json()) as { html_url: string };
      return { htmlUrl: json.html_url };
    },
  };
}

/**
 * Build the owning-issue body. SECURITY: only the triage URL + target label —
 * never the redacted question (the triage issue already holds it; cross-posting
 * multiplies PII surface and breaks redaction revision).
 */
function buildOwningBody(
  target: Exclude<OwningTarget, 'queue'>,
  triageIssueUrl: string,
  reason: string,
): string {
  return [
    `### Knowledge gap routed to ${TARGET_LABEL[target]}`,
    '',
    'This issue was opened automatically by Regula knowledge-gap routing.',
    '',
    `**Failure reason:** \`${reason}\``,
    `**Owning target:** \`${target}\``,
    '',
    '### Triage issue',
    '',
    'See the canonical triage issue for the (redacted) question and full traceability:',
    '',
    triageIssueUrl,
    '',
    '_Do not paste the original question here — keep PII scoped to the triage issue._',
  ].join('\n');
}

const OWNING_LABELS = ['knowledge-gap', 'ra-auto-route', 'target:routed'] as const;

/**
 * Create the owning issue with idempotency + 3x retry.
 *
 * Idempotency: if `queueId`'s row already has `owningIssueUrl`, return it.
 * Retry: 3 attempts, exponential backoff 250ms → 500ms → 1000ms.
 *
 * Returns the result on success, or null when:
 *   - target unconfigured (caller should have routed to 'queue' instead)
 *   - retry exhausted (audits 'owning_issue_creation_failed')
 *
 * On success writes `owningIssueUrl` + `owningIssueTarget` back on the queue row
 * and audits 'owning_issue_created'.
 */
export async function createOwningIssue(
  target: Exclude<OwningTarget, 'queue'>,
  ctx: GapIssueContext & { queueId: string; triageIssueUrl: string; actorId: string | null },
  client: GitHubIssuesClient & { configured: boolean } = targetGithubClient(target),
): Promise<OwningIssueResult | null> {
  // §1. Idempotency — check existing owningIssueUrl on the queue row.
  const [existing] = await db
    .select({ owningIssueUrl: unansweredQueue.owningIssueUrl })
    .from(unansweredQueue)
    .where(eq(unansweredQueue.id, ctx.queueId))
    .limit(1);
  if (existing?.owningIssueUrl) {
    // Idempotent re-entry — we lost the issue number on re-entry, but the URL
    // is enough for callers that only need to reference the owning issue. Link-
    // back on re-entry is a no-op (comments already posted on first creation).
    return { number: -1, htmlUrl: existing.owningIssueUrl, target };
  }

  // §2. Unconfigured target → caller routed to 'queue' but invoked us anyway. Safe no-op.
  if (!client.configured) return null;

  // §3. 3x retry with exponential backoff (250ms → 500ms → 1000ms).
  const title = `[${TARGET_LABEL[target]}][${ctx.reason}] knowledge-gap routed`;
  const body = buildOwningBody(target, ctx.triageIssueUrl, ctx.reason);
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const created = await client.createIssue({ title, body, labels: OWNING_LABELS });
      if (created.number < 0) return null; // sentinel — treat as unconfigured

      // §4. Persist owning URL + target on the queue row.
      await db
        .update(unansweredQueue)
        .set({ owningIssueUrl: created.htmlUrl, owningIssueTarget: target })
        .where(eq(unansweredQueue.id, ctx.queueId));

      // §5. Audit — meta contains NO question text, NO tokens. URL + target only.
      await writeAudit({
        actor_id: ctx.actorId,
        action: 'owning_issue_created',
        resource_type: 'unanswered_queue',
        resource_id: ctx.queueId,
        conversation_id: ctx.conversationId,
        meta_json: {
          target,
          owning_issue_url: created.htmlUrl,
          cluster_id: ctx.clusterId,
        },
      });

      return { number: created.number, htmlUrl: created.htmlUrl, target };
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        const backoffMs = 250 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  // §6. Retry exhausted — audit failure, do NOT throw.
  await writeAudit({
    actor_id: ctx.actorId,
    action: 'owning_issue_creation_failed',
    resource_type: 'unanswered_queue',
    resource_id: ctx.queueId,
    conversation_id: ctx.conversationId,
    meta_json: {
      target,
      cluster_id: ctx.clusterId,
      error:
        lastErr instanceof Error ? lastErr.message.slice(0, 200) : String(lastErr).slice(0, 200),
    },
  }).catch(() => undefined);

  return null;
}
