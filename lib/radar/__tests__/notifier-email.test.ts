// @vitest-environment node
// Unit tests for radar digest email channel — SPEC-REGULA-RADAR-001
// Verifies recipient resolution from orgDigestPreferences (no more placeholder
// addresses) and SendGrid dispatch behavior.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the DB module — email.ts queries orgDigestPreferences.
// vi.hoisted ensures refs exist when the hoisted vi.mock factory runs.
const { selectMock, fromMock, whereMock, limitMock, setLimitResolution } = vi.hoisted(() => {
  let limitResolution: unknown[] = [];
  const limitMock = vi.fn(async () => limitResolution);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock, limit: limitMock }));
  return {
    selectMock: vi.fn(() => ({ from: fromMock })),
    fromMock,
    whereMock,
    limitMock,
    setLimitResolution: (rows: unknown[]) => {
      limitResolution = rows;
    },
  };
});

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: selectMock,
  },
}));

// Import after mocks are registered.
import { type RelevantUpdate, sendDigestEmail } from '../notifier-channels/email';

const originalFetch = globalThis.fetch;
const originalSendgridKey = process.env.SENDGRID_API_KEY;
const originalSendgridFrom = process.env.SENDGRID_FROM_EMAIL;

beforeEach(() => {
  vi.useRealTimers();
  selectMock.mockClear();
  fromMock.mockClear();
  whereMock.mockClear();
  limitMock.mockClear();
  setLimitResolution([]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  if (originalSendgridKey === undefined) process.env.SENDGRID_API_KEY = '';
  else process.env.SENDGRID_API_KEY = originalSendgridKey;
  if (originalSendgridFrom === undefined) process.env.SENDGRID_FROM_EMAIL = '';
  else process.env.SENDGRID_FROM_EMAIL = originalSendgridFrom;
});

const updates: RelevantUpdate[] = [
  {
    id: 'u1',
    title: 'FDA guidance update',
    region: 'US',
    impact_score: 0.9,
    source_url: 'https://fda.gov/example',
  },
];

describe('sendDigestEmail — recipient resolution (REQ-RADAR email channel)', () => {
  it('skips when SENDGRID_API_KEY is unset', async () => {
    process.env.SENDGRID_API_KEY = '';
    const result = await sendDigestEmail('org-1', updates);
    expect(result).toBeUndefined();
  });

  it('skips when no recipients configured for org', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    setLimitResolution([]); // orgDigestPreferences returns no recipients

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;

    await sendDigestEmail('org-1', updates);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends to resolved recipientEmails and never uses placeholder address', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    setLimitResolution([{ recipientEmails: ['lead@example.test', 'exec@example.test'] }]);

    const fetchMock = vi.fn(async () => new Response('', { status: 202 }));
    globalThis.fetch = fetchMock as never;

    await sendDigestEmail('org-1', updates);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');

    const body = JSON.parse(init.body as string) as {
      personalizations: Array<{ to: Array<{ email: string }> }>;
    };
    expect(body.personalizations[0]?.to).toHaveLength(2);
    expect(body.personalizations[0]?.to[0]?.email).toBe('lead@example.test');
    expect(body.personalizations[0]?.to[1]?.email).toBe('exec@example.test');

    // Critical: no @digest.placeholder leakage.
    const bodyStr = init.body as string;
    expect(bodyStr).not.toContain('@digest.placeholder');
  });

  it('skips when updates list is empty', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    setLimitResolution([{ recipientEmails: ['lead@example.test'] }]);

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;

    await sendDigestEmail('org-1', []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs error and does not throw when SendGrid returns non-2xx', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    setLimitResolution([{ recipientEmails: ['lead@example.test'] }]);
    globalThis.fetch = vi.fn(async () => new Response('', { status: 500 })) as never;

    // Must not throw — channel failure is fire-and-forget.
    await expect(sendDigestEmail('org-1', updates)).resolves.toBeUndefined();
  });
});
