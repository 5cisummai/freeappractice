ALTER TABLE "app"."conversation_messages" ADD COLUMN "parts" jsonb DEFAULT '[]'::jsonb NOT NULL;
