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
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { writeAudit } from './audit';
import { buildLoginAuditEvent, buildLogoutAuditEvent } from './auth/audit-callbacks';
import { db, serviceDb } from './db/client';
import { accounts, orgMembers, sessions, users, verificationTokens } from './db/schema';
import { getEnv } from './env';

// getEnv() is deferred inside the NextAuth callback to avoid ZodError during
// `next build` — Next.js collects route data at build time before env vars are
// present, so module-level validation must not run then.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    // REQ-FND-052: Credentials provider in Auth.js v5 beta forces JWT regardless of
    // 'database' setting — the session cookie is a JWE, not a DB token.
    // Switched to 'jwt' to match actual behavior; DB sessions for OAuth providers
    // can be revisited once Auth.js v5 stable resolves the Credentials/DB gap.
    session: { strategy: 'jwt' },
    providers: [
      Credentials({
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          const email = credentials?.email as string | undefined;
          const password = credentials?.password as string | undefined;
          if (!email || !password) return null;
          const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

          if (!user?.password_hash) {
            return null;
          }
          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) {
            return null;
          }
          if (user.status !== 'active') {
            return null;
          }
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        },
      }),
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
      // Issue #111: expose mustChangePassword so the (app) layout can redirect.
      // Auth.js v5 Credentials provider forces JWT strategy; user is undefined, use token.sub.
      // @MX:NOTE: [AUTO] session callback must handle both JWT (token.sub) and DB (user.id) strategies
      session: async ({ session, user, token }) => {
        const userId = user?.id ?? (token?.sub as string | undefined);
        if (!userId) return session;
        // users = global identity table (not org-scoped) → safe on `db` under RLS.
        // org_members = org-scoped → MUST use serviceDb. The orgId is derived FROM
        // this read, so the GUC cannot be set yet — under FORCE RLS the non-superuser
        // app role would get ZERO rows here and every user would lose org context.
        // M-1: serviceDb bypasses RLS — bootstrap orgId derivation (chicken-and-egg).
        const [[dbUser], [membership]] = await Promise.all([
          db
            .select({ mustChangePassword: users.mustChangePassword, role: users.role })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
          serviceDb
            .select({ orgId: orgMembers.orgId })
            .from(orgMembers)
            .where(eq(orgMembers.userId, userId))
            .limit(1),
        ]);
        const s = session.user as unknown as Record<string, unknown>;
        s.id = userId;
        s.mustChangePassword = dbUser?.mustChangePassword ?? false;
        s.role = dbUser?.role ?? 'viewer';
        s.organizationId = membership?.orgId ?? null;
        return session;
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
