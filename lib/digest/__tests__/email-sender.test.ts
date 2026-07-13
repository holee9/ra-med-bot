// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/digest/email-sender (SPEC-REGULA-DIGEST-001).
// @MX:SPEC SPEC-REGULA-DIGEST-001

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const payload = {
  week_id: '2026-W28',
  share_token: 'tok-123',
  update_count: 5,
  critical_count: 1,
  high_count: 2,
  medium_count: 2,
  updates: [
    {
      title: 'FDA 510(k) guidance update',
      region: 'US',
      impact_summary: 'New cybersecurity requirements',
      source_url: 'https://fda.gov/example',
      severity_classification: 'high',
      published_at: '2026-07-10',
    },
  ],
} as Record<string, unknown>;

const { sendDigestEmail } = await import('../email-sender');

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SENDGRID_API_KEY = 'test-key';
  process.env.SENDGRID_FROM_EMAIL = 'noreply@regula.ai';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.regula.ai';
  fetchMock.mockResolvedValue({ ok: true, status: 202 });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendDigestEmail (SPEC-REGULA-DIGEST-001)', () => {
  it('returns false when SENDGRID_API_KEY is not set', async () => {
    process.env.SENDGRID_API_KEY = '';
    expect(await sendDigestEmail('org-1', payload as never, ['ra@example.com'])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false when recipientEmails is empty', async () => {
    expect(await sendDigestEmail('org-1', payload as never, [])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the email and returns true on SendGrid 202', async () => {
    expect(await sendDigestEmail('org-1', payload as never, ['ra@example.com'])).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      personalizations: unknown[];
      subject: string;
    };
    expect(body.personalizations).toHaveLength(1);
    expect(body.subject).toContain('2026-W28');
  });

  it('returns false on a non-ok SendGrid response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await sendDigestEmail('org-1', payload as never, ['ra@example.com'])).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await sendDigestEmail('org-1', payload as never, ['ra@example.com'])).toBe(false);
  });
});
