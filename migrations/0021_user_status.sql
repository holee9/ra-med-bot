CREATE TYPE "user_status" AS ENUM ('pending', 'active', 'disabled');

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "status" "user_status" NOT NULL DEFAULT 'active';

-- Existing users (SSO-created) are already active.
-- New credential signups will be inserted with 'pending'.
