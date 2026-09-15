ALTER TABLE "app"."referrals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "app"."referrals" CASCADE;--> statement-breakpoint
DROP INDEX "app"."user_profiles_referral_code_uq";--> statement-breakpoint
ALTER TABLE "app"."user_profiles" DROP COLUMN "referral_code";