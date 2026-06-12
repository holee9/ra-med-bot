-- REQ-CLINLIT-011~014: literature_references — screened article records per search.
-- Migration: 0042_lit_references.sql
-- @MX:SPEC Issue #60

CREATE TABLE IF NOT EXISTS "literature_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "search_id" uuid NOT NULL REFERENCES "literature_searches"("id") ON DELETE CASCADE,
  "pmid" text NOT NULL,
  "title" text NOT NULL,
  "abstract" text,
  "authors" jsonb NOT NULL DEFAULT '[]',
  "journal" text NOT NULL,
  "year" integer NOT NULL,
  "vancouver_citation" text,
  "sign50_level" text,
  "grade_quality" text,
  "screening_decision" text NOT NULL DEFAULT 'pending',
  "screening_reason" text,
  "included" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
