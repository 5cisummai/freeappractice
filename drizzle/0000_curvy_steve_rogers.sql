CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"seats" integer,
	"billing_interval" text,
	"stripe_schedule_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."bookmarks" (
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "app"."coach_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"model_id" text NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."experiment_assignments" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"variant" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_assignments_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "app"."frq_attempt_criterion_grades" (
	"attempt_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"section_id" text NOT NULL,
	"label" text NOT NULL,
	"points" real NOT NULL,
	"points_available" real NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"feedback" text NOT NULL,
	CONSTRAINT "frq_attempt_criterion_grades_attempt_id_criterion_id_pk" PRIMARY KEY("attempt_id","criterion_id")
);
--> statement-breakpoint
CREATE TABLE "app"."frq_attempt_grades" (
	"attempt_id" text PRIMARY KEY NOT NULL,
	"points_earned" real NOT NULL,
	"points_available" real NOT NULL,
	"percentage" real NOT NULL,
	"overall_feedback" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."frq_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"question_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"format_id" text NOT NULL,
	"responses" jsonb NOT NULL,
	"status" text NOT NULL,
	"time_taken_ms" integer NOT NULL,
	"profile_version" text NOT NULL,
	"rubric_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"grading_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."frq_materials" (
	"question_id" text NOT NULL,
	"material_id" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "frq_materials_question_id_material_id_pk" PRIMARY KEY("question_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "content"."frq_questions" (
	"question_id" text PRIMARY KEY NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"format_id" text NOT NULL,
	"profile_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"rubric_version" text NOT NULL,
	"schema_version" integer NOT NULL,
	"prompt" text NOT NULL,
	"total_points" real NOT NULL,
	"topics_covered" text NOT NULL,
	"content_hash" text NOT NULL,
	"random_key" real NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."frq_rubric_criteria" (
	"question_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"section_id" text NOT NULL,
	"label" text NOT NULL,
	"max_points" real NOT NULL,
	"reference_answer" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "frq_rubric_criteria_question_id_criterion_id_pk" PRIMARY KEY("question_id","criterion_id")
);
--> statement-breakpoint
CREATE TABLE "content"."frq_rubric_levels" (
	"question_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"points" real NOT NULL,
	"description" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "frq_rubric_levels_question_id_criterion_id_points_pk" PRIMARY KEY("question_id","criterion_id","points")
);
--> statement-breakpoint
CREATE TABLE "content"."frq_sections" (
	"question_id" text NOT NULL,
	"section_id" text NOT NULL,
	"label" text NOT NULL,
	"prompt" text NOT NULL,
	"response_kind" text NOT NULL,
	"max_points" real NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "frq_sections_question_id_section_id_pk" PRIMARY KEY("question_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "ops"."generation_rollup_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"source_collection" text NOT NULL,
	"ap_class" text,
	"unit" text,
	"count" integer NOT NULL,
	"total_question_chars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."insight_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"report" jsonb NOT NULL,
	"evidence_attempt_count" integer NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"manual" boolean NOT NULL,
	"pdf_data" bytea,
	"pdf_generated_at" timestamp with time zone,
	"pdf_generation_version" integer,
	"feedback" text,
	"feedback_reason" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."mcq_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"selected_answer" text,
	"was_correct" boolean,
	"time_taken_ms" integer,
	"attempted_at" timestamp with time zone NOT NULL,
	"final_answer" text,
	"answer_count" integer,
	"hints_shown" integer,
	"terminal_outcome" text,
	"experiment_key" text,
	"experiment_version" integer,
	"displayed_variant" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."mcq_questions" (
	"question_id" text PRIMARY KEY NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text DEFAULT 'all-units' NOT NULL,
	"content_hash" text NOT NULL,
	"topics_covered" text,
	"question" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text NOT NULL,
	"option_d" text NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation" text NOT NULL,
	"hint_1" text,
	"hint_2" text,
	"random_key" real NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."migration_ledger" (
	"run_id" text NOT NULL,
	"source_collection" text NOT NULL,
	"source_id" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" text NOT NULL,
	"checksum" text NOT NULL,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "migration_ledger_source_collection_source_id_target_table_pk" PRIMARY KEY("source_collection","source_id","target_table")
);
--> statement-breakpoint
CREATE TABLE "ops"."migration_rejects" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source_collection" text NOT NULL,
	"source_id" text,
	"reason" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."migration_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"phase" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "ops"."pool_bucket_write_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"question_type" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."pool_generation_budgets" (
	"day_key" text PRIMARY KEY NOT NULL,
	"generations" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."pool_refill_states" (
	"id" text PRIMARY KEY NOT NULL,
	"question_type" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"status" text NOT NULL,
	"target" integer NOT NULL,
	"observed_count" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."quality_review_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"submission_key" text NOT NULL,
	"input_file_id" text NOT NULL,
	"batch_id" text,
	"status" text NOT NULL,
	"output_file_id" text,
	"error_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content"."quality_review_job_candidates" (
	"job_id" text NOT NULL,
	"question_id" text NOT NULL,
	"position" integer NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	CONSTRAINT "quality_review_job_candidates_job_id_question_id_pk" PRIMARY KEY("job_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "content"."quality_review_job_items" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"question_id" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"batch_id" text,
	"submission_key" text,
	"blind" boolean DEFAULT false NOT NULL,
	"requires_web_search" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."quality_review_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"filters" jsonb NOT NULL,
	"selected_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"queued_count" integer DEFAULT 0 NOT NULL,
	"submitted_count" integer DEFAULT 0 NOT NULL,
	"awaiting_human_count" integer DEFAULT 0 NOT NULL,
	"final_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"estimated_input_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_maximum_cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"actual_cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"rubric_version" text NOT NULL,
	"calibrated" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone,
	"active_batch_id" text,
	"active_input_file_id" text,
	"active_output_file_id" text,
	"active_submission_key" text,
	"processing_lease_until" timestamp with time zone,
	"submission_lease_until" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."question_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"ap_class" text,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."question_quality" (
	"question_id" text PRIMARY KEY NOT NULL,
	"source_hash" text,
	"source_etag" text,
	"source_created_at" timestamp with time zone,
	"ap_class" text,
	"unit" text,
	"state" text DEFAULT 'unreviewed' NOT NULL,
	"ai_assessment" jsonb,
	"human_assessment" jsonb,
	"final_verdict" text,
	"final_source" text,
	"finalized_at" timestamp with time zone,
	"needs_human_review" boolean DEFAULT false NOT NULL,
	"human_review_reason" text,
	"blind_human_review" boolean DEFAULT false NOT NULL,
	"answer_incorrect_count" integer DEFAULT 0 NOT NULL,
	"question_unclear_count" integer DEFAULT 0 NOT NULL,
	"explanation_unclear_count" integer DEFAULT 0 NOT NULL,
	"unique_reporters" integer DEFAULT 0 NOT NULL,
	"feedback_priority" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."question_quality_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"from_verdict" text,
	"to_verdict" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "content"."question_recent_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"topics_covered" text NOT NULL,
	"question_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."question_registry" (
	"question_id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ap_class" text,
	"unit" text,
	"question_created_at" timestamp with time zone,
	"s3_etag" text,
	"content_hash" text,
	"content_length" integer,
	"metadata_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."schema_migrations" (
	"id" text PRIMARY KEY NOT NULL,
	"checksum" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."study_plan_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."study_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."study_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"mode" text NOT NULL,
	"task_date" date NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"practice_href" text
);
--> statement-breakpoint
CREATE TABLE "app"."super_billing_access" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancel_at" timestamp with time zone,
	"past_due_since" timestamp with time zone,
	"super_ended_at" timestamp with time zone,
	"billing_issue" text,
	"billing_issue_at" timestamp with time zone,
	"last_stripe_event_id" text,
	"last_stripe_event_created" timestamp with time zone,
	"last_billing_event_created" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."super_cleanup_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mem0_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."super_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."super_usage_rollups" (
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"personalized_messages" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "super_usage_rollups_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
CREATE TABLE "app"."tutor_profile_classes" (
	"user_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tutor_profile_classes_user_id_ap_class_pk" PRIMARY KEY("user_id","ap_class")
);
--> statement-breakpoint
CREATE TABLE "app"."tutor_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"mem0_user_id" text NOT NULL,
	"study_availability" text DEFAULT '' NOT NULL,
	"teaching_style" text DEFAULT 'socratic' NOT NULL,
	"memory_enabled" boolean DEFAULT true NOT NULL,
	"memory_disclosure_seen_at" timestamp with time zone,
	"super_free_beta_claimed_at" timestamp with time zone,
	"super_access_started_at" timestamp with time zone,
	"super_ended_at" timestamp with time zone,
	"memory_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."tutor_target_dates" (
	"user_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"target_date" date NOT NULL,
	CONSTRAINT "tutor_target_dates_user_id_ap_class_pk" PRIMARY KEY("user_id","ap_class")
);
--> statement-breakpoint
CREATE TABLE "app"."user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"referral_code" text,
	"subjects" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_progress" (
	"user_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"mastery" real DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_progress_user_id_ap_class_unit_pk" PRIMARY KEY("user_id","ap_class","unit"),
	CONSTRAINT "user_progress_mastery_range" CHECK ("app"."user_progress"."mastery" >= 0 AND "app"."user_progress"."mastery" <= 100)
);
--> statement-breakpoint
CREATE TABLE "app"."user_subjects" (
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_subjects_user_id_subject_pk" PRIMARY KEY("user_id","subject")
);
--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_audits" ADD CONSTRAINT "coach_audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."experiment_assignments" ADD CONSTRAINT "experiment_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."frq_attempt_criterion_grades" ADD CONSTRAINT "frq_attempt_criterion_grades_attempt_id_frq_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "app"."frq_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."frq_attempt_grades" ADD CONSTRAINT "frq_attempt_grades_attempt_id_frq_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "app"."frq_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD CONSTRAINT "frq_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."frq_materials" ADD CONSTRAINT "frq_materials_question_id_frq_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."frq_questions"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."frq_questions" ADD CONSTRAINT "frq_questions_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."frq_rubric_criteria" ADD CONSTRAINT "frq_rubric_criteria_question_id_frq_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."frq_questions"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."frq_sections" ADD CONSTRAINT "frq_sections_question_id_frq_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."frq_questions"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."insight_reports" ADD CONSTRAINT "insight_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" ADD CONSTRAINT "mcq_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" ADD CONSTRAINT "mcq_questions_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."migration_ledger" ADD CONSTRAINT "migration_ledger_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."migration_rejects" ADD CONSTRAINT "migration_rejects_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_batches" ADD CONSTRAINT "quality_review_batches_job_id_quality_review_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "content"."quality_review_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_candidates" ADD CONSTRAINT "quality_review_job_candidates_job_id_quality_review_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "content"."quality_review_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_candidates" ADD CONSTRAINT "quality_review_job_candidates_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_items" ADD CONSTRAINT "quality_review_job_items_job_id_quality_review_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "content"."quality_review_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_items" ADD CONSTRAINT "quality_review_job_items_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_feedback" ADD CONSTRAINT "question_feedback_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_feedback" ADD CONSTRAINT "question_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_quality" ADD CONSTRAINT "question_quality_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_quality_audits" ADD CONSTRAINT "question_quality_audits_question_id_question_quality_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_quality"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."study_plan_audits" ADD CONSTRAINT "study_plan_audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."study_plans" ADD CONSTRAINT "study_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."study_tasks" ADD CONSTRAINT "study_tasks_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "app"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."super_billing_access" ADD CONSTRAINT "super_billing_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."super_grants" ADD CONSTRAINT "super_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."super_usage_rollups" ADD CONSTRAINT "super_usage_rollups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tutor_profile_classes" ADD CONSTRAINT "tutor_profile_classes_user_id_tutor_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."tutor_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tutor_target_dates" ADD CONSTRAINT "tutor_target_dates_user_id_tutor_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."tutor_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_subjects" ADD CONSTRAINT "user_subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_account_uq" ON "auth"."accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_rate_limits_key_uq" ON "auth"."rate_limits" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_uq" ON "auth"."sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_subscriptions_reference_id_idx" ON "auth"."subscriptions" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_subscriptions_stripe_subscription_uq" ON "auth"."subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "auth_subscriptions_stripe_customer_idx" ON "auth"."subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_uq" ON "auth"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "coach_audits_user_session_idx" ON "app"."coach_audits" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "frq_attempts_user_submission_uq" ON "app"."frq_attempts" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE INDEX "frq_attempts_user_created_idx" ON "app"."frq_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "frq_attempts_user_class_unit_idx" ON "app"."frq_attempts" USING btree ("user_id","ap_class","unit");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_created_idx" ON "content"."frq_questions" USING btree ("ap_class","unit","created_at");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_random_idx" ON "content"."frq_questions" USING btree ("ap_class","unit","active","random_key");--> statement-breakpoint
CREATE UNIQUE INDEX "frq_questions_content_hash_uq" ON "content"."frq_questions" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_rollup_snapshots_source_uq" ON "ops"."generation_rollup_snapshots" USING btree ("source_collection","ap_class","unit");--> statement-breakpoint
CREATE INDEX "insight_reports_user_generated_idx" ON "app"."insight_reports" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE INDEX "mcq_attempts_user_attempted_idx" ON "app"."mcq_attempts" USING btree ("user_id","attempted_at");--> statement-breakpoint
CREATE INDEX "mcq_attempts_question_idx" ON "app"."mcq_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "mcq_attempts_user_class_unit_idx" ON "app"."mcq_attempts" USING btree ("user_id","ap_class","unit");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_created_idx" ON "content"."mcq_questions" USING btree ("ap_class","unit","created_at");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_random_idx" ON "content"."mcq_questions" USING btree ("ap_class","unit","active","random_key");--> statement-breakpoint
CREATE UNIQUE INDEX "mcq_questions_content_hash_uq" ON "content"."mcq_questions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "migration_ledger_run_idx" ON "ops"."migration_ledger" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "migration_rejects_run_collection_idx" ON "ops"."migration_rejects" USING btree ("run_id","source_collection");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_bucket_write_locks_bucket_uq" ON "ops"."pool_bucket_write_locks" USING btree ("question_type","ap_class","unit");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_refill_states_bucket_uq" ON "ops"."pool_refill_states" USING btree ("question_type","ap_class","unit");--> statement-breakpoint
CREATE INDEX "pool_refill_states_claim_idx" ON "ops"."pool_refill_states" USING btree ("status","next_attempt_at","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quality_review_batches_submission_key_uq" ON "content"."quality_review_batches" USING btree ("submission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quality_review_job_items_question_uq" ON "content"."quality_review_job_items" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quality_review_job_items_job_status_idx" ON "content"."quality_review_job_items" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "quality_review_jobs_status_idx" ON "content"."quality_review_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "question_feedback_user_question_type_uq" ON "content"."question_feedback" USING btree ("question_id","user_id","type");--> statement-breakpoint
CREATE INDEX "question_feedback_question_idx" ON "content"."question_feedback" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_quality_state_idx" ON "content"."question_quality" USING btree ("state");--> statement-breakpoint
CREATE INDEX "question_quality_review_idx" ON "content"."question_quality" USING btree ("needs_human_review");--> statement-breakpoint
CREATE INDEX "question_quality_verdict_idx" ON "content"."question_quality" USING btree ("final_verdict");--> statement-breakpoint
CREATE INDEX "question_quality_audits_question_at_idx" ON "content"."question_quality_audits" USING btree ("question_id","at");--> statement-breakpoint
CREATE INDEX "question_recent_topics_bucket_created_idx" ON "content"."question_recent_topics" USING btree ("kind","ap_class","unit","created_at");--> statement-breakpoint
CREATE INDEX "question_registry_kind_class_unit_idx" ON "content"."question_registry" USING btree ("kind","ap_class","unit");--> statement-breakpoint
CREATE INDEX "question_registry_question_created_idx" ON "content"."question_registry" USING btree ("question_created_at");--> statement-breakpoint
CREATE INDEX "question_registry_content_hash_idx" ON "content"."question_registry" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_user_uq" ON "app"."referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_activated_idx" ON "app"."referrals" USING btree ("referrer_user_id","activated_at");--> statement-breakpoint
CREATE INDEX "study_plan_audits_user_created_idx" ON "app"."study_plan_audits" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "study_plans_user_uq" ON "app"."study_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_tasks_plan_date_idx" ON "app"."study_tasks" USING btree ("plan_id","task_date");--> statement-breakpoint
CREATE UNIQUE INDEX "super_billing_access_subscription_uq" ON "app"."super_billing_access" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "super_billing_access_user_idx" ON "app"."super_billing_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "super_billing_access_status_idx" ON "app"."super_billing_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "super_cleanup_jobs_claim_idx" ON "ops"."super_cleanup_jobs" USING btree ("next_attempt_at","completed_at");--> statement-breakpoint
CREATE INDEX "super_cleanup_jobs_user_kind_idx" ON "ops"."super_cleanup_jobs" USING btree ("user_id","kind","completed_at");--> statement-breakpoint
CREATE INDEX "super_grants_user_expiry_idx" ON "app"."super_grants" USING btree ("user_id","starts_at","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_profiles_mem0_user_uq" ON "app"."tutor_profiles" USING btree ("mem0_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_referral_code_uq" ON "app"."user_profiles" USING btree ("referral_code");--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_class" AS (SELECT ap_class, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY ap_class);--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_global_unit" AS (SELECT unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY unit);--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_unit" AS (SELECT ap_class, unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY ap_class, unit);
