// @MX:ANCHOR [AUTO] KV session adapter — Auth.js v5 Adapter implementation using Workers KV.
// @MX:REASON Single integration point between Auth.js session lifecycle and KV store.
// fan_in >= 3 expected: auth.ts, middleware-edge.ts, session invalidation endpoint.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-032, REQ-CF-033, REQ-CF-034)

// Auth.js v5 Adapter interface shape (re-declared to avoid importing next-auth at Workers edge).
// These types mirror the official Adapter contract from @auth/core/adapters.
export interface KVAdapterSession {
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface KVAdapterUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
}

// Minimal Adapter interface subset that KVSessionAdapter implements.
// Full Auth.js Adapter has more methods (account, verificationToken, etc.),
// which fall back to the Neon Drizzle adapter when not provided.
export interface MinimalSessionAdapter {
  createSession?: (session: KVAdapterSession) => Promise<KVAdapterSession>;
  getSessionAndUser?: (
    sessionToken: string,
  ) => Promise<{ session: KVAdapterSession; user: KVAdapterUser } | null>;
  updateSession?: (
    session: Partial<KVAdapterSession> & { sessionToken: string },
  ) => Promise<KVAdapterSession | null>;
  deleteSession?: (sessionToken: string) => Promise<void>;
}

// KV key prefix (REQ-CF-032)
const KEY_PREFIX = 'session:';

// Default TTL: 30 days in seconds (REQ-CF-033)
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 2592000

function sessionKey(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

interface StoredSession {
  session: KVAdapterSession;
  user: KVAdapterUser;
}

/**
 * Returns a minimal Auth.js v5 Adapter that stores sessions in Workers KV.
 *
 * Dual-write behaviour (REQ-CF-034): when DUAL_WRITE_SESSIONS env is "true",
 * callers are responsible for also writing to Neon. This adapter only handles
 * the KV side. The auth.ts configuration layer orchestrates the dual-write.
 */
export function getSessionAdapter(kv: KVNamespace): MinimalSessionAdapter {
  return {
    async createSession(session: KVAdapterSession): Promise<KVAdapterSession> {
      const expiresMs = session.expires.getTime() - Date.now();
      const ttl = Math.max(Math.round(expiresMs / 1000), SESSION_TTL_SECONDS);

      // Store session data. User is a stub — real user lookup is from Neon.
      // KV stores session+userId so getSessionAndUser can return a minimal user stub.
      const stored: StoredSession = {
        session,
        user: {
          id: session.userId,
          email: '',
        },
      };

      await kv.put(sessionKey(session.sessionToken), JSON.stringify(stored), {
        expirationTtl: SESSION_TTL_SECONDS,
      });

      return session;
    },

    async getSessionAndUser(
      sessionToken: string,
    ): Promise<{ session: KVAdapterSession; user: KVAdapterUser } | null> {
      const raw = await kv.get(sessionKey(sessionToken));
      if (!raw) return null;

      const stored: StoredSession = JSON.parse(raw);
      // Rehydrate Date from stored ISO string
      stored.session.expires = new Date(stored.session.expires);
      return stored;
    },

    async updateSession(
      update: Partial<KVAdapterSession> & { sessionToken: string },
    ): Promise<KVAdapterSession | null> {
      const existing = await kv.get(sessionKey(update.sessionToken));
      if (!existing) return null;

      const stored: StoredSession = JSON.parse(existing);
      const merged: KVAdapterSession = {
        ...stored.session,
        ...update,
        expires: update.expires ? new Date(update.expires) : new Date(stored.session.expires),
      };

      const updated: StoredSession = { session: merged, user: stored.user };
      await kv.put(sessionKey(update.sessionToken), JSON.stringify(updated), {
        expirationTtl: SESSION_TTL_SECONDS,
      });

      return merged;
    },

    async deleteSession(sessionToken: string): Promise<void> {
      await kv.delete(sessionKey(sessionToken));
    },
  };
}
