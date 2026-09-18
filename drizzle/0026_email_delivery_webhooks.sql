CREATE TABLE "app"."email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"email_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resend_email_id" text,
	"last_event_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_email_type_check" CHECK ("app"."email_deliveries"."email_type" IN ('verification', 'password_reset', 'email_change', 'account_deletion', 'existing_signup', 'organization_invitation')),
	CONSTRAINT "email_deliveries_status_check" CHECK ("app"."email_deliveries"."status" IN ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."resend_webhook_events" (
	"svix_id" text PRIMARY KEY NOT NULL,
	"delivery_id" text,
	"resend_email_id" text,
	"event_type" text NOT NULL,
	"event_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_resend_email_id_uq" ON "app"."email_deliveries" USING btree ("resend_email_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_created_idx" ON "app"."email_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_delivery_idx" ON "app"."resend_webhook_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_email_idx" ON "app"."resend_webhook_events" USING btree ("resend_email_id");