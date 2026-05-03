// @MX:ANCHOR Auth.js v5 configuration — entry point for SSO + session lookup.
// @MX:REASON Every Route Handler that calls `auth()` depends on this file.
// fan_in will exceed 3 once chat/consult/conversations endpoints land in
// Phase 2. Provider list and session strategy are load-bearing.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-051, REQ-FND-052, REQ-FND-054, REQ-FND-055)
//         SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-029)
//
// Phase 5: writeAudit wired into signIn callback and signOut event.
// auth.login / auth.logout enum values added in 0005_enterprise_audit_actions.sql.
// REQ-ENTERPRISE-035: writeAudit failures MUST propagate — do NOT catch or swallow.

import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { writeAudit } from './audit';
import { buildLoginAuditEvent, buildLogoutAuditEvent } from './auth/audit-callbacks';
import { db } from './db/client';
import { getEnv } from './env';

// getEnv() is deferred inside the NextAuth callback to avoid ZodError during
// `next build` — Next.js collects route data at build time before env vars are
// present, so module-level validation must not run then.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  return {
    adapter: DrizzleAdapter(db),
    // REQ-FND-052: Database session strategy. JWT is rejected because we need
    // server-side revocation for compliance (forced logout on RA personnel
    // offboarding) and audit-trail joins by sessionId.
    session: { strategy: 'database' },
    providers: [
      MicrosoftEntraID({
        clientId: env.AUTH_MICROSOFT_ID,
        clientSecret: env.AUTH_MICROSOFT_SECRET,
      }),
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      }),
    ],
    pages: {
      signIn: '/login',
    },
    callbacks: {
      // REQ-ENTERPRISE-029: Wire auth.login audit event.
      // REQ-ENTERPRISE-035: writeAudit errors propagate — no try/catch here.
      // If writeAudit throws, the error bubbles up and Auth.js will deny the sign-in,
      // which is the correct fail-closed behavior for a regulated system.
      signIn: async ({ user, account }) => {
        await writeAudit(buildLoginAuditEvent(user.id, account?.provider));
        return true;
      },
    },
    events: {
      // REQ-ENTERPRISE-029: Wire auth.logout audit event.
      // Auth.js v5 signOut lifecycle is exposed via events.signOut.
      // REQ-ENTERPRISE-035: writeAudit errors propagate naturally from async event handlers.
      signOut: async (message) => {
        // Auth.js v5 signOut event message shape differs by session strategy.
        // Database strategy provides { session: { userId, sessionToken } }.
        const session = 'session' in message ? message.session : null;
        const userId = session && 'userId' in session ? (session.userId as string | null) : null;
        const sessionToken =
          session && 'sessionToken' in session ? (session.sessionToken as string) : '';
        await writeAudit(buildLogoutAuditEvent(userId, sessionToken));
      },
    },
    trustHost: true,
  };
});
