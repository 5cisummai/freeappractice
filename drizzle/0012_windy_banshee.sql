CREATE TABLE "app"."bug_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"steps" text,
	"expected" text,
	"severity" text NOT NULL,
	"email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_reports_severity_check" CHECK ("app"."bug_reports"."severity" IN ('low', 'medium', 'high'))
);
--> statement-breakpoint
ALTER TABLE "app"."bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_created_idx" ON "app"."bug_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bug_reports_user_idx" ON "app"."bug_reports" USING btree ("user_id");