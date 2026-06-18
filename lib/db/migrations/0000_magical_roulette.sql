CREATE TYPE "public"."audit_action" AS ENUM('llm.call', 'source.access', 'expert_review.flag', 'conversations.list', 'conversation.view', 'conversation.delete', 'message.feedback', 'template.list', 'template.download', 'updates.list', 'dashboard.view', 'projects.list', 'project.create', 'project.update', 'auth.login', 'auth.logout', 'session.invalidate', 'expert_review.create', 'expert_review.assign', 'expert_review.resolve', 'rbac.permission_deny', 'profile.theme_update', 'profile.locale_update', 'checklist.toggle', 'consult.expert_review_auto_flag', 'project.switch', 'profile.update', 'workflow.start', 'workflow.step.complete', 'workflow.step.fail', 'workflow.pause', 'workflow.resume', 'workflow.pending_review', 'workflow.approve', 'workflow.reject', 'workflow.download', 'workflow.edit', 'document.upload', 'document.access', 'document.redact', 'document.chunk', 'document.search', 'redaction_map.access', 'radar.crawler_run', 'radar.notification', 'radar.search', 'chat.query', 'answer.refine', 'predicate_search', 'predicate_comparison_generated', 'predicate_comparison_exported', 'cer_created', 'cer_stage_completed', 'cer_expert_approved', 'cer_exported', 'cer_literature_search', 'impact.assessment_created', 'impact.critical_detected', 'impact.action_item_created', 'pccp_created', 'pccp_component_completed', 'pccp_expert_approved', 'pccp_algorithm_change_triggered', 'pccp_status_changed', 'vigilance_event_created', 'vigilance_reportability_assessed', 'vigilance_report_drafted', 'vigilance_report_exported', 'standards_searched', 'standards_gap_analyzed', 'standards_compliance_updated', 'device_classified', 'digest_generated', 'digest_emailed', 'samd_assessment_created', 'samd_assessment_updated', 'samd_review_approved', 'dhf_created', 'dhf_updated', 'dhf_design_freeze', 'dhf_review_approved', 'submission_package_created', 'submission_package_submitted', 'submission_validation_completed');--> statement-breakpoint
CREATE TYPE "public"."block_type" AS ENUM('prose', 'checklist', 'comparison', 'timeline', 'sources', 'related', 'workflow_result');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'med', 'low');--> statement-breakpoint
CREATE TYPE "public"."expert_review_status" AS ENUM('pending', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('ko', 'en');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('Regulation', 'Guidance', 'Standard', 'Industry', 'Internal');--> statement-breakpoint
CREATE TYPE "public"."theme_pref" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_department" AS ENUM('RA', 'Dev', 'Exec', 'External');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'ra-lead', 'ra-member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('queued', 'running', 'paused', 'pending_review', 'approved', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workflow_type" AS ENUM('submission_drafter', 'audit_response', 'indication_impact', 'predicate_comparison', 'cer', 'pccp', 'vigilance');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "adverse_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" "audit_action" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"conversation_id" uuid,
	"meta_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cer_literature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cer_run_id" uuid NOT NULL,
	"pmid" text NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"vancouver_citation" text,
	"sign50_level" text,
	"grade_quality" text,
	"included" boolean DEFAULT false NOT NULL,
	"exclusion_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"user_id" uuid NOT NULL,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crawler_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawler_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"records_added" integer DEFAULT 0,
	"errors_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"org_id" uuid
);
--> statement-breakpoint
CREATE TABLE "design_history_files" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" uuid NOT NULL,
	"device_name" text NOT NULL,
	"device_model" text,
	"intended_use" text NOT NULL,
	"jurisdiction" text DEFAULT 'FDA' NOT NULL,
	"regulatory_framework" text DEFAULT 'QSR_QMSR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"completeness_score" integer DEFAULT 0 NOT NULL,
	"design_freeze_date" date,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_inputs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"dhf_id" text NOT NULL,
	"input_type" text NOT NULL,
	"requirement_id" text,
	"description" text NOT NULL,
	"source" text,
	"priority" text DEFAULT 'must' NOT NULL,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"dhf_id" text NOT NULL,
	"review_stage" text NOT NULL,
	"review_date" date NOT NULL,
	"attendees" text[] DEFAULT '{}'::text[] NOT NULL,
	"decisions" text,
	"open_actions" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_verifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"dhf_id" text NOT NULL,
	"design_input_id" text,
	"verification_type" text NOT NULL,
	"protocol_title" text NOT NULL,
	"result" text,
	"test_date" date,
	"performed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_description" text NOT NULL,
	"device_type" text NOT NULL,
	"contact_type" text NOT NULL,
	"has_software" boolean DEFAULT false NOT NULL,
	"has_ai_ml" boolean DEFAULT false NOT NULL,
	"is_sterile" boolean DEFAULT false NOT NULL,
	"fda_class" text,
	"fda_pathway" text,
	"fda_product_code" text,
	"fda_regulation_number" text,
	"eu_class" text,
	"eu_pathway" text,
	"eu_rule" text,
	"mfds_class" text,
	"nmpa_class" text,
	"pmda_class" text,
	"classification_rationale" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_syntheses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"grade_summary" text NOT NULL,
	"narrative_synthesis" text NOT NULL,
	"cer_section6_draft" text NOT NULL,
	"cer_section7_draft" text NOT NULL,
	"cer_section8_draft" text NOT NULL,
	"high_count" integer DEFAULT 0 NOT NULL,
	"moderate_count" integer DEFAULT 0 NOT NULL,
	"low_count" integer DEFAULT 0 NOT NULL,
	"very_low_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"assigned_to" uuid,
	"status" "expert_review_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "impact_action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"priority" text NOT NULL,
	"document_type" text,
	"section_reference" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "literature_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"pmid" text NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"journal" text NOT NULL,
	"year" integer NOT NULL,
	"vancouver_citation" text,
	"sign50_level" text,
	"grade_quality" text,
	"screening_decision" text DEFAULT 'pending' NOT NULL,
	"screening_reason" text,
	"included" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "literature_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cer_run_id" uuid NOT NULL,
	"protocol_version" integer DEFAULT 1 NOT NULL,
	"device_description" text NOT NULL,
	"pico_patient" text NOT NULL,
	"pico_intervention" text NOT NULL,
	"pico_comparator" text,
	"pico_outcome" text NOT NULL,
	"search_query" text NOT NULL,
	"mesh_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"after_dedup" integer DEFAULT 0 NOT NULL,
	"after_title_abstract" integer DEFAULT 0 NOT NULL,
	"after_full_text" integer DEFAULT 0 NOT NULL,
	"included_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"block_type" "block_type" NOT NULL,
	"block_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"relevance_score" numeric(4, 3),
	"quoted_offset" integer,
	"quoted_length" integer,
	"cite_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_sources_message_cite_idx" UNIQUE("message_id","cite_index")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content_prose" text DEFAULT '' NOT NULL,
	"confidence_level" "confidence_level",
	"confidence_score" numeric(4, 3),
	"duration_ms" integer,
	"expert_review_required" boolean DEFAULT false NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"model" text,
	"meta_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_digest_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"send_day_of_week" integer DEFAULT 1 NOT NULL,
	"send_hour" integer DEFAULT 9 NOT NULL,
	"min_severity" text DEFAULT 'medium' NOT NULL,
	"include_immediate_alerts" boolean DEFAULT true NOT NULL,
	"recipient_emails" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_digest_preferences_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slack_webhook_url" text,
	"teams_webhook_url" text,
	"from_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_notification_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "org_update_relevance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"update_id" uuid NOT NULL,
	"impact_score" numeric(3, 2) NOT NULL,
	"matched_product_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_update_relevance_org_update_key" UNIQUE("org_id","update_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'standard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pccp_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pccp_version_id" uuid NOT NULL,
	"component_type" text NOT NULL,
	"content_jsonb" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pccp_components_pccp_version_id_component_type_unique" UNIQUE("pccp_version_id","component_type")
);
--> statement-breakpoint
CREATE TABLE "pccp_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"baseline_snapshot_jsonb" jsonb,
	"parent_workflow_id" uuid,
	"device_name" text NOT NULL,
	"manufacturer" text NOT NULL,
	"indication" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"device_class" text,
	"target_markets" text[] DEFAULT '{}'::text[] NOT NULL,
	"color" text,
	"submission_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_impact_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regulatory_update_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"impact_level" text NOT NULL,
	"affected_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"analysis_summary" text,
	"confidence" numeric(3, 2),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ria_update_project_key" UNIQUE("regulatory_update_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "regulatory_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"region" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"affected_product_types" text[] NOT NULL,
	"impact_analysis_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_crawler" text,
	"external_id" text,
	"raw_content_en" text,
	"raw_content_ko" text,
	"impact_type_hint" text,
	"tier1_relevant" boolean,
	"impact_score" numeric(3, 2)
);
--> statement-breakpoint
CREATE TABLE "reportability_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adverse_event_id" uuid NOT NULL,
	"fda_mdr_required" boolean NOT NULL,
	"fda_mdr_deadline_days" integer,
	"eu_mdv_required" boolean NOT NULL,
	"eu_mdv_deadline_days" integer,
	"fsca_required" boolean NOT NULL,
	"assessment_rationale" text NOT NULL,
	"assessed_by_ai" boolean DEFAULT true NOT NULL,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "samd_assessments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"device_description" text NOT NULL,
	"intended_use" text NOT NULL,
	"ai_ml_type" text NOT NULL,
	"imdrf_clinical_situation" text NOT NULL,
	"imdrf_healthcare_situation" text NOT NULL,
	"imdrf_category" text,
	"fda_pathway" text,
	"eu_ai_risk_level" text,
	"pccp_required" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_model_card" jsonb,
	"generated_checklist" jsonb,
	"generated_monitoring_plan" jsonb,
	"expert_review_approved_by" text,
	"expert_review_approved_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"anchor" text NOT NULL,
	"heading" text,
	"text" text NOT NULL,
	"embedding" vector,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_sections_source_anchor_idx" UNIQUE("source_id","anchor")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"org_label" text NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"type" "source_type" NOT NULL,
	"region" text,
	"url" text,
	"full_text_tsv" text,
	"embedding" vector,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standards_applicability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_type_key" text NOT NULL,
	"standard_id" uuid NOT NULL,
	"applicability_reason" text NOT NULL,
	"regulatory_pathway" text NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standards_applicability_device_type_key_standard_id_regulatory_pathway_unique" UNIQUE("device_type_key","standard_id","regulatory_pathway")
);
--> statement-breakpoint
CREATE TABLE "standards_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard_number" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"version" text NOT NULL,
	"publication_year" integer NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"supersedes" text,
	"scope_keywords" text[] DEFAULT ARRAY['']::text[] NOT NULL,
	"fda_recognized" boolean DEFAULT false NOT NULL,
	"eu_harmonized" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standards_catalog_standard_number_unique" UNIQUE("standard_number")
);
--> statement-breakpoint
CREATE TABLE "submission_interactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"package_id" text NOT NULL,
	"interaction_type" text NOT NULL,
	"reference_number" text,
	"description" text NOT NULL,
	"due_date" date,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_packages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" uuid NOT NULL,
	"submission_type" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"device_name" text NOT NULL,
	"submission_number" text,
	"version" text DEFAULT '1.0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"package_manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"region" text,
	"category" text,
	"file_key" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'ra-member' NOT NULL,
	"locale" "locale" DEFAULT 'ko' NOT NULL,
	"theme_pref" "theme_pref" DEFAULT 'system' NOT NULL,
	"notification_pref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"department" "user_department",
	"email_verified" timestamp with time zone,
	"password_hash" text,
	"image" text,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "vigilance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adverse_event_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"report_format" text NOT NULL,
	"draft_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submission_deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"week_id" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_count" integer DEFAULT 0 NOT NULL,
	"critical_count" integer DEFAULT 0 NOT NULL,
	"high_count" integer DEFAULT 0 NOT NULL,
	"medium_count" integer DEFAULT 0 NOT NULL,
	"low_count" integer DEFAULT 0 NOT NULL,
	"digest_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email_sent_at" timestamp with time zone,
	"share_token" text,
	CONSTRAINT "weekly_digests_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"workflow_type" "workflow_type" NOT NULL,
	"status" "workflow_status" DEFAULT 'queued' NOT NULL,
	"input_json" jsonb NOT NULL,
	"result_json" jsonb,
	"step_progress" jsonb,
	"confidence_aggregate" numeric(3, 2),
	"review_required" boolean DEFAULT true NOT NULL,
	"reviewer_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cloudflare_workflow_instance_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_events" ADD CONSTRAINT "adverse_events_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cer_literature" ADD CONSTRAINT "cer_literature_cer_run_id_workflow_runs_id_fk" FOREIGN KEY ("cer_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_runs" ADD CONSTRAINT "crawler_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_history_files" ADD CONSTRAINT "design_history_files_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_history_files" ADD CONSTRAINT "design_history_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_inputs" ADD CONSTRAINT "design_inputs_dhf_id_design_history_files_id_fk" FOREIGN KEY ("dhf_id") REFERENCES "public"."design_history_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_reviews" ADD CONSTRAINT "design_reviews_dhf_id_design_history_files_id_fk" FOREIGN KEY ("dhf_id") REFERENCES "public"."design_history_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_verifications" ADD CONSTRAINT "design_verifications_dhf_id_design_history_files_id_fk" FOREIGN KEY ("dhf_id") REFERENCES "public"."design_history_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_verifications" ADD CONSTRAINT "design_verifications_design_input_id_design_inputs_id_fk" FOREIGN KEY ("design_input_id") REFERENCES "public"."design_inputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_classifications" ADD CONSTRAINT "device_classifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_classifications" ADD CONSTRAINT "device_classifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_syntheses" ADD CONSTRAINT "evidence_syntheses_search_id_literature_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."literature_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_action_items" ADD CONSTRAINT "impact_action_items_assessment_id_regulatory_impact_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."regulatory_impact_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_action_items" ADD CONSTRAINT "impact_action_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_action_items" ADD CONSTRAINT "impact_action_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "literature_references" ADD CONSTRAINT "literature_references_search_id_literature_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."literature_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "literature_searches" ADD CONSTRAINT "literature_searches_cer_run_id_workflow_runs_id_fk" FOREIGN KEY ("cer_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_blocks" ADD CONSTRAINT "message_blocks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_sources" ADD CONSTRAINT "message_sources_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_sources" ADD CONSTRAINT "message_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_digest_preferences" ADD CONSTRAINT "org_digest_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_notification_settings" ADD CONSTRAINT "org_notification_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_update_relevance" ADD CONSTRAINT "org_update_relevance_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_update_relevance" ADD CONSTRAINT "org_update_relevance_update_id_regulatory_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."regulatory_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pccp_components" ADD CONSTRAINT "pccp_components_pccp_version_id_pccp_versions_id_fk" FOREIGN KEY ("pccp_version_id") REFERENCES "public"."pccp_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_impact_assessments" ADD CONSTRAINT "regulatory_impact_assessments_regulatory_update_id_regulatory_updates_id_fk" FOREIGN KEY ("regulatory_update_id") REFERENCES "public"."regulatory_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_impact_assessments" ADD CONSTRAINT "regulatory_impact_assessments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_impact_assessments" ADD CONSTRAINT "regulatory_impact_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportability_assessments" ADD CONSTRAINT "reportability_assessments_adverse_event_id_adverse_events_id_fk" FOREIGN KEY ("adverse_event_id") REFERENCES "public"."adverse_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samd_assessments" ADD CONSTRAINT "samd_assessments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samd_assessments" ADD CONSTRAINT "samd_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sections" ADD CONSTRAINT "source_sections_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards_applicability" ADD CONSTRAINT "standards_applicability_standard_id_standards_catalog_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."standards_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_interactions" ADD CONSTRAINT "submission_interactions_package_id_submission_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."submission_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_packages" ADD CONSTRAINT "submission_packages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_packages" ADD CONSTRAINT "submission_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigilance_reports" ADD CONSTRAINT "vigilance_reports_adverse_event_id_adverse_events_id_fk" FOREIGN KEY ("adverse_event_id") REFERENCES "public"."adverse_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_created" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_created" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user" ON "conversations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_project" ON "conversations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crawler_runs_crawler_name" ON "crawler_runs" USING btree ("crawler_name","started_at");--> statement-breakpoint
CREATE INDEX "idx_crawler_runs_started_at" ON "crawler_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_dhf_org" ON "design_history_files" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_design_inputs_dhf" ON "design_inputs" USING btree ("dhf_id");--> statement-breakpoint
CREATE INDEX "idx_design_reviews_dhf" ON "design_reviews" USING btree ("dhf_id");--> statement-breakpoint
CREATE INDEX "idx_design_verifications_dhf" ON "design_verifications" USING btree ("dhf_id");--> statement-breakpoint
CREATE INDEX "idx_expert_reviews_status_assigned" ON "expert_reviews" USING btree ("status","assigned_to");--> statement-breakpoint
CREATE INDEX "message_blocks_message_order_idx" ON "message_blocks" USING btree ("message_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_expert_review" ON "messages" USING btree ("expert_review_required","created_at");--> statement-breakpoint
CREATE INDEX "idx_org_members_org_id" ON "org_members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_update_relevance_org_impact" ON "org_update_relevance" USING btree ("org_id","impact_score");--> statement-breakpoint
CREATE INDEX "idx_org_update_relevance_update" ON "org_update_relevance" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_project_id" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_projects_org" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ria_project_impact" ON "regulatory_impact_assessments" USING btree ("project_id","impact_level");--> statement-breakpoint
CREATE INDEX "idx_ria_update" ON "regulatory_impact_assessments" USING btree ("regulatory_update_id");--> statement-breakpoint
CREATE INDEX "idx_sources_org" ON "sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_sources_type" ON "sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_sources_region" ON "sources" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_submission_interactions_pkg" ON "submission_interactions" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "idx_submission_packages_org" ON "submission_packages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_user" ON "workflow_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_org" ON "workflow_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_project" ON "workflow_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_status" ON "workflow_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_reviewer" ON "workflow_runs" USING btree ("reviewer_user_id","status");