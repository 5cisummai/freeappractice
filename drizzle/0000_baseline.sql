CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "app";
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
CREATE TABLE "auth"."invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"org_type" text NOT NULL,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_org_type_check" CHECK ("auth"."organizations"."org_type" IN ('personal', 'group', 'school', 'enterprise'))
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
	"impersonated_by" text,
	"user_id" text NOT NULL,
	"active_organization_id" text
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
	"name" varchar(64) NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
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
CREATE TABLE "app"."app_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_feedback_category_check" CHECK ("app"."app_feedback"."category" IN ('general', 'bug', 'feature_request', 'content', 'other'))
);
--> statement-breakpoint
CREATE TABLE "app"."bookmarks" (
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "app"."bug_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"steps" text,
	"expected" text,
	"severity" text NOT NULL,
	"email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_reports_severity_check" CHECK ("app"."bug_reports"."severity" IN ('low', 'medium', 'high'))
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
	"conversation_id" text,
	"message_id" text,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"client_message_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"surface" text DEFAULT 'coach' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"email_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resend_email_id" text,
	"last_event_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_email_type_check" CHECK ("app"."email_deliveries"."email_type" IN ('verification', 'password_reset', 'email_change', 'account_deletion', 'existing_signup', 'organization_invitation')),
	CONSTRAINT "email_deliveries_status_check" CHECK ("app"."email_deliveries"."status" IN ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."frq_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"question_id" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"format_id" text NOT NULL,
	"responses" jsonb NOT NULL,
	"status" text NOT NULL,
	"time_taken_ms" integer NOT NULL,
	"points_earned" real,
	"points_available" real,
	"percentage" real,
	"grade" jsonb,
	"grading_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."mcq_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"selected_answer" text,
	"was_correct" boolean,
	"time_taken_ms" integer,
	"attempted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_attempt_questions" (
	"quiz_attempt_id" text NOT NULL,
	"position" integer NOT NULL,
	"question_id" text NOT NULL,
	"selected_answer" text,
	"was_correct" boolean,
	"time_taken_ms" integer,
	CONSTRAINT "quiz_attempt_questions_quiz_attempt_id_position_pk" PRIMARY KEY("quiz_attempt_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"requested_count" integer NOT NULL,
	"answered_count" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"incorrect_count" integer NOT NULL,
	"score_percent" integer NOT NULL,
	"time_taken_ms" integer,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"shared_practice_set_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."resend_webhook_events" (
	"svix_id" text PRIMARY KEY NOT NULL,
	"delivery_id" text,
	"resend_email_id" text,
	"event_type" text NOT NULL,
	"event_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."seen_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"question_type" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."shared_practice_set_items" (
	"shared_practice_set_id" text NOT NULL,
	"position" integer NOT NULL,
	"item_type" text DEFAULT 'mcq' NOT NULL,
	"question_id" text NOT NULL,
	"question_content_hash" text,
	CONSTRAINT "shared_practice_set_items_shared_practice_set_id_position_pk" PRIMARY KEY("shared_practice_set_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."shared_practice_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'quiz' NOT NULL,
	"creator_user_id" text,
	"organization_id" text,
	"title" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"item_count" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_practice_sets_kind_check" CHECK ("app"."shared_practice_sets"."kind" = 'quiz'),
	CONSTRAINT "shared_practice_sets_status_check" CHECK ("app"."shared_practice_sets"."status" IN ('active', 'revoked'))
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
	"course" text NOT NULL,
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
	"course" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tutor_profile_classes_user_id_course_pk" PRIMARY KEY("user_id","course")
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
	"course" text NOT NULL,
	"target_date" date NOT NULL,
	CONSTRAINT "tutor_target_dates_user_id_course_pk" PRIMARY KEY("user_id","course")
);
--> statement-breakpoint
CREATE TABLE "app"."user_courses" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_courses_user_id_course_pk" PRIMARY KEY("user_id","course")
);
--> statement-breakpoint
CREATE TABLE "app"."user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"assistant_features_enabled" boolean DEFAULT true NOT NULL,
	"courses" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_progress" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"mastery" real DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_progress_user_id_course_unit_pk" PRIMARY KEY("user_id","course","unit"),
	CONSTRAINT "user_progress_mastery_range" CHECK ("app"."user_progress"."mastery" >= 0 AND "app"."user_progress"."mastery" <= 100)
);
--> statement-breakpoint
CREATE TABLE "content"."frq_questions" (
	"question_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"random_key" real NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."mcq_questions" (
	"question_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"random_key" real NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
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
	"course" text,
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
	"course" text,
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
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"topics_covered" text NOT NULL,
	"question_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."question_registry" (
	"question_id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"course" text,
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
CREATE TABLE "ops"."pool_bucket_write_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"question_type" text NOT NULL,
	"course" text NOT NULL,
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
	"course" text NOT NULL,
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
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_audits" ADD CONSTRAINT "coach_audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD CONSTRAINT "frq_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" ADD CONSTRAINT "mcq_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempt_questions" ADD CONSTRAINT "quiz_attempt_questions_quiz_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("quiz_attempt_id") REFERENCES "app"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_shared_practice_set_id_shared_practice_sets_id_fk" FOREIGN KEY ("shared_practice_set_id") REFERENCES "app"."shared_practice_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."seen_questions" ADD CONSTRAINT "seen_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_set_items" ADD CONSTRAINT "shared_practice_set_items_shared_practice_set_id_shared_practice_sets_id_fk" FOREIGN KEY ("shared_practice_set_id") REFERENCES "app"."shared_practice_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" ADD CONSTRAINT "shared_practice_sets_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" ADD CONSTRAINT "shared_practice_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."study_plans" ADD CONSTRAINT "study_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."study_tasks" ADD CONSTRAINT "study_tasks_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "app"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."super_billing_access" ADD CONSTRAINT "super_billing_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."super_grants" ADD CONSTRAINT "super_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."super_usage_rollups" ADD CONSTRAINT "super_usage_rollups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tutor_profile_classes" ADD CONSTRAINT "tutor_profile_classes_user_id_tutor_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."tutor_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tutor_target_dates" ADD CONSTRAINT "tutor_target_dates_user_id_tutor_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."tutor_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_courses" ADD CONSTRAINT "user_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."frq_questions" ADD CONSTRAINT "frq_questions_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" ADD CONSTRAINT "mcq_questions_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_batches" ADD CONSTRAINT "quality_review_batches_job_id_quality_review_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "content"."quality_review_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_candidates" ADD CONSTRAINT "quality_review_job_candidates_job_id_quality_review_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "content"."quality_review_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_candidates" ADD CONSTRAINT "quality_review_job_candidates_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_items" ADD CONSTRAINT "quality_review_job_items_job_id_quality_review_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "content"."quality_review_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."quality_review_job_items" ADD CONSTRAINT "quality_review_job_items_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_feedback" ADD CONSTRAINT "question_feedback_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_feedback" ADD CONSTRAINT "question_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_quality" ADD CONSTRAINT "question_quality_question_id_question_registry_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_registry"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."question_quality_audits" ADD CONSTRAINT "question_quality_audits_question_id_question_quality_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "content"."question_quality"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_account_uq" ON "auth"."accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_invitations_org_id_idx" ON "auth"."invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auth_invitations_email_idx" ON "auth"."invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_members_org_user_uq" ON "auth"."members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "auth_members_user_id_idx" ON "auth"."members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_organizations_slug_uq" ON "auth"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_organizations_share_token_uq" ON "auth"."organizations" USING btree ("share_token") WHERE "auth"."organizations"."share_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_organizations_org_type_idx" ON "auth"."organizations" USING btree ("org_type");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_rate_limits_key_uq" ON "auth"."rate_limits" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_uq" ON "auth"."sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_subscriptions_reference_id_idx" ON "auth"."subscriptions" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_subscriptions_stripe_subscription_uq" ON "auth"."subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "auth_subscriptions_stripe_customer_idx" ON "auth"."subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_uq" ON "auth"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "app_feedback_created_idx" ON "app"."app_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_feedback_user_idx" ON "app"."app_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bug_reports_created_idx" ON "app"."bug_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bug_reports_user_idx" ON "app"."bug_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coach_audits_user_session_idx" ON "app"."coach_audits" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_conversation_position_uq" ON "app"."conversation_messages" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_conversation_client_uq" ON "app"."conversation_messages" USING btree ("conversation_id","client_message_id");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_created_idx" ON "app"."conversation_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "app"."conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_resend_email_id_uq" ON "app"."email_deliveries" USING btree ("resend_email_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_created_idx" ON "app"."email_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "frq_attempts_user_submission_uq" ON "app"."frq_attempts" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE INDEX "frq_attempts_user_created_idx" ON "app"."frq_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "frq_attempts_user_course_unit_idx" ON "app"."frq_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "mcq_attempts_user_attempted_idx" ON "app"."mcq_attempts" USING btree ("user_id","attempted_at");--> statement-breakpoint
CREATE INDEX "mcq_attempts_question_idx" ON "app"."mcq_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "mcq_attempts_user_course_unit_idx" ON "app"."mcq_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "quiz_attempt_questions_question_idx" ON "app"."quiz_attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_completed_idx" ON "app"."quiz_attempts" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_course_unit_idx" ON "app"."quiz_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_delivery_idx" ON "app"."resend_webhook_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_email_idx" ON "app"."resend_webhook_events" USING btree ("resend_email_id");--> statement-breakpoint
CREATE INDEX "seen_questions_user_seen_idx" ON "app"."seen_questions" USING btree ("user_id","seen_at");--> statement-breakpoint
CREATE INDEX "seen_questions_user_hash_idx" ON "app"."seen_questions" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_practice_set_items_question_uq" ON "app"."shared_practice_set_items" USING btree ("shared_practice_set_id","question_id");--> statement-breakpoint
CREATE INDEX "shared_practice_set_items_question_idx" ON "app"."shared_practice_set_items" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_practice_sets_slug_uq" ON "app"."shared_practice_sets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shared_practice_sets_status_expiry_idx" ON "app"."shared_practice_sets" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "shared_practice_sets_creator_idx" ON "app"."shared_practice_sets" USING btree ("creator_user_id","created_at");--> statement-breakpoint
CREATE INDEX "shared_practice_sets_org_idx" ON "app"."shared_practice_sets" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "study_plans_user_uq" ON "app"."study_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_tasks_plan_date_idx" ON "app"."study_tasks" USING btree ("plan_id","task_date");--> statement-breakpoint
CREATE UNIQUE INDEX "super_billing_access_subscription_uq" ON "app"."super_billing_access" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "super_billing_access_user_idx" ON "app"."super_billing_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "super_billing_access_status_idx" ON "app"."super_billing_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "super_grants_user_expiry_idx" ON "app"."super_grants" USING btree ("user_id","starts_at","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "super_grants_user_indefinite_unrevoked_uq" ON "app"."super_grants" USING btree ("user_id") WHERE "app"."super_grants"."revoked_at" is null and "app"."super_grants"."expires_at" >= '9999-12-31 23:59:59+00'::timestamptz;--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_profiles_mem0_user_uq" ON "app"."tutor_profiles" USING btree ("mem0_user_id");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_created_idx" ON "content"."frq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"created_at");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_random_idx" ON "content"."frq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"active","random_key");--> statement-breakpoint
CREATE UNIQUE INDEX "frq_questions_content_hash_uq" ON "content"."frq_questions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_created_idx" ON "content"."mcq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"created_at");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_random_idx" ON "content"."mcq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"active","random_key");--> statement-breakpoint
CREATE UNIQUE INDEX "mcq_questions_content_hash_uq" ON "content"."mcq_questions" USING btree ("content_hash");--> statement-breakpoint
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
CREATE INDEX "question_recent_topics_bucket_created_idx" ON "content"."question_recent_topics" USING btree ("kind","course","unit","created_at");--> statement-breakpoint
CREATE INDEX "question_registry_kind_course_unit_idx" ON "content"."question_registry" USING btree ("kind","course","unit");--> statement-breakpoint
CREATE INDEX "question_registry_question_created_idx" ON "content"."question_registry" USING btree ("question_created_at");--> statement-breakpoint
CREATE INDEX "question_registry_content_hash_idx" ON "content"."question_registry" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_bucket_write_locks_bucket_uq" ON "ops"."pool_bucket_write_locks" USING btree ("question_type","course","unit");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_refill_states_bucket_uq" ON "ops"."pool_refill_states" USING btree ("question_type","course","unit");--> statement-breakpoint
CREATE INDEX "pool_refill_states_claim_idx" ON "ops"."pool_refill_states" USING btree ("status","next_attempt_at","lease_expires_at");--> statement-breakpoint
CREATE INDEX "super_cleanup_jobs_claim_idx" ON "ops"."super_cleanup_jobs" USING btree ("next_attempt_at","completed_at");--> statement-breakpoint
CREATE INDEX "super_cleanup_jobs_user_kind_idx" ON "ops"."super_cleanup_jobs" USING btree ("user_id","kind","completed_at");--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_course" AS (SELECT course, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY course);--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_global_unit" AS (SELECT unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY unit);--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_unit" AS (SELECT course, unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY course, unit);