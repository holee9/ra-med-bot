// @MX:NOTE [AUTO] Knowledge gap handoff template renderer (REQ-KNOWLEDGE-GAP-010).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-010, Issue #35)
//
// Pure variable substitution into templates/knowledge-gap-handoff.md. No PII
// reaches this layer — callers pass the already-redacted question text from
// unanswered_queue.redactedQuestion. Kept as a standalone helper so the UI page
// (T4.3) and any future export pipeline can share one rendering path.

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Variables substituted into the handoff Markdown template. */
export interface HandoffTemplateVars {
  /** PII-free question (already redacted). */
  question: string;
  /** One of gap_classification enum values or a free-form label. */
  classification: string;
  /** RA-lead analysis / rationale for the classification. */
  reason: string;
  /** GitHub issue URL or number (may be 'N/A' when unconfigured). */
  github_issue: string;
  /** Resolution summary ('pending' until replay passes). */
  resolution: string;
}

const TEMPLATE_PATH = path.resolve(process.cwd(), 'templates', 'knowledge-gap-handoff.md');

let cachedTemplate: string | null = null;

/**
 * Load the raw template text. Exported so tests can inject a fixture instead
 * of reading the filesystem.
 */
export function loadHandoffTemplate(templatePath: string = TEMPLATE_PATH): string {
  if (cachedTemplate === null || templatePath !== TEMPLATE_PATH) {
    cachedTemplate = readFileSync(templatePath, 'utf8');
  }
  return cachedTemplate;
}

/** Reset the template cache (test-only). */
export function resetHandoffTemplateCache(): void {
  cachedTemplate = null;
}

/**
 * Render the handoff Markdown by substituting {{var}} placeholders.
 * Unknown placeholders are left intact so reviewers can spot template drift.
 */
export function renderHandoffTemplate(
  vars: HandoffTemplateVars,
  template: string = loadHandoffTemplate(),
): string {
  return template
    .replace(/\{\{question\}\}/g, vars.question)
    .replace(/\{\{classification\}\}/g, vars.classification)
    .replace(/\{\{reason\}\}/g, vars.reason)
    .replace(/\{\{github_issue\}\}/g, vars.github_issue)
    .replace(/\{\{resolution\}\}/g, vars.resolution);
}
