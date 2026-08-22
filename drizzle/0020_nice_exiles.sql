ALTER TABLE "content"."frq_materials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content"."frq_rubric_criteria" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content"."frq_rubric_levels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content"."frq_sections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "content"."frq_materials" CASCADE;--> statement-breakpoint
DROP TABLE "content"."frq_rubric_criteria" CASCADE;--> statement-breakpoint
DROP TABLE "content"."frq_rubric_levels" CASCADE;--> statement-breakpoint
DROP TABLE "content"."frq_sections" CASCADE;--> statement-breakpoint
DROP INDEX "content"."frq_questions_bucket_created_idx";--> statement-breakpoint
DROP INDEX "content"."frq_questions_bucket_random_idx";--> statement-breakpoint
DROP INDEX "content"."mcq_questions_bucket_created_idx";--> statement-breakpoint
DROP INDEX "content"."mcq_questions_bucket_random_idx";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" ALTER COLUMN "data" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" ALTER COLUMN "data" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_created_idx" ON "content"."frq_questions" USING btree (("data" ->> 'apClass'),("data" ->> 'unit'),"created_at");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_random_idx" ON "content"."frq_questions" USING btree (("data" ->> 'apClass'),("data" ->> 'unit'),"active","random_key");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_created_idx" ON "content"."mcq_questions" USING btree (("data" ->> 'apClass'),("data" ->> 'unit'),"created_at");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_random_idx" ON "content"."mcq_questions" USING btree (("data" ->> 'apClass'),("data" ->> 'unit'),"active","random_key");--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "ap_class";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "format_id";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "profile_version";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "prompt_version";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "rubric_version";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "schema_version";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "prompt";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "total_points";--> statement-breakpoint
ALTER TABLE "content"."frq_questions" DROP COLUMN "topics_covered";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "ap_class";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "topics_covered";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "question";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "diagram_spec";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "has_diagram";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "option_a";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "option_b";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "option_c";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "option_d";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "correct_answer";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "explanation";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "hint_1";--> statement-breakpoint
ALTER TABLE "content"."mcq_questions" DROP COLUMN "hint_2";