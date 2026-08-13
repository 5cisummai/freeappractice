DELETE FROM "app"."super_grants" AS "dup"
USING "app"."super_grants" AS "keep"
WHERE "dup"."user_id" = "keep"."user_id"
	AND "dup"."id" <> "keep"."id"
	AND "dup"."revoked_at" IS NULL
	AND "keep"."revoked_at" IS NULL
	AND "dup"."expires_at" >= '9999-12-31 23:59:59+00'::timestamptz
	AND "keep"."expires_at" >= '9999-12-31 23:59:59+00'::timestamptz
	AND (
		"dup"."created_at" > "keep"."created_at"
		OR (
			"dup"."created_at" = "keep"."created_at"
			AND "dup"."id" > "keep"."id"
		)
	);
--> statement-breakpoint
CREATE UNIQUE INDEX "super_grants_user_indefinite_unrevoked_uq" ON "app"."super_grants" USING btree ("user_id") WHERE "app"."super_grants"."revoked_at" is null and "app"."super_grants"."expires_at" >= '9999-12-31 23:59:59+00'::timestamptz;
