ALTER TABLE "ops"."better_auth_migration_map" DROP CONSTRAINT "better_auth_migration_map_better_auth_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ops"."better_auth_migration_map" ADD CONSTRAINT "better_auth_migration_map_better_auth_user_id_users_id_fk" FOREIGN KEY ("better_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
