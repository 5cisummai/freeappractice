DROP TABLE "app"."frq_attempt_criterion_grades" CASCADE;--> statement-breakpoint
DROP TABLE "app"."frq_attempt_grades" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD COLUMN "points_earned" real;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD COLUMN "points_available" real;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD COLUMN "percentage" real;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" ADD COLUMN "grade" jsonb;--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" DROP COLUMN "profile_version";--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" DROP COLUMN "rubric_version";--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" DROP COLUMN "prompt_version";