// @vitest-environment node
// Inngest client + function registration tests — SPEC-REGULA-DIGEST-001 / SPEC-REGULA-DOCINGEST-001
// Verifies the client singleton, function IDs, triggers, and that the serve
// endpoint exports the expected HTTP handlers.

import { describe, expect, it } from 'vitest';
import { INNGEST_EVENTS, inngest } from '../client';
import { weeklyDigestFn } from '../digest/weekly-digest';
import { uploadProcessedFn } from '../docingest/upload-processed';
import { functions } from '../functions';

describe('inngest client (SPEC-REGULA-DIGEST-001)', () => {
  it('exports a singleton client with the regula id', () => {
    expect(inngest).toBeDefined();
    // Inngest client exposes its name/id via the readonly fields.
    expect((inngest as unknown as { id: string }).id).toBe('regula');
  });

  it('exposes canonical event names', () => {
    expect(INNGEST_EVENTS.DOCINGEST_DOCUMENT_CREATED).toBe('docingest/document.created');
    expect(INNGEST_EVENTS.DIGEST_WEEKLY_TRIGGER).toBe('digest/weekly.trigger');
  });
});

describe('function registry', () => {
  it('registers the weekly digest, knowledge-gap digest, docingest upload, and CAPA effectiveness functions', () => {
    const ids = functions.map((f) => (f as unknown as { id: () => string }).id());
    expect(ids).toContain('digest-weekly-cron');
    expect(ids).toContain('knowledge-gap-daily-digest');
    expect(ids).toContain('docingest-upload-processed');
    expect(ids).toContain('capa-effectiveness-due-reminder');
    expect(ids).toContain('standards-revision-daily');
    expect(functions).toHaveLength(5); // +standards-revision-daily (STANDARDS-001, Issue #62)
  });

  it('weekly digest function is the same instance exported from its module', () => {
    expect(functions).toContain(weeklyDigestFn);
  });

  it('docingest upload function is the same instance exported from its module', () => {
    expect(functions).toContain(uploadProcessedFn);
  });
});

describe('serve endpoint exports', () => {
  it('app/api/inngest/route exports GET/POST/PUT handlers', async () => {
    const mod = await import('@/app/api/inngest/route');
    expect(typeof mod.GET).toBe('function');
    expect(typeof mod.POST).toBe('function');
    expect(typeof mod.PUT).toBe('function');
  });
});
