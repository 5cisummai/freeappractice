# Neon schema migrations

The application database is Neon Postgres reached through `@neondatabase/serverless` and Drizzle's `neon-http` adapter. Vercel's Neon integration provides `DATABASE_URL`, which is the normal Neon `postgresql://...` connection string; the selected driver sends it over HTTPS. `NEON_DATABASE_URL` remains a temporary local fallback during the migration. Runtime code must not import `pg`, `postgres`, or the WebSocket driver.

`src/lib/server/neon/schema.ts` is the source of truth. Review generated SQL before applying it to a Neon branch. Production changes must use committed migration files; do not use `drizzle-kit push` against the production branch.

The Mongo-to-Neon loader is intentionally separate from schema migration:

1. Apply the reviewed Drizzle schema migration to an isolated Neon branch.
2. Run the inventory phase and resolve every unexpected Mongo collection.
3. Run the load phase with a unique `--run-id`; it is resumable and idempotent.
4. Run verification against the same run ID and compare source counts, target counts, checksums, foreign keys, and derived generation views.

The loader keeps immutable source rollup snapshots under `ops.generation_rollup_snapshots`; serving metrics come from the relational views instead of mutable counter documents.
