-- Legacy values were message counts, not millicredits; reset before exposing as credits.
UPDATE "app"."super_usage_rollups" SET "credits_milli" = 0;
