// @MX:NOTE [AUTO] Unit tests for notification dispatcher (SPEC-REGULA-NOTIFICATIONS-001, REQ-NOTIFY-001..005).
// @MX:SPEC SPEC-REGULA-NOTIFICATIONS-001 (REQ-NOTIFY-001..005, Issue #402)
// @MX:REASON REQ-NOTIFY-001..005 gate: dispatch() routes to 3 channels
//   (slack/teams/email) with fire-and-forget isolation. escapeHtml is a pure
//   helper used by sendEmail — tested directly. fetch is stubbed via
//   vi.stubGlobal so no real network calls occur.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger so dispatch() does not emit real log output.
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers — stub fetch + env per test.
// ---------------------------------------------------------------------------

function makeOkResponse(): Response {
  return new Response('{}', { status: 200, statusText: 'OK' });
}

function makeBadResponse(status = 500): Response {
  return new Response('{}', { status, statusText: 'ERROR' });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(makeOkResponse());
  vi.stubGlobal('fetch', fetchMock);
  // Clean env so each test starts from a known state.
  // Reflect.deleteProperty is used instead of `delete` to satisfy biome
  // noDelete rule — Node coerces `process.env.X = undefined` to the string
  // "undefined" which would break truthiness checks in the dispatcher.
  Reflect.deleteProperty(process.env, 'SENDGRID_API_KEY');
  Reflect.deleteProperty(process.env, 'SENDGRID_FROM_EMAIL');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(process.env, 'SENDGRID_API_KEY');
  Reflect.deleteProperty(process.env, 'SENDGRID_FROM_EMAIL');
});

// ---------------------------------------------------------------------------
// escapeHtml — pure helper (tested via sendEmail dispatch path)
// ---------------------------------------------------------------------------
// escapeHtml is not exported — we verify its behavior indirectly through
// the HTML payload that sendEmail builds. The dispatch → sendEmail path
// is the only way to observe escapeHtml output.

describe('dispatch — slack channel (REQ-NOTIFY-001)', () => {
  it('sends to slack webhook when orgSlackWebhookUrl is set', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.assigned',
      title: 'Review Assigned',
      body: 'Please review',
      orgSlackWebhookUrl: 'https://hooks.slack.com/services/T000/B000/XXX',
    });
    expect(result.slack).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.slack.com/services/T000/B000/XXX');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.text).toBe('*Review Assigned*\nPlease review');
  });

  it('sets slack to error when webhook returns non-ok', async () => {
    fetchMock.mockResolvedValueOnce(makeBadResponse(503));
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.assigned',
      title: 'T',
      body: 'B',
      orgSlackWebhookUrl: 'https://hooks.slack.com/services/T/B/X',
    });
    expect(result.slack).toBe('error');
    const { logger } = await import('@/lib/observability/logger');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[notifications] Slack dispatch failed:'),
      expect.any(Error),
    );
  });

  it('sets slack to error when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.assigned',
      title: 'T',
      body: 'B',
      orgSlackWebhookUrl: 'https://hooks.slack.com/services/T/B/X',
    });
    expect(result.slack).toBe('error');
  });

  it('sets slack to skipped when no webhook url', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.assigned',
      title: 'T',
      body: 'B',
    });
    expect(result.slack).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('dispatch — teams channel (REQ-NOTIFY-003)', () => {
  it('sends to teams webhook with MessageCard format', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'workflow.completed',
      title: 'Workflow Done',
      body: 'All steps complete',
      orgTeamsWebhookUrl: 'https://outlook.office.com/webhook/XXX',
    });
    expect(result.teams).toBe('sent');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://outlook.office.com/webhook/XXX');
    const body = JSON.parse(init?.body as string);
    expect(body['@type']).toBe('MessageCard');
    expect(body.summary).toBe('Workflow Done');
    expect(body.sections[0].activityTitle).toBe('Workflow Done');
    expect(body.sections[0].activityText).toBe('All steps complete');
  });

  it('sets teams to error when webhook returns non-ok', async () => {
    fetchMock.mockResolvedValueOnce(makeBadResponse(404));
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'workflow.completed',
      title: 'T',
      body: 'B',
      orgTeamsWebhookUrl: 'https://outlook.office.com/webhook/XXX',
    });
    expect(result.teams).toBe('error');
  });

  it('sets teams to skipped when no webhook url', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'workflow.completed',
      title: 'T',
      body: 'B',
    });
    expect(result.teams).toBe('skipped');
  });
});

describe('dispatch — email channel (REQ-NOTIFY-004)', () => {
  it('skips email when SENDGRID_API_KEY is not set', async () => {
    Reflect.deleteProperty(process.env, 'SENDGRID_API_KEY');
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'SLA Warning',
      body: 'Review overdue',
      recipientEmail: 'reviewer@example.com',
    });
    expect(result.email).toBe('skipped');
    const { logger } = await import('@/lib/observability/logger');
    expect(logger.info).toHaveBeenCalledWith(
      '[notifications] Email skipped — SENDGRID_API_KEY not set',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends email via SendGrid v3 when API key is set', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@regula.test';
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'SLA Warning',
      body: 'Review overdue',
      actionUrl: 'https://app.regula.ai/review/123',
      recipientEmail: 'reviewer@example.com',
    });
    expect(result.email).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(headers?.Authorization).toBe('Bearer SG.test-key');
    expect(headers?.['Content-Type']).toBe('application/json');
    const body = JSON.parse(init?.body as string);
    expect(body.personalizations[0].to[0].email).toBe('reviewer@example.com');
    expect(body.from.email).toBe('noreply@regula.test');
    expect(body.subject).toBe('SLA Warning');
    expect(body.content[0].type).toBe('text/html');
  });

  it('uses default from email when SENDGRID_FROM_EMAIL is not set', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    Reflect.deleteProperty(process.env, 'SENDGRID_FROM_EMAIL');
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'T',
      body: 'B',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.from.email).toBe('noreply@regula.ai');
  });

  it('includes actionUrl CTA link in HTML when provided', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'T',
      body: 'B',
      actionUrl: 'https://app.regula.ai/r/1',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const html = body.content[0].value;
    expect(html).toContain('href="https://app.regula.ai/r/1"');
    expect(html).toContain('Regula에서 보기');
  });

  it('omits CTA link when actionUrl is not provided', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'T',
      body: 'B',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const html = body.content[0].value;
    expect(html).not.toContain('Regula에서 보기');
  });

  it('sets email to error when SendGrid returns non-ok', async () => {
    process.env.SENDGRID_API_KEY = 'SG.bad-key';
    fetchMock.mockResolvedValueOnce(makeBadResponse(401));
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'T',
      body: 'B',
      recipientEmail: 'r@example.com',
    });
    expect(result.email).toBe('error');
    const { logger } = await import('@/lib/observability/logger');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[notifications] Email dispatch failed:'),
      expect.any(Error),
    );
  });

  it('sets email to skipped when recipientEmail is not provided', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'T',
      body: 'B',
    });
    expect(result.email).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// escapeHtml — exercised through the email HTML payload (REQ-NOTIFY-004)
// ---------------------------------------------------------------------------
describe('dispatch — escapeHtml via email HTML payload', () => {
  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
  });

  it('escapes < > & " in title', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: '<script>alert("xss")</script>',
      body: 'safe body',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const html = body.content[0].value;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;xss&quot;');
  });

  it('escapes & < > in body', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'Safe Title',
      body: 'a & b < c > d',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const html = body.content[0].value;
    expect(html).toContain('a &amp; b &lt; c &gt; d');
  });

  it('escapes single quotes in actionUrl', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: 'T',
      body: 'B',
      actionUrl: "https://app.regula.ai/r?id=1'or'1",
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const html = body.content[0].value;
    expect(html).toContain('&apos;or&apos;1');
  });

  it('preserves unicode and emoji in title and body', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: '경고 🚨 알림',
      body: '본문 — 검토 필요',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const html = body.content[0].value;
    expect(html).toContain('경고 🚨 알림');
    expect(html).toContain('본문 — 검토 필요');
  });

  it('returns empty string escape for empty input (no crash)', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    await dispatch({
      eventType: 'expert_review.sla_warning',
      title: '',
      body: '',
      recipientEmail: 'r@example.com',
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    // Should not throw; HTML still well-formed.
    expect(body.content[0].value).toContain('<h2></h2>');
  });
});

// ---------------------------------------------------------------------------
// dispatch — multi-channel isolation (fire-and-forget, REQ-NOTIFY-005)
// ---------------------------------------------------------------------------
describe('dispatch — multi-channel isolation (REQ-NOTIFY-005)', () => {
  it('sends to all 3 channels when all configured', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'regulatory_update.high_risk',
      title: 'High Risk Update',
      body: 'New regulation',
      orgSlackWebhookUrl: 'https://hooks.slack.com/services/T/B/X',
      orgTeamsWebhookUrl: 'https://outlook.office.com/webhook/XXX',
      recipientEmail: 'team@example.com',
    });
    expect(result).toEqual({ slack: 'sent', teams: 'sent', email: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not block other channels when slack fails', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    // Slack call (first fetch) fails, teams + email succeed.
    fetchMock.mockRejectedValueOnce(new Error('slack down'));
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'regulatory_update.high_risk',
      title: 'T',
      body: 'B',
      orgSlackWebhookUrl: 'https://hooks.slack.com/services/T/B/X',
      orgTeamsWebhookUrl: 'https://outlook.office.com/webhook/XXX',
      recipientEmail: 'team@example.com',
    });
    expect(result.slack).toBe('error');
    expect(result.teams).toBe('sent');
    expect(result.email).toBe('sent');
  });

  it('does not block other channels when email fails', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    // dispatch calls slack (1st), teams (2nd), email (3rd). Make only the
    // 3rd fetch return non-ok so email fails while slack/teams succeed.
    fetchMock
      .mockResolvedValueOnce(makeOkResponse()) // slack
      .mockResolvedValueOnce(makeOkResponse()) // teams
      .mockResolvedValueOnce(makeBadResponse(500)); // email (SendGrid)
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'regulatory_update.high_risk',
      title: 'T',
      body: 'B',
      orgSlackWebhookUrl: 'https://hooks.slack.com/services/T/B/X',
      orgTeamsWebhookUrl: 'https://outlook.office.com/webhook/XXX',
      recipientEmail: 'team@example.com',
    });
    expect(result.slack).toBe('sent');
    expect(result.teams).toBe('sent');
    expect(result.email).toBe('error');
  });

  it('returns all-skipped when no channels configured', async () => {
    const { dispatch } = await import('@/lib/notifications/dispatcher');
    const result = await dispatch({
      eventType: 'regulatory_update.high_risk',
      title: 'T',
      body: 'B',
    });
    expect(result).toEqual({ slack: 'skipped', teams: 'skipped', email: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// module exports
// ---------------------------------------------------------------------------
describe('dispatcher module exports', () => {
  it('exports dispatch function', async () => {
    const mod = await import('@/lib/notifications/dispatcher');
    expect(typeof mod.dispatch).toBe('function');
  });
});
