# MongoDB to Neon migration (historical)

Cutover is complete. Runtime uses Neon Postgres only through
`$lib/server/neon/db.ts` and `$lib/server/neon/model.ts`. The one-shot Mongo
loader, `mongodb` dependency, and `SOURCE_DATABASE_URI` have been removed.

Schema generate/apply instructions live in [`drizzle/README.md`](../drizzle/README.md).
