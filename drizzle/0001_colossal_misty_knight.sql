CREATE TABLE "ops"."better_auth_migration_map" (
	"legacy_user_id" text PRIMARY KEY NOT NULL,
	"better_auth_user_id" text NOT NULL,
	"email" text NOT NULL,
	"has_credential" boolean NOT NULL,
	"has_google" boolean NOT NULL,
	"migrated_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."legacy_documents" (
	"source_collection" text NOT NULL,
	"source_id" text NOT NULL,
	"run_id" text NOT NULL,
	"document" jsonb NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_documents_source_collection_source_id_pk" PRIMARY KEY("source_collection","source_id")
);
--> statement-breakpoint
CREATE TABLE "app"."seen_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"question_type" text NOT NULL,
	"ap_class" text NOT NULL,
	"unit" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops"."better_auth_migration_map" ADD CONSTRAINT "better_auth_migration_map_better_auth_user_id_users_id_fk" FOREIGN KEY ("better_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."legacy_documents" ADD CONSTRAINT "legacy_documents_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."seen_questions" ADD CONSTRAINT "seen_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "better_auth_migration_map_better_auth_user_idx" ON "ops"."better_auth_migration_map" USING btree ("better_auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_conversation_position_uq" ON "app"."conversation_messages" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_created_idx" ON "app"."conversation_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "app"."conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "legacy_documents_run_idx" ON "ops"."legacy_documents" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "seen_questions_user_seen_idx" ON "app"."seen_questions" USING btree ("user_id","seen_at");--> statement-breakpoint
CREATE INDEX "seen_questions_user_hash_idx" ON "app"."seen_questions" USING btree ("user_id","content_hash");