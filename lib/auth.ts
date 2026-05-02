// @MX:ANCHOR Auth.js v5 configuration — entry point for SSO + session lookup.
// @MX:REASON Every Route Handler that calls `auth()` depends on this file.
// fan_in will exceed 3 once chat/consult/conversations endpoints land in
// Phase 2. Provider list and session strategy are load-bearing.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-051, REQ-FND-052, REQ-FND-054, REQ-FND-055)
//
// Phase 1 boots two OIDC providers (Microsoft Entra ID + Google) with the
// Drizzle database session strategy. NO writeAudit calls live here yet —
// Phase 5 is responsible for wiring auth.login / auth.logout once those
// audit_action enum values are added (current enum has only the 3 Phase 1
// values, so a write would fail at the DB).

import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { db } from './db/client';
import { getEnv } from './env';

const env = getEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    // Phase 5: wire writeAudit({ action: 'auth.login', actor_id: user.id }) here.
    // The audit_action enum must be ALTER-TYPE'd to include 'auth.login' first;
    // see migrations roadmap in DEVELOPMENT.md.
    signIn: async () => true,
  },
  trustHost: true,
});
