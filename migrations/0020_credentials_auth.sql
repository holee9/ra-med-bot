-- Add password_hash column for email/password credentials authentication.
-- NULL means SSO-only account; non-NULL means credentials account.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
