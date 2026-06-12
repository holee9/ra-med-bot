-- SPEC-REGULA-VIGILANCE-001 — Post-Market Surveillance adverse event tables.
-- Three tables: adverse_events, reportability_assessments, vigilance_reports.

CREATE TABLE IF NOT EXISTS "adverse_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_run_id" uuid REFERENCES "workflow_runs"("id") ON DELETE CASCADE,
  "event_date" date NOT NULL,
  "device_name" text NOT NULL,
  "device_model" text,
  "lot_number" text,
  "event_description" text NOT NULL,
  "patient_outcome" text NOT NULL,
  "awareness_date" date NOT NULL,
  "reporter_name" text NOT NULL,
  "reporter_role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "reportability_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "adverse_event_id" uuid NOT NULL REFERENCES "adverse_events"("id") ON DELETE CASCADE,
  "fda_mdr_required" boolean NOT NULL,
  "fda_mdr_deadline_days" integer,
  "eu_mdv_required" boolean NOT NULL,
  "eu_mdv_deadline_days" integer,
  "fsca_required" boolean NOT NULL,
  "assessment_rationale" text NOT NULL,
  "assessed_by_ai" boolean NOT NULL DEFAULT true,
  "reviewed_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vigilance_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "adverse_event_id" uuid NOT NULL REFERENCES "adverse_events"("id") ON DELETE CASCADE,
  "report_type" text NOT NULL,
  "report_format" text NOT NULL,
  "draft_content" jsonb NOT NULL DEFAULT '{}',
  "version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft',
  "submission_deadline" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
