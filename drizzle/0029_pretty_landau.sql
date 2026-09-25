ALTER VIEW "content"."question_generation_by_class" RENAME TO "question_generation_by_course";--> statement-breakpoint
ALTER TABLE "app"."user_subjects" RENAME TO "user_courses";--> statement-breakpoint
ALTER TABLE "app"."user_profiles" RENAME COLUMN "subjects" TO "courses";--> statement-breakpoint
ALTER TABLE "app"."user_courses" RENAME COLUMN "subject" TO "course";--> statement-breakpoint
ALTER TABLE "app"."user_courses" DROP CONSTRAINT "user_subjects_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "app"."frq_attempts_user_class_unit_idx";--> statement-breakpoint
DROP INDEX "app"."mcq_attempts_user_class_unit_idx";--> statement-breakpoint
DROP INDEX "app"."quiz_attempts_user_class_unit_idx";--> statement-breakpoint
DROP INDEX "content"."question_registry_kind_class_unit_idx";--> statement-breakpoint
ALTER TABLE "app"."user_courses" DROP CONSTRAINT "user_subjects_user_id_subject_pk";--> statement-breakpoint
ALTER TABLE "app"."user_courses" ADD CONSTRAINT "user_courses_user_id_course_pk" PRIMARY KEY("user_id","course");--> statement-breakpoint
ALTER TABLE "app"."user_courses" ADD CONSTRAINT "user_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "frq_attempts_user_course_unit_idx" ON "app"."frq_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "mcq_attempts_user_course_unit_idx" ON "app"."mcq_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_course_unit_idx" ON "app"."quiz_attempts" USING btree ("user_id","course","unit");--> statement-breakpoint
CREATE INDEX "question_registry_kind_course_unit_idx" ON "content"."question_registry" USING btree ("kind","course","unit");