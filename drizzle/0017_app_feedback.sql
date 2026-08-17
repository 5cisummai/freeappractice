CREATE TABLE "app"."app_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_feedback_category_check" CHECK ("app"."app_feedback"."category" IN ('general', 'bug', 'feature_request', 'content', 'other'))
);
--> statement-breakpoint
ALTER TABLE "app"."app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_feedback_created_idx" ON "app"."app_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_feedback_user_idx" ON "app"."app_feedback" USING btree ("user_id");