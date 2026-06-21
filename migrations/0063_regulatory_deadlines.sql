-- SPEC-REGULA-CALENDAR-001: Regulatory Calendar & Deadline Management (Issue #44)
-- Migration: 0063_regulatory_deadlines.sql
--
-- Project-scoped deadline tracker for FDA clocks, EU MDR renewals, ISO surveillance.

-- Add deadline events to the persisted audit_action enum.
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'deadline.created';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'deadline.updated';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'deadline.deleted';

CREATE TABLE IF NOT EXISTS "regulatory_deadlines" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"     uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "title"          text NOT NULL,
  "deadline_type"  text NOT NULL,
  "jurisdiction"   text NOT NULL,
  "due_date"       date NOT NULL,
  "status"         text NOT NULL DEFAULT 'upcoming',
  "reference"      text,
  "notes"          text NOT NULL DEFAULT '',
  "created_by"     uuid REFERENCES "users"("id"),
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

-- Primary access pattern: list deadlines for a project, ordered by due date.
CREATE INDEX IF NOT EXISTS "idx_regulatory_deadlines_project"
  ON "regulatory_deadlines"("project_id", "due_date");

-- Filter by jurisdiction.
CREATE INDEX IF NOT EXISTS "idx_regulatory_deadlines_jurisdiction"
  ON "regulatory_deadlines"("jurisdiction");

-- updated_at maintenance trigger.
CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_regulatory_deadlines_updated_at" ON "regulatory_deadlines";
CREATE TRIGGER "trg_regulatory_deadlines_updated_at"
  BEFORE UPDATE ON "regulatory_deadlines"
  FOR EACH ROW
  EXECUTE FUNCTION "set_updated_at"();
