CREATE TYPE "public"."control_tier" AS ENUM('inherent', 'protective', 'information');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('acc', 'alarp', 'unacc');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'risk.hazard_identified';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'risk.matrix_evaluated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'risk.control_adopted';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'risk.residual_accepted';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'risk.gspr_mapped';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'risk.report_approved';--> statement-breakpoint
ALTER TYPE "public"."workflow_type" ADD VALUE 'risk';--> statement-breakpoint
CREATE TABLE "risk_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_item_id" uuid NOT NULL,
	"tier" "control_tier" NOT NULL,
	"description" text NOT NULL,
	"rationale" text,
	"is_adopted" boolean DEFAULT false NOT NULL,
	"residual_severity" integer,
	"residual_probability" integer,
	"residual_risk_level" "risk_level",
	"alarp_justification" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_gspr_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"risk_item_id" uuid,
	"gspr_clause" text NOT NULL,
	"requirement" text NOT NULL,
	"compliance" text NOT NULL,
	"evidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"hazard" text NOT NULL,
	"sequence_of_events" text NOT NULL,
	"hazardous_situation" text NOT NULL,
	"harm" text NOT NULL,
	"citation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" integer NOT NULL,
	"probability" integer NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"low_confidence" boolean DEFAULT false NOT NULL,
	"edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_controls" ADD CONSTRAINT "risk_controls_risk_item_id_risk_items_id_fk" FOREIGN KEY ("risk_item_id") REFERENCES "public"."risk_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_gspr_mappings" ADD CONSTRAINT "risk_gspr_mappings_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_gspr_mappings" ADD CONSTRAINT "risk_gspr_mappings_risk_item_id_risk_items_id_fk" FOREIGN KEY ("risk_item_id") REFERENCES "public"."risk_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_risk_controls_item" ON "risk_controls" USING btree ("risk_item_id");--> statement-breakpoint
CREATE INDEX "idx_risk_gspr_run" ON "risk_gspr_mappings" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "idx_risk_items_run" ON "risk_items" USING btree ("workflow_run_id");