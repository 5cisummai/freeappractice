CREATE TABLE "ops"."migration_transforms" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source_collection" text NOT NULL,
	"source_id" text NOT NULL,
	"field_paths" text[] NOT NULL,
	"transformation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops"."migration_transforms" ADD CONSTRAINT "migration_transforms_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "migration_transforms_run_idx" ON "ops"."migration_transforms" USING btree ("run_id","source_collection");