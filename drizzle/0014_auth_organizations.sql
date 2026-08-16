CREATE TABLE "auth"."organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"org_type" text NOT NULL,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_org_type_check" CHECK ("auth"."organizations"."org_type" IN ('personal', 'group', 'school', 'enterprise'))
);
--> statement-breakpoint
CREATE TABLE "auth"."members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_organizations_slug_uq" ON "auth"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_organizations_share_token_uq" ON "auth"."organizations" USING btree ("share_token") WHERE "share_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_organizations_org_type_idx" ON "auth"."organizations" USING btree ("org_type");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_members_org_user_uq" ON "auth"."members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "auth_members_user_id_idx" ON "auth"."members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_invitations_org_id_idx" ON "auth"."invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auth_invitations_email_idx" ON "auth"."invitations" USING btree ("email");
