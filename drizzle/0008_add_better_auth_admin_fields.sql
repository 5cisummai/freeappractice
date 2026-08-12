ALTER TABLE "auth"."users"
	ADD COLUMN "role" text,
	ADD COLUMN "banned" boolean DEFAULT false NOT NULL,
	ADD COLUMN "ban_reason" text,
	ADD COLUMN "ban_expires" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "impersonated_by" text;
