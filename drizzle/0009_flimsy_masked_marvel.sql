CREATE TABLE "app"."classroom_courses" (
	"organization_id" text NOT NULL,
	"course" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_courses_organization_id_course_pk" PRIMARY KEY("organization_id","course")
);
--> statement-breakpoint
CREATE TABLE "app"."classroom_creation_grants" (
	"user_id" text NOT NULL,
	"granted_by" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_creation_grants_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."classroom_enrollment_history" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_enrollment_history_role_check" CHECK ("app"."classroom_enrollment_history"."role" IN ('owner', 'admin', 'member'))
);
--> statement-breakpoint
CREATE TABLE "app"."organization_activity_preferences" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_activity_preferences_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."practice_activity_audiences" (
	"event_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_activity_audiences_event_id_organization_id_pk" PRIMARY KEY("event_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "app"."practice_activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"course" text NOT NULL,
	"unit" text NOT NULL,
	"score_percent" integer,
	"questions_answered" integer NOT NULL,
	"correct_questions" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_activity_events_source_type_check" CHECK ("app"."practice_activity_events"."source_type" IN ('quiz', 'exam', 'frq'))
);
--> statement-breakpoint
CREATE TABLE "app"."practice_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"mode" text NOT NULL,
	"course" text,
	"status" text DEFAULT 'open' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"question_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_sessions_mode_check" CHECK ("app"."practice_sessions"."mode" IN ('mcq', 'quiz', 'frq', 'exam')),
	CONSTRAINT "practice_sessions_status_check" CHECK ("app"."practice_sessions"."status" IN ('open', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" DROP CONSTRAINT IF EXISTS "shared_practice_sets_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "app"."frq_attempts_user_submission_uq";--> statement-breakpoint
ALTER TABLE "app"."bookmarks" DROP CONSTRAINT IF EXISTS "bookmarks_user_id_question_id_pk";--> statement-breakpoint
ALTER TABLE "app"."user_progress" DROP CONSTRAINT IF EXISTS "user_progress_user_id_course_unit_pk";--> statement-breakpoint
ALTER TABLE "app"."bookmarks" ADD COLUMN "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."bookmarks" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD COLUMN "practice_session_id" text;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD COLUMN "practice_session_id" text;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" ADD COLUMN "practice_session_id" text;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD COLUMN "practice_session_id" text;--> statement-breakpoint
ALTER TABLE "app"."seen_questions" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."user_progress" ADD COLUMN "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."user_progress" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "app"."classroom_courses" ADD CONSTRAINT "classroom_courses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."classroom_creation_grants" ADD CONSTRAINT "classroom_creation_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."classroom_enrollment_history" ADD CONSTRAINT "classroom_enrollment_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."classroom_enrollment_history" ADD CONSTRAINT "classroom_enrollment_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."organization_activity_preferences" ADD CONSTRAINT "organization_activity_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."organization_activity_preferences" ADD CONSTRAINT "organization_activity_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."practice_activity_audiences" ADD CONSTRAINT "practice_activity_audiences_event_id_practice_activity_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "app"."practice_activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."practice_activity_audiences" ADD CONSTRAINT "practice_activity_audiences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."practice_activity_events" ADD CONSTRAINT "practice_activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."practice_sessions" ADD CONSTRAINT "practice_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classroom_courses_order_idx" ON "app"."classroom_courses" USING btree ("organization_id","position");--> statement-breakpoint
CREATE INDEX "classroom_creation_grants_active_idx" ON "app"."classroom_creation_grants" USING btree ("user_id") WHERE "app"."classroom_creation_grants"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "classroom_enrollment_history_org_user_idx" ON "app"."classroom_enrollment_history" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "classroom_enrollment_history_org_left_idx" ON "app"."classroom_enrollment_history" USING btree ("organization_id","left_at");--> statement-breakpoint
CREATE INDEX "organization_activity_preferences_user_idx" ON "app"."organization_activity_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "practice_activity_audiences_org_idx" ON "app"."practice_activity_audiences" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_activity_events_source_uq" ON "app"."practice_activity_events" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "practice_activity_events_completed_idx" ON "app"."practice_activity_events" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "practice_sessions_user_started_idx" ON "app"."practice_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "practice_sessions_org_started_idx" ON "app"."practice_sessions" USING btree ("organization_id","started_at");--> statement-breakpoint
ALTER TABLE "app"."bookmarks" ADD CONSTRAINT "bookmarks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD CONSTRAINT "exam_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD CONSTRAINT "exam_attempts_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "app"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD CONSTRAINT "frq_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD CONSTRAINT "frq_attempts_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "app"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" ADD CONSTRAINT "mcq_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" ADD CONSTRAINT "mcq_attempts_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "app"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "app"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."seen_questions" ADD CONSTRAINT "seen_questions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" ADD CONSTRAINT "shared_practice_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_progress" ADD CONSTRAINT "user_progress_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_personal_uq" ON "app"."bookmarks" USING btree ("user_id","question_id") WHERE "app"."bookmarks"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_classroom_uq" ON "app"."bookmarks" USING btree ("organization_id","user_id","question_id") WHERE "app"."bookmarks"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "exam_attempts_org_started_idx" ON "app"."exam_attempts" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE INDEX "exam_attempts_session_idx" ON "app"."exam_attempts" USING btree ("practice_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "frq_attempts_personal_submission_uq" ON "app"."frq_attempts" USING btree ("user_id","submission_id") WHERE "app"."frq_attempts"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "frq_attempts_classroom_submission_uq" ON "app"."frq_attempts" USING btree ("organization_id","user_id","submission_id") WHERE "app"."frq_attempts"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "frq_attempts_org_created_idx" ON "app"."frq_attempts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "mcq_attempts_org_attempted_idx" ON "app"."mcq_attempts" USING btree ("organization_id","attempted_at");--> statement-breakpoint
CREATE INDEX "mcq_attempts_session_idx" ON "app"."mcq_attempts" USING btree ("practice_session_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_org_completed_idx" ON "app"."quiz_attempts" USING btree ("organization_id","completed_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_session_idx" ON "app"."quiz_attempts" USING btree ("practice_session_id");--> statement-breakpoint
CREATE INDEX "seen_questions_org_seen_idx" ON "app"."seen_questions" USING btree ("organization_id","seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_personal_uq" ON "app"."user_progress" USING btree ("user_id","course","unit") WHERE "app"."user_progress"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_classroom_uq" ON "app"."user_progress" USING btree ("organization_id","user_id","course","unit") WHERE "app"."user_progress"."organization_id" IS NOT NULL;