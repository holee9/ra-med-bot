-- REQ-CLINLIT-021~025: evidence_syntheses — GRADE synthesis + CER section drafts.
-- Migration: 0043_evidence_syntheses.sql
-- @MX:SPEC Issue #60

CREATE TABLE IF NOT EXISTS "evidence_syntheses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "search_id" uuid NOT NULL REFERENCES "literature_searches"("id") ON DELETE CASCADE,
  "grade_summary" text NOT NULL,
  "narrative_synthesis" text NOT NULL,
  "cer_section6_draft" text NOT NULL,
  "cer_section7_draft" text NOT NULL,
  "cer_section8_draft" text NOT NULL,
  "high_count" integer NOT NULL DEFAULT 0,
  "moderate_count" integer NOT NULL DEFAULT 0,
  "low_count" integer NOT NULL DEFAULT 0,
  "very_low_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
