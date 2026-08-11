DROP TABLE "app"."conversation_tool_calls" CASCADE;--> statement-breakpoint
DROP TABLE "app"."learning_events" CASCADE;--> statement-breakpoint
DROP TABLE "app"."student_explanation_strategies" CASCADE;--> statement-breakpoint
DROP TABLE "app"."student_misconceptions" CASCADE;--> statement-breakpoint
DROP TABLE "app"."student_model_jobs" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."coach_audits" DROP COLUMN "tool_call_id";