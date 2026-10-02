CREATE TABLE "app"."coach_images" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"message_id" text,
	"store" text NOT NULL,
	"pathname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "coach_images_store_check" CHECK ("app"."coach_images"."store" IN ('blob', 's3'))
);
--> statement-breakpoint
ALTER TABLE "app"."coach_images" ADD CONSTRAINT "coach_images_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_images" ADD CONSTRAINT "coach_images_message_id_conversation_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."conversation_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_images_owner_conversation_idx" ON "app"."coach_images" USING btree ("user_id","conversation_id");--> statement-breakpoint
CREATE INDEX "coach_images_cleanup_idx" ON "app"."coach_images" USING btree ("next_attempt_at");