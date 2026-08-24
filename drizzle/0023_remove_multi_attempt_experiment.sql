DROP TABLE "app"."experiment_assignments" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "final_answer";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "answer_count";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "hints_shown";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "terminal_outcome";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "experiment_key";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "experiment_version";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" DROP COLUMN "displayed_variant";