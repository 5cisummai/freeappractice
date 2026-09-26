CREATE TABLE "tutor_memory_development" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vector" vector(1536),
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "tutor_memory_development_entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vector" vector(1536),
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "tutor_memory_preview" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vector" vector(1536),
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "tutor_memory_preview_entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vector" vector(1536),
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "tutor_memory_production" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vector" vector(1536),
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "tutor_memory_production_entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vector" vector(1536),
	"payload" jsonb
);
--> statement-breakpoint
CREATE INDEX "tutor_memory_development_user_idx" ON "tutor_memory_development" USING btree (("payload"->>'user_id'));--> statement-breakpoint
CREATE INDEX "tutor_memory_development_entities_user_idx" ON "tutor_memory_development_entities" USING btree (("payload"->>'user_id'));--> statement-breakpoint
CREATE INDEX "tutor_memory_preview_user_idx" ON "tutor_memory_preview" USING btree (("payload"->>'user_id'));--> statement-breakpoint
CREATE INDEX "tutor_memory_preview_entities_user_idx" ON "tutor_memory_preview_entities" USING btree (("payload"->>'user_id'));--> statement-breakpoint
CREATE INDEX "tutor_memory_production_user_idx" ON "tutor_memory_production" USING btree (("payload"->>'user_id'));--> statement-breakpoint
CREATE INDEX "tutor_memory_production_entities_user_idx" ON "tutor_memory_production_entities" USING btree (("payload"->>'user_id'));