ALTER TABLE "app"."exam_attempts" ADD COLUMN "section_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD COLUMN "section_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD COLUMN "section_completed_at" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exam_attempts" ADD COLUMN "grading" jsonb DEFAULT '{}'::jsonb NOT NULL;