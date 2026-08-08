# Neon schema migrations

The application database is Neon Postgres reached through `@neondatabase/serverless` and Drizzle's `neon-http` adapter. Vercel's Neon integration provides `DATABASE_URL`, which is the normal Neon `postgresql://...` connection string; the selected driver sends it over HTTPS. Runtime code must not import `pg`, `postgres`, or the WebSocket driver.

`src/lib/server/neon/schema.ts` is the source of truth. Review generated SQL before applying it to a Neon branch. Production changes must use committed migration files; do not use `drizzle-kit push` against the production branch.

Generate and apply:

1. `bun run db:generate` — write SQL under `drizzle/` from schema changes.
2. Review the generated migration.
3. `bun run db:apply` — apply committed SQL to `DATABASE_URL` (locally, or automatically on push to `main` / `staging` via CI).
