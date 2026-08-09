# MongoDB to Neon migration

Runtime uses Neon Postgres only through `$lib/server/neon/db.ts` and
`$lib/server/neon/model.ts`. MongoDB remains a migration source only; runtime
code never reads `DATABASE_URI`.

The resumable loader in `scripts/migrate-mongo-to-neon.ts` reads MongoDB
without modifying it and writes idempotent upserts to Neon. It records source
document checksums in `ops.migration_ledger`, fails on malformed required
values, and fails if it finds a collection that is not explicitly mapped.

Create and validate a local backup before loading. The restore command uses
`--dryRun`, so it parses the archive without importing anything:

```sh
export MIGRATION_BACKUP_ARCHIVE=/absolute/path/to/mongodb.archive.gz
mkdir -p "$(dirname "$MIGRATION_BACKUP_ARCHIVE")"
bunx dotenv-cli -e .env -- sh -c 'mongodump --uri "$DATABASE_URI" --archive="$MIGRATION_BACKUP_ARCHIVE" --gzip'
gzip -t "$MIGRATION_BACKUP_ARCHIVE"
bunx dotenv-cli -e .env -- sh -c 'mongorestore --uri "$DATABASE_URI" --archive="$MIGRATION_BACKUP_ARCHIVE" --gzip --dryRun'
shasum -a 256 "$MIGRATION_BACKUP_ARCHIVE"
```

Use a unique run ID and run all three phases against the same source and
destination:

1. `bun run db:migrate:inventory`
2. `bun run db:migrate:load -- --run-id=<run-id>`
3. `bun run db:migrate:verify -- --run-id=<run-id>`

The verify phase checks every source document against its ledger checksum,
fails on missing or extra ledger rows, fails if rejects exist, and checks
relational integrity. Replay the load once with the same run ID and verify
again to prove idempotency. Keep MongoDB intact after cutover so it remains
available for reconciliation and rollback.

Schema generate/apply instructions live in [`drizzle/README.md`](../drizzle/README.md).
