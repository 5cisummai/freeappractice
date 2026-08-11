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
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"requested_count" integer NOT NULL,
	"answered_count" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"incorrect_count" integer NOT NULL,
	"score_percent" integer NOT NULL,
	"time_taken_ms" integer,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."quiz_attempt_questions" ADD CONSTRAINT "quiz_attempt_questions_quiz_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("quiz_attempt_id") REFERENCES "app"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempt_questions_question_idx" ON "app"."quiz_attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_completed_idx" ON "app"."quiz_attempts" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_class_unit_idx" ON "app"."quiz_attempts" USING btree ("user_id","ap_class","unit");