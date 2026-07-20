# Question pool runbook

Operational guide for the large Mongo serving library backed by the S3 canonical archive. Generation runs only in refill workers — never on user question requests.

Related: [architecture.md](./architecture.md), [question-request-metrics.md](./question-request-metrics.md).

## Architecture reminder

| Layer                                   | Behavior                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/question` / FRQ              | Indexed random Mongo select; `503 POOL_WARMING` when empty; `503 POOL_UNAVAILABLE` on DB errors. No LLM. |
| Cron `GET/POST /api/cron/question-pool` | Claim due refill leases and generate within daily/run budgets (does **not** full-catalog reconcile every tick). |
| S3                                      | Canonical archive + question IDs. Never deleted by pool tools.                                           |
| Mongo                                   | Active serving library (`active`, `randomKey`, inline bodies).                                           |

**Feature-flag note:** Selection-only serving is already the unconditional request path (legacy miss-lock / sync-generate code is removed). There is no dual-path flag to flip off generation on the request path. Use Vercel Flags only for unrelated product pilots (`frq-practice`, `multi-attempt-experiment`). Rollout canary = deploy → seed → watch metrics / admin readiness → expand traffic confidence, not a code flag.

## Prerequisites

- `DATABASE_URI` points at the intended MongoDB (confirm host before any write script).
- AWS credentials + `AWS_S3_BUCKET` for backfill.
- `CRON_SECRET` for production cron / manual cron calls.
- Prefer a non-production URI for first dry-runs.

## 1. Schema / indexes

```bash
# Idempotent: assign randomKey/active, create compound indexes
bun run pool:migrate-schema

# Fail if compound { apClass, unit, active, randomKey } missing or explain is COLLSCAN
bun run pool:verify-indexes
```

Run migrate once per environment before relying on random selection. Re-run verify after deploy or index changes.

## 2. Backfill dry-run and cost estimation

```bash
# Report only — no Mongo writes
bun run pool:backfill-s3 --dry-run
```

Review the report for:

- Valid imports by class/unit
- Invalid / legacy S3 objects skipped
- Duplicates
- Per-bucket deficits after import
- Estimated LLM calls to reach targets (and rough cost using your model pricing)

Then import (still does not rewrite S3):

```bash
bun run pool:backfill-s3
# Optional: also enqueue remaining catalog deficits for the worker
bun run pool:backfill-s3 --enqueue-deficits
```

## 3. Initial seeding (two stages)

1. **S3 → Mongo** via `pool:backfill-s3` (above).
2. **Deficit enqueue** — either `--enqueue-deficits` or admin “enqueue all deficits”, then let cron drain:

```bash
# Manual worker kick (Bearer CRON_SECRET), or wait for Vercel cron
curl -X POST "$ORIGIN/api/cron/question-pool" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Do **not** launch an unbounded sync fill. Prefer the **OpenAI Batch** path for bulk seeding (≈50% cheaper). Cron/sync refill remains for small warming top-ups. Caps are coded in `src/lib/questions/pool-constants.ts`:

- `QUESTION_POOL_MAX_GENERATIONS_PER_RUN` — sync worker only
- `QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET` — shared by sync + batch submit
- `QUESTION_POOL_WORKER_TIME_BUDGET_MS`
- Per-bucket leases (`QUESTION_POOL_LEASE_TTL_MS`)

### Bulk fill via OpenAI Batch (cheaper)

```bash
# Preview JSONL only (no budget burn, no OpenAI submit)
bun run pool:batch-submit -- --dry-run --limit 50

# Submit up to remaining daily budget (default min(500, remaining))
bun run pool:batch-submit -- --limit 500

# Narrow to one bucket
bun run pool:batch-submit -- --class "AP Biology" --unit "Unit 1" --limit 20

# After OpenAI finishes (often hours), persist results to S3 + Mongo
bun run pool:batch-collect -- --batch batch_...
```

Manifests land in `tmp/pool-batches/<batchId>.json` (gitignored). Batch submit **reserves** daily budget slots up front; collect does not re-charge budget.

Priority tip: enqueue high-traffic class/units first from the admin pool tab, then catalog-wide deficits. For large deficits, use `pool:batch-submit` instead of `pool:fill`.


## 4. Empty buckets / POOL_WARMING

Symptoms: practice shows warming UI; metrics `segment=pool_warming`; admin empty-bucket count > 0.

Actions:

1. Confirm refill job exists (`PoolRefillState` pending/failed) for that class/unit.
2. Kick cron or admin enqueue for that bucket.
3. If jobs sit pending with `budget_exhausted`, raise daily budget or wait until next UTC day.
4. If generation fails repeatedly, inspect `lastError` on the refill doc and worker logs.

## 5. Stuck leases

A job in `running` with `leaseExpiresAt` in the past is reclaimable by the next worker (acquisition filter allows expired leases).

If a lease looks stuck before expiry:

1. Wait for TTL (`QUESTION_POOL_LEASE_TTL_MS` in `pool-constants.ts`, default 2 minutes) and re-run cron.
2. Do not manually delete S3 objects.
3. Only clear `leaseOwner` / `leaseExpiresAt` in Mongo if you are sure no worker is still generating for that bucket.

## 6. Daily budget exhaustion

Worker summary `stoppedReason: daily_budget` or refill status `budget_exhausted`.

- Budget key is UTC day (`PoolGenerationBudget.dayKey`).
- Options: wait for next UTC day, temporarily raise `QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET` in `src/lib/questions/pool-constants.ts`, or reduce targets for non-critical buckets while seeding.

## 7. Safe retirement (replaces clear-cache)

Retiring sets `active=false` on Mongo rows. S3 and history IDs remain valid; practice for those buckets returns warming until refill restores inventory.

```bash
bun run pool:retire --dry-run
bun run pool:retire --class "AP Biology" --unit "Unit 1" --dry-run
bun run pool:retire --confirm=RETIRE-POOL
```

Never use a “delete everything” shortcut in production without the dry-run impact report.

## 8. Index verification

```bash
bun run pool:verify-indexes
```

If this fails in production, do not ignore it — selection may degrade to collection scans and hit-latency alerts will fire. Fix indexes via `pool:migrate-schema` / Atlas, then re-verify.

## 9. Observability checks

- PostHog `question_request`: mix of `pool_hit` / `pool_warming` / `pool_error`; p95 `pool_query_ms` and `total_ms` on hits.
- PostHog `question_pool_health`: `empty_observed_buckets`, `oldest_job_age_ms`, `budget_remaining`, `failed_jobs`.
- Admin pool tab: readiness %, deficits, last errors.
- Confirm Vercel functions and Atlas share the same region (see metrics doc).

Alert thresholds: [question-request-metrics.md](./question-request-metrics.md).

## 10. Rollout / canary (ops, not a dual-path flag)

Selection-only is already shipped in code. Operational canary:

1. Deploy schema migration + indexes; verify with `pool:verify-indexes`.
2. Dry-run then run S3 backfill; seed priority buckets to a safe minimum.
3. Enable cron; confirm `question_pool_health` shows progress and no sustained `failed_jobs`.
4. Smoke internal traffic: hit, warming UI + retry, class/unit switch, exclusion reset, FRQ (if flag on).
5. Watch p95 hit latency and `pool_warming` rate; expand confidence as readiness stays healthy.
6. Confirm no request-path LLM calls (request modules must not import `generation.server` / `pool-write.server` — covered by unit boundary tests).

**Rollback:** There is no feature flag that restores sync generation. Rollback options are:

- Redeploy the previous release that still had miss-lock generation (emergency only), or
- Keep selection-only and restore inventory via backfill/refill while the warming UI covers empty buckets.

Prefer fixing inventory over restoring sync generation.

## 11. Manual browser verification checklist

With `bun dev` (or a preview deploy):

1. Open practice; load an MCQ for a seeded class/unit → expect quick hit (`cached: true`).
2. For an empty bucket (or after `pool:retire` dry-run on a local DB), expect warming message + retry (bounded auto-retry).
3. Switch class/unit; confirm session exclusions do not break practice when the pool wraps.
4. If FRQ flag is on, repeat hit/warming for FRQ.
5. Confirm Network tab: `/api/question` never stays open for tens of seconds waiting on generation.

## Useful package scripts

| Script                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `bun run pool:migrate-schema` | Indexes + `randomKey`/`active` backfill                         |
| `bun run pool:verify-indexes` | Explain / index presence check                                  |
| `bun run pool:backfill-s3`    | S3 → Mongo import (`--dry-run`, `--enqueue-deficits`)           |
| `bun run pool:retire`         | Retire active Mongo rows (`--dry-run`, `--confirm=RETIRE-POOL`) |
