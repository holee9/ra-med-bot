// @MX:ANCHOR [AUTO] Kernel schema — shared infrastructure tables (users, sessions, verificationTokens).
// @MX:REASON users is referenced by 45 FK definitions across schema.ts. Extracting
// it establishes the lib/kernel/ boundary. sessions + verificationTokens are Auth.js
// v5 DrizzleAdapter tables that also belong to the kernel auth layer.
// @MX:SPEC SPEC-V3-RESTRUCTURE-001 Phase B (REQ-V3R-005, REQ-V3R-012)
//
// Progressive split (T9.6): auditLogs remains in schema.ts because it references
// `conversations` (a domain table) via FK. Moving it would require either a
// circular import (entry-point-order TDZ risk with evaluation-time enum access)
// or relocating auditActionEnum (~250 lines). Deferred to a follow-up.

import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Kernel pgEnums — moved from schema.ts. All are kernel-only (used exclusively
// by the `users` table). Verified via grep: 0 domain-table consumers.
// ---------------------------------------------------------------------------

export const localeEnum = pgEnum('locale', ['ko', 'en']);
export const themePrefEnum = pgEnum('theme_pref', ['light', 'dark', 'system']);

// REQ-ENTERPRISE-016: user_role pgEnum replaces TEXT role column on users table.
// Migration: 0004_user_role_enum.sql (creates type, migrates 'member' → 'ra-member').
// SPEC-REGULA-ESIG-001: 'qa-lead' added via 0061_answer_signatures.sql (REQ-ESIG-006).
// SPEC-REGULA-AUDITOR-VIEW-001: 'auditor' added via 0062_auditor_view_enums.sql.
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'qa-lead',
  'ra-lead',
  'ra-member',
  'viewer',
  'auditor',
]);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'disabled']);
// REQ-TENANT-001: department pgEnum for secondary RBAC axis (SPEC-REGULA-TENANT-001 Tenant-Lite).
export const userDepartmentEnum = pgEnum('user_department', ['RA', 'Dev', 'Exec', 'External']);

// ---------------------------------------------------------------------------
// Kernel tables
// ---------------------------------------------------------------------------

// REQ-FND-032, REQ-ENTERPRISE-016 (user_role enum), REQ-ENTERPRISE-027 (notification_pref)
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    // REQ-ENTERPRISE-016: migrated from TEXT to user_role pgEnum via 0004_user_role_enum.sql.
    // Default 'ra-member' replaces legacy default 'member'.
    role: userRoleEnum('role').notNull().default('ra-member'),
    locale: localeEnum('locale').notNull().default('ko'),
    themePref: themePrefEnum('theme_pref').notNull().default('system'),
    // @MX:NOTE: [AUTO] REQ-ENTERPRISE-027: notification_pref column — write-only in Phase 5.
    // Phase 6 will add read/update paths. Default '{}' is safe for existing rows.
    notificationPref: jsonb('notification_pref').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // REQ-TENANT-001: nullable department for secondary RBAC axis. null = unrestricted.
    department: userDepartmentEnum('department'),
    // Auth.js v5 DrizzleAdapter requires emailVerified — null = unverified (Credentials flow).
    emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
    // Credentials auth — null means SSO-only account.
    password_hash: text('password_hash'),
    image: text('image'),
    // pending = awaiting admin approval, active = approved, disabled = revoked.
    status: userStatusEnum('status').notNull().default('pending'),
    // Issue #111: force password change on first login (admin bootstrap accounts only).
    mustChangePassword: boolean('must_change_password').notNull().default(false),
  },
  (t) => ({
    // Performance optimization: speed up authentication queries by email
    emailIdx: index('idx_users_email').on(t.email),
    // Performance optimization: filter users by status for admin dashboards
    statusIdx: index('idx_users_status').on(t.status),
  }),
);

// ---------------------------------------------------------------------------
// Auth.js v5 DrizzleAdapter tables — required for database session strategy.
// Migration: 0023_auth_adapter_tables.sql
// ---------------------------------------------------------------------------

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);
