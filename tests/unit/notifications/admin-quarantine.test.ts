// @MX:NOTE [AUTO] Unit tests for admin-quarantine notification store (SPEC-REGULA-DOCINGEST-001, REQ-DOC-025).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-025)
// @MX:REASON REQ-DOC-025 gate: notifyAdminQuarantine (push + warn log),
//   getQuarantineNotifications (defensive copy), clearQuarantineNotifications
//   (array truncation). All 3 exports + branches exercised.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger so notifyAdminQuarantine does not emit real log output.
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// notifyAdminQuarantine — push + warn log (REQ-DOC-025)
// ---------------------------------------------------------------------------
describe('notifyAdminQuarantine (REQ-DOC-025)', () => {
  it('stores a notification with documentId, reason, and notifiedAt', async () => {
    const { notifyAdminQuarantine, getQuarantineNotifications } = await import(
      '@/lib/notifications/admin-quarantine'
    );
    await notifyAdminQuarantine('doc-1', 'invalid citation');

    const notifications = getQuarantineNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.documentId).toBe('doc-1');
    expect(notifications[0]?.reason).toBe('invalid citation');
    expect(notifications[0]?.notifiedAt).toBeInstanceOf(Date);
  });

  it('calls logger.warn with documentId and reason', async () => {
    const { logger } = await import('@/lib/observability/logger');
    const { notifyAdminQuarantine } = await import('@/lib/notifications/admin-quarantine');
    vi.mocked(logger.warn).mockClear();
    await notifyAdminQuarantine('doc-2', 'broken reference');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[quarantine] Document doc-2 quarantined: broken reference'),
    );
  });

  it('appends multiple notifications in order', async () => {
    const { notifyAdminQuarantine, getQuarantineNotifications } = await import(
      '@/lib/notifications/admin-quarantine'
    );
    await notifyAdminQuarantine('doc-a', 'reason-a');
    await notifyAdminQuarantine('doc-b', 'reason-b');
    await notifyAdminQuarantine('doc-c', 'reason-c');

    const notifications = getQuarantineNotifications();
    expect(notifications).toHaveLength(3);
    expect(notifications[0]?.documentId).toBe('doc-a');
    expect(notifications[1]?.documentId).toBe('doc-b');
    expect(notifications[2]?.documentId).toBe('doc-c');
  });

  it('accepts empty string documentId and reason', async () => {
    const { notifyAdminQuarantine, getQuarantineNotifications } = await import(
      '@/lib/notifications/admin-quarantine'
    );
    await notifyAdminQuarantine('', '');

    const notifications = getQuarantineNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.documentId).toBe('');
    expect(notifications[0]?.reason).toBe('');
  });

  it('accepts unicode and emoji in reason', async () => {
    const { notifyAdminQuarantine, getQuarantineNotifications } = await import(
      '@/lib/notifications/admin-quarantine'
    );
    await notifyAdminQuarantine('doc-emoji', '검역 알림 🚨 — citation manquante');

    const notifications = getQuarantineNotifications();
    expect(notifications[0]?.reason).toBe('검역 알림 🚨 — citation manquante');
  });
});

// ---------------------------------------------------------------------------
// getQuarantineNotifications — defensive copy (REQ-DOC-025)
// ---------------------------------------------------------------------------
describe('getQuarantineNotifications — defensive copy (REQ-DOC-025)', () => {
  it('returns an empty array when no notifications have been set', async () => {
    const { getQuarantineNotifications } = await import('@/lib/notifications/admin-quarantine');
    expect(getQuarantineNotifications()).toEqual([]);
  });

  it('returns a copy — mutating the result does not affect the internal store', async () => {
    const { notifyAdminQuarantine, getQuarantineNotifications } = await import(
      '@/lib/notifications/admin-quarantine'
    );
    await notifyAdminQuarantine('doc-1', 'reason-1');

    const result = getQuarantineNotifications();
    expect(result).toHaveLength(1);

    // Mutate the returned array — internal store must be unaffected.
    result.push({
      documentId: 'injected',
      reason: 'tampered',
      notifiedAt: new Date(),
    });
    result.length = 0;

    const resultAgain = getQuarantineNotifications();
    expect(resultAgain).toHaveLength(1);
    expect(resultAgain[0]?.documentId).toBe('doc-1');
  });

  it('returns a new array instance each call (not cached)', async () => {
    const { getQuarantineNotifications } = await import('@/lib/notifications/admin-quarantine');
    const a = getQuarantineNotifications();
    const b = getQuarantineNotifications();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// clearQuarantineNotifications — array truncation (REQ-DOC-025)
// ---------------------------------------------------------------------------
describe('clearQuarantineNotifications (REQ-DOC-025)', () => {
  it('removes all stored notifications', async () => {
    const { notifyAdminQuarantine, clearQuarantineNotifications, getQuarantineNotifications } =
      await import('@/lib/notifications/admin-quarantine');
    await notifyAdminQuarantine('doc-1', 'reason-1');
    await notifyAdminQuarantine('doc-2', 'reason-2');
    expect(getQuarantineNotifications()).toHaveLength(2);

    clearQuarantineNotifications();
    expect(getQuarantineNotifications()).toEqual([]);
  });

  it('is safe to call when store is already empty', async () => {
    const { clearQuarantineNotifications, getQuarantineNotifications } = await import(
      '@/lib/notifications/admin-quarantine'
    );
    clearQuarantineNotifications();
    expect(getQuarantineNotifications()).toEqual([]);
  });

  it('allows adding notifications again after clear', async () => {
    const { notifyAdminQuarantine, clearQuarantineNotifications, getQuarantineNotifications } =
      await import('@/lib/notifications/admin-quarantine');
    await notifyAdminQuarantine('doc-old', 'old-reason');
    clearQuarantineNotifications();

    await notifyAdminQuarantine('doc-new', 'new-reason');
    const notifications = getQuarantineNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.documentId).toBe('doc-new');
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
describe('module exports (REQ-DOC-025)', () => {
  it('exports notifyAdminQuarantine, getQuarantineNotifications, clearQuarantineNotifications', async () => {
    const mod = await import('@/lib/notifications/admin-quarantine');
    expect(typeof mod.notifyAdminQuarantine).toBe('function');
    expect(typeof mod.getQuarantineNotifications).toBe('function');
    expect(typeof mod.clearQuarantineNotifications).toBe('function');
  });
});
