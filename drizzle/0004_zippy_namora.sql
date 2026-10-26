CREATE SCHEMA "ap_art_history";
--> statement-breakpoint
CREATE TABLE "ap_art_history"."api_history" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"query" text,
	"work_number" integer,
	"user_id" text,
	"status_code" integer NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ap_art_history"."works" (
	"number" integer PRIMARY KEY NOT NULL,
	"content_area" text NOT NULL,
	"title_designation" text NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"culture" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"date_of_creation" text NOT NULL,
	"materials" text NOT NULL,
	"image_source" text NOT NULL,
	"college_board_source" text NOT NULL,
	"full_identifier" text NOT NULL,
	"image_count" integer NOT NULL,
	"image_view_notes" text DEFAULT '' NOT NULL,
	"official_image_set_pages" jsonb NOT NULL,
	"location_status" text NOT NULL,
	"identifier_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ap_art_history_api_history_at_idx" ON "ap_art_history"."api_history" USING btree ("at");--> statement-breakpoint
CREATE INDEX "ap_art_history_api_history_work_at_idx" ON "ap_art_history"."api_history" USING btree ("work_number","at");--> statement-breakpoint
CREATE INDEX "ap_art_history_api_history_user_at_idx" ON "ap_art_history"."api_history" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "ap_art_history_works_content_area_idx" ON "ap_art_history"."works" USING btree ("content_area");--> statement-breakpoint
CREATE INDEX "ap_art_history_works_location_status_idx" ON "ap_art_history"."works" USING btree ("location_status");