# Question request metrics (DEV-37)

Server-side timing and reliability metrics for selection-only question serves (`POST /api/question`, FRQ path). Used to watch pool-hit latency, warming rate, and refill health before and after traffic ramps.

## Events

| Field       | Value                                         |
| ----------- | --------------------------------------------- |
| Event name  | `question_request`                            |
| Distinct ID | `server` (anonymous; never a user id)         |
| Consent     | Not required — operational metric with no PII |

| Field       | Value                                           |
| ----------- | ----------------------------------------------- |
| Event name  | `question_pool_health`                          |
| Distinct ID | `server`                                        |
| Consent     | Not required — emitted after refill worker runs |

## Properties — `question_request` (allowlisted)

| Property          | Type    | Notes                                                                                                                                                    |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `question_type`   | string  | `mcq` \| `frq`                                                                                                                                           |
| `segment`         | string  | `pool_hit` \| `pool_warming` \| `pool_error` \| `error`                                                                                                  |
| `ap_class`        | string  | AP course name (catalog value)                                                                                                                           |
| `unit`            | string  | Normalized unit label                                                                                                                                    |
| `validation_ms`   | number  | Request JSON + validation                                                                                                                                |
| `db_connect_ms`   | number  | Mongoose `connectDb()` (≈0 on warm isolates with `globalThis` cache)                                                                                     |
| `pool_query_ms`   | number  | Indexed random Mongo selection only                                                                                                                      |
| `cache_lookup_ms` | number  | Transitional alias: `db_connect_ms + pool_query_ms`                                                                                                      |
| `lock_wait_ms`    | number  | Legacy field; always `0` on the selection-only path                                                                                                      |
| `generation_ms`   | number  | Legacy field; always `0` on the request path (generation is worker-only)                                                                                 |
| `persistence_ms`  | number  | Legacy field; always `0` on the request path                                                                                                             |
| `total_ms`        | number  | End-to-end handler latency                                                                                                                               |
| `http_status`     | number  | Response status                                                                                                                                          |
| `ok`              | boolean | `true` when `http_status < 400`                                                                                                                          |
| `cached`          | boolean | Whether the served question came from the Mongo pool                                                                                                     |
| `error_type`      | string? | `validation` \| `generation` \| `busy` \| `unknown` (legacy `generation` label may still appear for classified failures; request path does not generate) |

**Segments**

| Segment        | Meaning                                         |
| -------------- | ----------------------------------------------- |
| `pool_hit`     | Active row found; body returned from Mongo      |
| `pool_warming` | Empty / unavailable bucket → `503 POOL_WARMING` |
| `pool_error`   | DB connect or selection failure → `503`         |
| `error`        | Validation or unexpected handler failure        |

**Never recorded:** question bodies, answers, explanations, `customTopic` text, user IDs, emails, session IDs, or `excludeQuestionIds`.

## Properties — `question_pool_health` (allowlisted)

Emitted once per refill worker invocation (cron or admin enqueue processor).

| Property                 | Type   | Notes                                                                          |
| ------------------------ | ------ | ------------------------------------------------------------------------------ |
| `processed`              | number | Leased jobs processed                                                          |
| `generated`              | number | LLM generations completed                                                      |
| `skipped_duplicates`     | number | Duplicate content/ID skips                                                     |
| `failed`                 | number | Jobs that failed in this run                                                   |
| `budget_remaining`       | number | Remaining daily LLM generation budget                                          |
| `stopped_reason`         | string | `complete` \| `time_budget` \| `generation_cap` \| `daily_budget` \| `no_work` |
| `empty_observed_buckets` | number | Refill rows with `observedCount = 0`                                           |
| `failed_jobs`            | number | Jobs currently in `failed` status                                              |
| `budget_exhausted_jobs`  | number | Jobs in `budget_exhausted` status                                              |
| `pending_jobs`           | number | Jobs in `pending` status                                                       |
| `oldest_job_age_ms`      | number | Age of oldest non-idle refill job                                              |

Full-catalog reconcile (`bun run pool:reconcile`) is a separate ops command and does not emit this event.
## Instrumentation points

1. `src/routes/api/question/+server.ts` — validation, total latency, success/warming/error capture
2. `src/routes/api/question/frq/+server.ts` — same segments for authenticated FRQ
3. `src/lib/questions/pool.server.ts` — splits `dbConnectMs` vs `poolQueryMs`, sets segment
4. `src/lib/questions/pool-refill.server.ts` — captures `question_pool_health` after each worker run
5. Admin dashboard (`src/lib/admin/dashboard.server.ts`) — `cacheOverview.emptyBuckets` / bucket health for ops UI

Capture helpers: `capturePathQuestionRequestMetric` / `captureQuestionPoolHealthMetric` in `src/lib/server/question-request-metrics.ts` (wraps `captureAnonymousServerMetric` in `src/lib/server/posthog.ts`).

## Region requirement (Vercel + MongoDB)

Vercel serverless functions and MongoDB Atlas **must** run in the same cloud region (for example both `iad1` / US East). Cross-region RTT dominates `db_connect_ms` and `pool_query_ms` and cannot be fixed in application code.

**Operational check (not automated in CI):**

1. Confirm the Vercel project region (Project → Settings → Functions / Deployment region).
2. Confirm the Atlas cluster region matches.
3. After deploy, inspect p95 `db_connect_ms` and `pool_query_ms` on `pool_hit` — a healthy same-region setup should keep warm-isolate `db_connect_ms` near 0 and `pool_query_ms` well under the hit-latency alert below.
4. Run `bun run pool:verify-indexes` against production URI so selection uses IXSCAN, not COLLSCAN.

Index verification script: `scripts/verify-question-pool-indexes.ts` (`bun run pool:verify-indexes`). Fails if the compound `{ apClass, unit, active, randomKey }` index is missing or explain shows a collection scan.

## PostHog: p50 / p95 total time by AP class and unit

In PostHog → **SQL** (HogQL), last 24 hours:

```sql
SELECT
  properties.ap_class AS ap_class,
  properties.unit AS unit,
  properties.segment AS segment,
  count() AS requests,
  quantile(0.50)(toFloat(properties.total_ms)) AS p50_total_ms,
  quantile(0.95)(toFloat(properties.total_ms)) AS p95_total_ms,
  avg(toFloat(properties.total_ms)) AS avg_total_ms
FROM events
WHERE event = 'question_request'
  AND timestamp > now() - INTERVAL 1 DAY
  AND properties.ok = true
GROUP BY ap_class, unit, segment
ORDER BY requests DESC
```

Pool-hit only (time-to-first-good-question on warm pool), with connect/query split:

```sql
SELECT
  properties.ap_class AS ap_class,
  properties.unit AS unit,
  quantile(0.50)(toFloat(properties.total_ms)) AS p50_total_ms,
  quantile(0.95)(toFloat(properties.total_ms)) AS p95_total_ms,
  quantile(0.95)(toFloat(properties.db_connect_ms)) AS p95_db_connect_ms,
  quantile(0.95)(toFloat(properties.pool_query_ms)) AS p95_pool_query_ms
FROM events
WHERE event = 'question_request'
  AND timestamp > now() - INTERVAL 1 DAY
  AND properties.segment = 'pool_hit'
GROUP BY ap_class, unit
```

Warming / error mix:

```sql
SELECT
  properties.segment AS segment,
  count() AS requests
FROM events
WHERE event = 'question_request'
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY segment
ORDER BY requests DESC
```

## Error rate by AP class and unit

```sql
SELECT
  properties.ap_class AS ap_class,
  properties.unit AS unit,
  countIf(properties.ok = false) AS errors,
  count() AS total,
  if(total = 0, 0, errors / total) AS error_rate
FROM events
WHERE event = 'question_request'
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY ap_class, unit
ORDER BY error_rate DESC, total DESC
```

## Refill health (HogQL)

```sql
SELECT
  properties.stopped_reason AS stopped_reason,
  avg(toFloat(properties.empty_observed_buckets)) AS avg_empty_buckets,
  avg(toFloat(properties.failed_jobs)) AS avg_failed_jobs,
  avg(toFloat(properties.budget_exhausted_jobs)) AS avg_budget_exhausted,
  avg(toFloat(properties.oldest_job_age_ms)) AS avg_oldest_job_age_ms,
  min(toFloat(properties.budget_remaining)) AS min_budget_remaining,
  count() AS runs
FROM events
WHERE event = 'question_pool_health'
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY stopped_reason
```

## Dashboard (suggested tiles)

1. **p50 / p95 `total_ms`** — trend by `segment`, filtered by `ap_class` / `unit`
2. **p95 `pool_query_ms`** and **p95 `db_connect_ms`** on `pool_hit` — isolate Mongo latency vs cold connect
3. **Error rate** — `ok = false` / all `question_request`, by `ap_class` and `error_type`
4. **Pool mix** — share of `pool_hit` vs `pool_warming` vs `pool_error`
5. **Refill health** — `empty_observed_buckets`, `oldest_job_age_ms`, `budget_remaining`, `failed_jobs` from `question_pool_health`
6. **Admin** — `cacheOverview.emptyBuckets` / under-target buckets on the ops dashboard

## Alert thresholds (documented)

Create PostHog insight alerts (or external monitors on the HogQL above) for **sustained** regressions — e.g. breach for **2 consecutive 15-minute windows** with enough events to be meaningful:

| Signal                                                                             | Threshold                                               | Why                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Empty published buckets (`empty_observed_buckets` or admin empty count)            | **> 0** for any published class/unit after initial seed | Practice returns `POOL_WARMING`                                             |
| Refill job age (`oldest_job_age_ms`)                                               | **> 30 min** while `pending_jobs` or `failed_jobs` > 0  | Stuck lease / worker not draining                                           |
| Refill error count (`failed_jobs` or per-run `failed`)                             | **> 0** sustained across 2 cron windows                 | Generation / persistence failures                                           |
| Budget exhaustion (`stopped_reason = daily_budget` or `budget_exhausted_jobs` > 0) | Any occurrence during business hours                    | Deficit cannot be repaired until next UTC day or budget raise               |
| p95 `pool_query_ms` on `pool_hit`                                                  | **> 200 ms**                                            | Index miss, region mismatch, or Atlas pressure                              |
| p95 `total_ms` on `pool_hit`                                                       | **> 800 ms**                                            | End-to-end hit path regression (auth bypass + warm pool should stay snappy) |
| `pool_warming` rate                                                                | **> 2%** of MCQ requests after seed                     | Empty or exhausted buckets in traffic                                       |
| `pool_error` / error rate (`ok = false`)                                           | **> 5%**                                                | Reliability regression                                                      |

Tune after a week of baseline data; keep alerts on **rates and percentiles**, not single outliers. Also confirm same-region deployment whenever connect/query latency alerts fire together.

## Ops runbook

For backfill, seeding, stuck leases, budget exhaustion, index verification, and rollout/canary steps, see [question-pool-runbook.md](./question-pool-runbook.md).
