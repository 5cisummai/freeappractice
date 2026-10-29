# Database migrations

`drizzle/0000_baseline.sql` and `drizzle/meta/0000_snapshot.json` are generated from the Drizzle schema. They consolidate the migration history through release 1.9.4 (commit `f84356bd3495039fada00c9117c0308360000c6e`). Drizzle Kit 0.31 does not provide a squash command; this baseline was generated with `bun run db:generate --name baseline` in an empty migration directory.

Continue changing schema definitions and running `bun run db:generate`, reviewing the generated SQL, then applying with `bun run db:apply`. Do not edit generated snapshots or the journal by hand. The application uses the HTTPS migration runner and `public._neon_schema_migrations`, not the separate ledger used by `drizzle-kit migrate`.

## Existing databases

The runner verifies every pre-baseline migration against `scripts/neon-baseline-history.json` before recording the baseline. It does not execute the baseline DDL on an already migrated database. Original ledger rows and existing data remain intact, including historical operations tables that are no longer managed by the application schema. The previously supported FRQ migration ID alias remains accepted.

If any historical migration is missing or its checksum differs, adoption fails. Use the release 1.9.4 checkout and its original `bun run db:apply` to finish the old history first, investigating any checksum mismatch rather than changing the ledger to bypass it. Old migrations and their snapshots remain available in Git at the commit above.

## Rewritten applied SQL

The runner refuses to continue when an already-applied file's checksum does not match git, so later migrations never run. `0002_super_usage_credits_milli.sql` is the exception: production applied the ALTER + millicredit reset from commit `476de76a`, then git restored the file to DDL-only and moved the reset to `0005`. The runner accepts that historical checksum, updates the recorded digest, and continues.

`0005_reset_super_usage_credits_milli.sql` is a no-op (`SELECT 1`). The reset already ran on production as part of the old `0002` file; re-running `UPDATE ... SET credits_milli = 0` would wipe credits accumulated since then. Fresh databases default `credits_milli` to 0.

Pushes to `main` / `staging` apply pending SQL, then run idempotent data backfills (AP Art History works today). Add further backfills in `.github/workflows/ci.yml` below `db:apply`.

## Empty databases

The runner executes the generated baseline and records its checksum in the same transaction. A second run skips it. An existing schema without a migration ledger is not automatically adopted; the baseline transaction fails on existing objects rather than dropping or replacing them.

## Validation of the consolidation

The generated baseline was applied to an empty local PostgreSQL database and compared with a separate database created by all 31 historical SQL migrations. All 50 managed tables and three views matched in columns, defaults, constraints, indexes, and view definitions. The schema definitions now also include the historical organization-type constraint and partial share-token index.
