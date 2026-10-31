CREATE TABLE "app"."exam_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"sections" jsonb NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"score" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_attempts_status_check" CHECK ("app"."exam_attempts"."status" IN ('in_progress', 'submitted'))
);
--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_attempts_user_started_idx" ON "app"."exam_attempts" USING btree ("user_id","started_at");