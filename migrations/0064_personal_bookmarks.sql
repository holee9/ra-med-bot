-- SPEC-REGULA-PERSONAL-LIB-001: Personal RA Library (Issue #86)
-- Migration: 0063_personal_bookmarks.sql
--
-- User-scoped bookmarks for fast re-reference of answers/blocks.
-- Private layer — row-level userId isolation enforces privacy.

-- Add personal library events to the persisted audit_action enum.
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'personal_bookmark.created';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'personal_bookmark.deleted';

CREATE TABLE IF NOT EXISTS "personal_bookmarks" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message_id"   uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "block_id"     uuid,
  "title"        text NOT NULL,
  "custom_title" text,
  "note"         text NOT NULL DEFAULT '',
  "tags"         text[] NOT NULL DEFAULT '{}'::text[],
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);

-- Primary access pattern: list bookmarks for a user, newest first.
CREATE INDEX IF NOT EXISTS "idx_personal_bookmarks_user"
  ON "personal_bookmarks"("user_id", "created_at");

-- Tag filter acceleration.
CREATE INDEX IF NOT EXISTS "idx_personal_bookmarks_user_tags"
  ON "personal_bookmarks"("user_id", "tags");

-- Uniqueness: one bookmark per (user, message, block).
-- COALESCE normalizes NULL block_id so a message-level bookmark is distinct from
-- any block-level bookmark on the same message, and duplicates are rejected.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_personal_bookmarks_unique"
  ON "personal_bookmarks"(
    "user_id",
    "message_id",
    COALESCE("block_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- updated_at maintenance trigger (matches convention used by other tables).
CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_personal_bookmarks_updated_at" ON "personal_bookmarks";
CREATE TRIGGER "trg_personal_bookmarks_updated_at"
  BEFORE UPDATE ON "personal_bookmarks"
  FOR EACH ROW
  EXECUTE FUNCTION "set_updated_at"();
