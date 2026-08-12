ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_shared_practice_set_id_shared_practice_sets_id_fk" FOREIGN KEY ("shared_practice_set_id") REFERENCES "app"."shared_practice_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" ADD CONSTRAINT "shared_practice_sets_kind_check" CHECK ("app"."shared_practice_sets"."kind" = 'quiz');--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" ADD CONSTRAINT "shared_practice_sets_status_check" CHECK ("app"."shared_practice_sets"."status" IN ('active', 'revoked'));
