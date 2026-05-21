-- Backfill: image column was added to lib/db/schema.ts but never migrated to DB.
-- DrizzleAdapter requires this field on the users table for OAuth avatar URLs.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" text;
