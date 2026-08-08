# MongoDB to Neon migration implementation

## Target

The application target is a single Neon Postgres database accessed through:

```text
Vercel/SvelteKit -> drizzle-orm/neon-http -> @neondatabase/serverless neon() -> HTTPS -> Neon
```

The connection string is the normal Neon `postgresql://...` URL, but the driver sends queries over HTTPS. There is no `pg` pool, `postgres` client, or Neon WebSocket session in the new seam. The runtime therefore follows two rules:

- one statement must contain each invariant that must be atomic;
- independent writes may be submitted through Drizzle's HTTP batch API.

The physical database is divided into `auth`, `app`, `content`, and `ops` schemas. Better Auth keeps its current logical model names (`authUsers`, `authAccounts`, `authSessions`, `authVerifications`, and `authSubscriptions`) while the physical tables use stable snake_case names.

## Data model decisions

- `user_profiles` contains only profile scalar values and the referral code.
- The old profile arrays become `user_subjects`, `user_progress`, `mcq_attempts`, `bookmarks`, and `experiment_assignments`.
- FRQ attempts, grades, and rubric criterion grades are separate rows with foreign keys.
- FRQ materials, sections, rubric criteria, and rubric levels are separate content rows.
- Question IDs are the durable content identity. MCQ and FRQ serving rows reference the registry rather than duplicating S3 identity.
- Quality current state, feedback facts, audit events, review jobs, candidates, items, and batches are separate tables.
- JSONB is retained only for versioned AI/report/snapshot payloads whose internal shape is not a query dimension.
- Mongo TTL behavior becomes explicit `completed_at`/expiry columns plus maintenance queries.
- The old generation counter collections are preserved as migration audit snapshots; serving metrics are derived from relational views over the question registry.
- `super_cleanup_jobs` remains in `ops` without an auth foreign key because account deletion must leave Mem0 cleanup work durable.

## Migration protocol

The loader in `scripts/migrate-mongo-to-neon.ts` is read-only against the legacy Mongo source and idempotent against Neon. It records a checksum ledger for every source document, rejects malformed rows explicitly, and fails when it discovers a collection that is not in the allow-list.

The production `build` script runs `db:apply` first, so Vercel applies committed Drizzle SQL to the `DATABASE_URL` target before bundling. The build environment must therefore point at the intended Neon branch.

Use a unique run ID for each load. The intended sequence is:

1. Apply a reviewed Drizzle migration to an isolated Neon branch.
2. Inventory every legacy Mongo collection and resolve any unmapped collection before loading.
3. Load Better Auth rows first, then profiles, registry/content, attempts, quality, and operational state.
4. Verify source counts, target ledger counts, rejected documents, foreign-key integrity, and derived generation views.
5. Repeat the load with the same run ID to prove idempotency, then run a delta load after the write freeze.

The loader is deliberately not invoked by the application and has not been executed as part of this code change.

## Cutover seam

The database seam is `$lib/server/neon/db.ts`, backed by `drizzle-orm/neon-http`, and the compatibility repository is `$lib/server/neon/model.ts`. Better Auth, profile writes, pool workers, content, quality review, FRQ grading, and account deletion now use the normalized Neon tables.

The remaining production step is data cutover: use a short write-maintenance window, run the final delta from an explicitly configured `SOURCE_DATABASE_URI`, verify counts and foreign keys, smoke-test authentication and critical user flows, then reopen writes. Keep the legacy Mongo source read-only for the agreed retention period before removing its credentials and the `mongodb` migration-only dependency.
