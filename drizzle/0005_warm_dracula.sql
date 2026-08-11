CREATE TABLE "app"."conversation_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"part_index" integer NOT NULL,
	"tool_name" text NOT NULL,
	"state" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_text" text,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."learning_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"ap_class" text,
	"unit" text,
	"question_id" text,
	"frq_attempt_id" text,
	"quiz_id" text,
	"conversation_id" text,
	"message_id" text,
	"idempotency_key" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."student_explanation_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strategy_key" text NOT NULL,
	"positive_evidence" integer DEFAULT 0 NOT NULL,
	"negative_evidence" integer DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"evidence_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."student_misconceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"concept_key" text NOT NULL,
	"statement" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"evidence_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_evidence_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."student_model_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."coach_audits" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "app"."coach_audits" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "app"."coach_audits" ADD COLUMN "tool_call_id" text;--> statement-breakpoint
ALTER TABLE "app"."conversation_messages" ADD COLUMN "status" text DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."conversation_messages" ADD COLUMN "client_message_id" text;--> statement-breakpoint
ALTER TABLE "app"."conversation_messages" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD COLUMN "surface" text DEFAULT 'coach' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD COLUMN "context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."conversation_tool_calls" ADD CONSTRAINT "conversation_tool_calls_message_id_conversation_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."conversation_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."learning_events" ADD CONSTRAINT "learning_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_explanation_strategies" ADD CONSTRAINT "student_explanation_strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_misconceptions" ADD CONSTRAINT "student_misconceptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_model_jobs" ADD CONSTRAINT "student_model_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_model_jobs" ADD CONSTRAINT "student_model_jobs_event_id_learning_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "app"."learning_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_tool_calls_message_tool_uq" ON "app"."conversation_tool_calls" USING btree ("message_id","tool_call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_tool_calls_message_part_uq" ON "app"."conversation_tool_calls" USING btree ("message_id","part_index");--> statement-breakpoint
CREATE INDEX "conversation_tool_calls_message_part_idx" ON "app"."conversation_tool_calls" USING btree ("message_id","part_index");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_events_user_idempotency_uq" ON "app"."learning_events" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "learning_events_user_occurred_idx" ON "app"."learning_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "learning_events_user_kind_idx" ON "app"."learning_events" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "student_explanation_strategies_user_key_uq" ON "app"."student_explanation_strategies" USING btree ("user_id","strategy_key");--> statement-breakpoint
CREATE INDEX "student_explanation_strategies_user_idx" ON "app"."student_explanation_strategies" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "student_misconceptions_user_claim_uq" ON "app"."student_misconceptions" USING btree ("user_id","ap_class","unit","concept_key","statement");--> statement-breakpoint
CREATE INDEX "student_misconceptions_user_status_idx" ON "app"."student_misconceptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "student_model_jobs_event_uq" ON "app"."student_model_jobs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "student_model_jobs_status_next_idx" ON "app"."student_model_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_conversation_client_uq" ON "app"."conversation_messages" USING btree ("conversation_id","client_message_id");
