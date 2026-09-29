ALTER TABLE "app"."super_usage_rollups" RENAME COLUMN "personalized_messages" TO "credits_milli";--> statement-breakpoint
-- Legacy values were message counts, not millicredits; reset before exposing as credits.
UPDATE "app"."super_usage_rollups" SET "credits_milli" = 0;
