// @vitest-environment node
// Unit tests for notification dispatcher — SPEC-REGULA-NOTIFICATIONS-001
// Verifies SendGrid email wiring (REQ-NOTIFY-004), Slack/Teams parity,
// and per-channel fire-and-forget isolation.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from '../dispatcher';

const originalFetch = globalThis.fetch;
const originalSendgridKey = process.env.SENDGRID_API_KEY;
const originalSendgridFrom = process.env.SENDGRID_FROM_EMAIL;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  // Restore env (avoid `delete process.env` per biome noDelete).
  if (originalSendgridKey === undefined) process.env.SENDGRID_API_KEY = '';
  else process.env.SENDGRID_API_KEY = originalSendgridKey;
  if (originalSendgridFrom === undefined) process.env.SENDGRID_FROM_EMAIL = '';
  else process.env.SENDGRID_FROM_EMAIL = originalSendgridFrom;
});

function mockFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response('', { status: 202 })) as never;
}

describe('dispatch — email channel (SendGrid wiring, REQ-NOTIFY-004)', () => {
  it('sends email via SendGrid when recipientEmail and SENDGRID_API_KEY are set', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@regula.test';
    const fetchMock = mockFetchOk();
    globalThis.fetch = fetchMock as never;

    const result = await dispatch({
      eventType: 'expert_review.assigned',
      title: 'Review requested',
      body: 'Please review the drafted answer.',
      recipientEmail: 'reviewer@example.test',
      actionUrl: 'https://app.regula.test/answers/123',
    });

    expect(result.email).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SG.test-key');

    const body = JSON.parse(init.body as string) as {
      personalizations: Array<{ to: Array<{ email: string }> }>;
      from: { email: string };
      subject: string;
      content: Array<{ type: string; value: string }>;
    };
    expect(body.personalizations[0]?.to[0]?.email).toBe('reviewer@example.test');
    expect(body.from.email).toBe('noreply@regula.test');
    expect(body.subject).toBe('Review requested');
    expect(body.content[0]?.type).toBe('text/html');
    expect(body.content[0]?.value).toContain('https://app.regula.test/answers/123');
  });

  it('renders body text without CTA when actionUrl is omitted', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const fetchMock = mockFetchOk();
    globalThis.fetch = fetchMock as never;

    await dispatch({
      eventType: 'workflow.completed',
      title: 'Done',
      body: 'Workflow finished successfully.',
      recipientEmail: 'user@example.test',
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string) as { content: Array<{ value: string }> };
    expect(body.content[0]?.value).toContain('Workflow finished successfully.');
  });

  it('returns email "error" when SendGrid responds non-2xx', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    globalThis.fetch = vi.fn(async () => new Response('', { status: 401 })) as never;

    const result = await dispatch({
      eventType: 'knowledge_gap.detected',
      title: 'Gap',
      body: 'b',
      recipientEmail: 'user@example.test',
    });

    expect(result.email).toBe('error');
  });

  it('returns email "error" when SENDGRID_API_KEY is unset (misconfigured production)', async () => {
    // No env set — sendEmail throws synchronously, caught by dispatcher.
    process.env.SENDGRID_API_KEY = '';
    const result = await dispatch({
      eventType: 'batch_query.completed',
      title: 't',
      body: 'b',
      recipientEmail: 'user@example.test',
    });

    expect(result.email).toBe('error');
  });

  it('skips email channel when recipientEmail is absent', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const fetchMock = mockFetchOk();
    globalThis.fetch = fetchMock as never;

    const result = await dispatch({
      eventType: 'workflow.completed',
      title: 't',
      body: 'b',
      orgSlackWebhookUrl: 'https://hooks.slack.example/xyz',
    });

    expect(result.email).toBe('skipped');
    // Only Slack fetch should have fired.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('hooks.slack.example');
  });
});

describe('dispatch — Slack/Teams parity (fire-and-forget isolation)', () => {
  it('email failure does not block Slack/Teams results', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    // First call (Slack) ok, second (Teams) ok, third (email) 401.
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 3) return new Response('', { status: 401 });
      return new Response('', { status: 200 });
    }) as never;

    const result = await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'SLA warning',
      body: 'Approaching SLA breach.',
      recipientEmail: 'user@example.test',
      orgSlackWebhookUrl: 'https://hooks.slack.example/x',
      orgTeamsWebhookUrl: 'https://hooks.teams.example/y',
    });

    expect(result.slack).toBe('sent');
    expect(result.teams).toBe('sent');
    expect(result.email).toBe('error');
  });
});
