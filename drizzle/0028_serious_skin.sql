DROP VIEW "content"."question_generation_by_class";--> statement-breakpoint
DROP VIEW "content"."question_generation_by_unit";--> statement-breakpoint
ALTER TABLE "app"."frq_attempts" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."mcq_attempts" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."seen_questions" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."study_tasks" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."tutor_profile_classes" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."tutor_target_dates" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "app"."user_progress" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "content"."question_feedback" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "content"."question_quality" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "content"."question_recent_topics" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "content"."question_registry" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "ops"."pool_bucket_write_locks" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
ALTER TABLE "ops"."pool_refill_states" RENAME COLUMN "ap_class" TO "course";--> statement-breakpoint
DROP INDEX "app"."frq_attempts_user_class_unit_idx";--> statement-breakpoint
DROP INDEX "app"."mcq_attempts_user_class_unit_idx";--> statement-breakpoint
DROP INDEX "app"."quiz_attempts_user_class_unit_idx";--> statement-breakpoint
DROP INDEX "content"."frq_questions_bucket_created_idx";--> statement-breakpoint
DROP INDEX "content"."frq_questions_bucket_random_idx";--> statement-breakpoint
DROP INDEX "content"."mcq_questions_bucket_created_idx";--> statement-breakpoint
DROP INDEX "content"."mcq_questions_bucket_random_idx";--> statement-breakpoint
DROP INDEX "content"."question_recent_topics_bucket_created_idx";--> statement-breakpoint
DROP INDEX "content"."question_registry_kind_class_unit_idx";--> statement-breakpoint
DROP INDEX "ops"."pool_bucket_write_locks_bucket_uq";--> statement-breakpoint
DROP INDEX "ops"."pool_refill_states_bucket_uq";--> statement-breakpoint
ALTER TABLE "app"."tutor_profile_classes" DROP CONSTRAINT "tutor_profile_classes_user_id_ap_class_pk";--> statement-breakpoint
ALTER TABLE "app"."tutor_target_dates" DROP CONSTRAINT "tutor_target_dates_user_id_ap_class_pk";--> statement-breakpoint
ALTER TABLE "app"."user_progress" DROP CONSTRAINT "user_progress_user_id_ap_class_unit_pk";--> statement-breakpoint
ALTER TABLE "app"."tutor_profile_classes" ADD CONSTRAINT "tutor_profile_classes_user_id_course_pk" PRIMARY KEY("user_id","course");--> statement-breakpoint
ALTER TABLE "app"."tutor_target_dates" ADD CONSTRAINT "tutor_target_dates_user_id_course_pk" PRIMARY KEY("user_id","course");--> statement-breakpoint
ALTER TABLE "app"."user_progress" ADD CONSTRAINT "user_progress_user_id_course_unit_pk" PRIMARY KEY("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "frq_attempts_user_class_unit_idx" ON "app"."frq_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "mcq_attempts_user_class_unit_idx" ON "app"."mcq_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_class_unit_idx" ON "app"."quiz_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_created_idx" ON "content"."frq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"created_at");--> statement-breakpoint
CREATE INDEX "frq_questions_bucket_random_idx" ON "content"."frq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"active","random_key");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_created_idx" ON "content"."mcq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"created_at");--> statement-breakpoint
CREATE INDEX "mcq_questions_bucket_random_idx" ON "content"."mcq_questions" USING btree (("data" ->> 'course'),("data" ->> 'unit'),"active","random_key");--> statement-breakpoint
CREATE INDEX "question_recent_topics_bucket_created_idx" ON "content"."question_recent_topics" USING btree ("kind","course","unit","created_at");--> statement-breakpoint
CREATE INDEX "question_registry_kind_class_unit_idx" ON "content"."question_registry" USING btree ("kind","course","unit");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_bucket_write_locks_bucket_uq" ON "ops"."pool_bucket_write_locks" USING btree ("question_type","course","unit");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_refill_states_bucket_uq" ON "ops"."pool_refill_states" USING btree ("question_type","course","unit");--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_class" AS (SELECT course, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY course);--> statement-breakpoint
CREATE VIEW "content"."question_generation_by_unit" AS (SELECT course, unit, COUNT(*)::int AS count,
		COALESCE(SUM(content_length), 0)::int AS total_question_chars
	FROM content.question_registry
	WHERE kind = 'mcq'
	GROUP BY course, unit);