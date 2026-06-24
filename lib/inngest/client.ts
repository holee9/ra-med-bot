// @MX:NOTE [AUTO] Inngest client singleton — central registration point for all
// background jobs (cron + event-driven). SPEC-REGULA-DIGEST-001 / SPEC-REGULA-DOCINGEST-001.
// @MX:ANCHOR: [AUTO] External system integration point (Inngest serve + dispatch)
// @MX:REASON: REQ-DOC-021/022/025 async ingest + REQ-DIGEST-001 weekly cron; fan_in ≥ 3 (serve, manual trigger, tests)

import { Inngest } from 'inngest';

/**
 * Regula Inngest client. All background functions are registered here so the
 * serve endpoint (app/api/inngest/route.ts) can expose them in one place.
 *
 * Event key secret is optional in dev (Inngest dev server ignores it); in prod
 * set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY for request verification.
 */
export const inngest = new Inngest({
  id: 'regula',
  name: 'Regula Background Jobs',
  // Event key is optional for the dev server; prod reads from env automatically.
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/** Event names — single source of truth for dispatch + registration. */
export const INNGEST_EVENTS = {
  /** Fires when a document upload finishes pre-processing (PII redaction done). */
  DOCINGEST_DOCUMENT_CREATED: 'docingest/document.created',
  /** Fires weekly to generate + dispatch the regulatory intelligence digest. */
  DIGEST_WEEKLY_TRIGGER: 'digest/weekly.trigger',
  /** Fires daily (or on manual replay) to dispatch the knowledge-gap digest. */
  KNOWLEDGE_GAP_DIGEST_TRIGGER: 'knowledge-gap/digest.trigger',
  /** Fires daily (or on manual replay) to sweep due CAPA effectiveness checks. */
  CAPA_EFFECTIVENESS_REMINDER_TRIGGER: 'capa/effectiveness.reminder.trigger',
} as const;
