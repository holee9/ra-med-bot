-- REQ-CLINLIT-001~005: literature_searches — PICO-based search protocol per CER run.
-- Migration: 0041_lit_searches.sql
-- @MX:SPEC Issue #60

CREATE TABLE IF NOT EXISTS "literature_searches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cer_run_id" uuid NOT NULL REFERENCES "workflow_runs"("id") ON DELETE CASCADE,
  "protocol_version" integer NOT NULL DEFAULT 1,
  "device_description" text NOT NULL,
  "pico_patient" text NOT NULL,
  "pico_intervention" text NOT NULL,
  "pico_comparator" text,
  "pico_outcome" text NOT NULL,
  "search_query" text NOT NULL,
  "mesh_terms" jsonb NOT NULL DEFAULT '[]',
  "total_records" integer NOT NULL DEFAULT 0,
  "after_dedup" integer NOT NULL DEFAULT 0,
  "after_title_abstract" integer NOT NULL DEFAULT 0,
  "after_full_text" integer NOT NULL DEFAULT 0,
  "included_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
