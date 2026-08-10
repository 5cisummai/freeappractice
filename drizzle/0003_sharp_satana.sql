ALTER TABLE "content"."mcq_questions" ADD COLUMN "diagram_spec" jsonb;--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" ADD COLUMN "has_diagram" boolean DEFAULT false NOT NULL;
