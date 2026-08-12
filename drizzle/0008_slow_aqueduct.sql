CREATE TABLE "app"."shared_practice_set_items" (
	"shared_practice_set_id" text NOT NULL,
	"position" integer NOT NULL,
	"item_type" text DEFAULT 'mcq' NOT NULL,
	"question_id" text NOT NULL,
	"question_content_hash" text,
	CONSTRAINT "shared_practice_set_items_shared_practice_set_id_position_pk" PRIMARY KEY("shared_practice_set_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."shared_practice_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'quiz' NOT NULL,
	"creator_user_id" text,
	"title" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"item_count" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD COLUMN "shared_practice_set_id" text;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_set_items" ADD CONSTRAINT "shared_practice_set_items_shared_practice_set_id_shared_practice_sets_id_fk" FOREIGN KEY ("shared_practice_set_id") REFERENCES "app"."shared_practice_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_practice_sets" ADD CONSTRAINT "shared_practice_sets_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shared_practice_set_items_question_uq" ON "app"."shared_practice_set_items" USING btree ("shared_practice_set_id","question_id");--> statement-breakpoint
CREATE INDEX "shared_practice_set_items_question_idx" ON "app"."shared_practice_set_items" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_practice_sets_slug_uq" ON "app"."shared_practice_sets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shared_practice_sets_status_expiry_idx" ON "app"."shared_practice_sets" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "shared_practice_sets_creator_idx" ON "app"."shared_practice_sets" USING btree ("creator_user_id","created_at");