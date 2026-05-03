// Tests for lib/auth/kv-session-store.ts
// RED: test KV session adapter methods

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock KVNamespace
function makeKVMock() {
  const store = new Map<string, { value: string; expiration?: number }>();
  return {
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expiration: opts?.expirationTtl });
    }),
    get: vi.fn(async (key: string) => {
      return store.get(key)?.value ?? null;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  } as unknown as KVNamespace;
}

// Type stubs for Auth.js v5 adapter shape (test-only)
interface AdapterSession {
  sessionToken: string;
  userId: string;
  expires: Date;
}

interface AdapterUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
}

describe('getSessionAdapter', () => {
  let kv: KVNamespace;
  let adapter: ReturnType<typeof import('../../../lib/auth/kv-session-store').getSessionAdapter>;

  beforeEach(async () => {
    kv = makeKVMock();
    const mod = await import('../../../lib/auth/kv-session-store');
    adapter = mod.getSessionAdapter(kv);
  });

  describe('createSession', () => {
    it('should store session in KV with session: prefix', async () => {
      const session: AdapterSession = {
        sessionToken: 'tok-abc',
        userId: 'user-1',
        expires: new Date(Date.now() + 1000 * 60 * 60),
      };
      await adapter.createSession!(session);
      expect(kv.put).toHaveBeenCalledWith(
        'session:tok-abc',
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) }),
      );
    });

    it('should return the session that was stored', async () => {
      const session: AdapterSession = {
        sessionToken: 'tok-xyz',
        userId: 'user-2',
        expires: new Date(Date.now() + 1000 * 60 * 60),
      };
      const result = await adapter.createSession!(session);
      expect(result).toMatchObject({ sessionToken: 'tok-xyz', userId: 'user-2' });
    });
  });

  describe('getSessionAndUser', () => {
    it('should return null when session not found in KV', async () => {
      const result = await adapter.getSessionAndUser!('nonexistent-token');
      expect(result).toBeNull();
    });

    it('should return session and user when found', async () => {
      const session: AdapterSession = {
        sessionToken: 'tok-get',
        userId: 'user-get',
        expires: new Date(Date.now() + 1000 * 60 * 60),
      };
      await adapter.createSession!(session);
      const result = await adapter.getSessionAndUser!('tok-get');
      expect(result).not.toBeNull();
      expect(result?.session.sessionToken).toBe('tok-get');
    });
  });

  describe('updateSession', () => {
    it('should update session expiry in KV', async () => {
      const session: AdapterSession = {
        sessionToken: 'tok-upd',
        userId: 'user-upd',
        expires: new Date(Date.now() + 1000),
      };
      await adapter.createSession!(session);

      const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      await adapter.updateSession!({ sessionToken: 'tok-upd', expires: newExpiry });

      expect(kv.put).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteSession', () => {
    it('should remove session from KV', async () => {
      const session: AdapterSession = {
        sessionToken: 'tok-del',
        userId: 'user-del',
        expires: new Date(Date.now() + 1000 * 60 * 60),
      };
      await adapter.createSession!(session);
      await adapter.deleteSession!('tok-del');

      expect(kv.delete).toHaveBeenCalledWith('session:tok-del');
    });
  });
});

describe('KV key pattern', () => {
  it('should use "session:<token>" key pattern (REQ-CF-032)', async () => {
    const kv = makeKVMock();
    const { getSessionAdapter } = await import('../../../lib/auth/kv-session-store');
    const adapter = getSessionAdapter(kv);

    await adapter.createSession!({
      sessionToken: 'my-token',
      userId: 'u1',
      expires: new Date(Date.now() + 86400000),
    });

    const callArg = vi.mocked(kv.put).mock.calls[0]![0];
    expect(callArg).toBe('session:my-token');
  });
});

describe('TTL enforcement', () => {
  it('should set expirationTtl of 30 days for new sessions (REQ-CF-033)', async () => {
    const kv = makeKVMock();
    const { getSessionAdapter } = await import('../../../lib/auth/kv-session-store');
    const adapter = getSessionAdapter(kv);

    await adapter.createSession!({
      sessionToken: 'ttl-token',
      userId: 'u1',
      expires: new Date(Date.now() + 86400000),
    });

    const opts = vi.mocked(kv.put).mock.calls[0]![2];
    // 30 days = 2592000 seconds
    expect(opts?.expirationTtl).toBeGreaterThanOrEqual(2592000 - 60);
    expect(opts?.expirationTtl).toBeLessThanOrEqual(2592000 + 60);
  });
});
