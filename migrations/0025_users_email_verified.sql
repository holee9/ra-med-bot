-- Auth.js v5 DrizzleAdapter: add email_verified column to users.
-- Required by @auth/drizzle-adapter DefaultPostgresUsersTable type.
-- Credentials-only accounts always have NULL (email verification not implemented).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ;
