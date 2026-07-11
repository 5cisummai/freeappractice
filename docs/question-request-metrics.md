# Question request metrics (DEV-37)

Server-side timing and reliability metrics for `POST /api/question`. Used to watch time-to-first-good-question and cache-miss behavior before traffic ramps.

## Event

| Field       | Value                                         |
| ----------- | --------------------------------------------- |
| Event name  | `question_request`                            |
| Distinct ID | `server` (anonymous; never a user id)         |
| Consent     | Not required — operational metric with no PII |

## Properties (allowlisted)

| Property          | Type    | Notes                                                                  |
| ----------------- | ------- | ---------------------------------------------------------------------- |
| `segment`         | string  | `cache_hit` \| `cache_miss_leader` \| `cache_miss_follower` \| `error` |
| `ap_class`        | string  | AP course name (catalog value)                                         |
| `unit`            | string  | Normalized unit label                                                  |
| `validation_ms`   | number  | Request JSON + validation                                              |
| `cache_lookup_ms` | number  | Hot-pool Mongo lookup                                                  |
| `lock_wait_ms`    | number  | Cache-miss lock / follower wait (0 on hit)                             |
| `generation_ms`   | number  | Model structured completion (0 on hit / follower claim)                |
| `persistence_ms`  | number  | S3 + hot-pool insert (0 on hit / follower claim)                       |
| `total_ms`        | number  | End-to-end handler latency                                             |
| `http_status`     | number  | Response status                                                        |
| `ok`              | boolean | `true` on 200                                                          |
| `cached`          | boolean | Whether the served MCQ came from the hot pool                          |
| `error_type`      | string? | `validation` \| `forbidden` \| `generation` \| `busy` \| `unknown`     |

**Never recorded:** question bodies, answers, explanations, `customTopic` text, user IDs, emails, session IDs, or `excludeQuestionIds`.

## Instrumentation points

1. `src/routes/api/question/+server.ts` — validation, total latency, success/error capture
2. `src/lib/questions/pool.server.ts` — cache lookup, hit vs miss, lock wait, leader/follower segment
3. `src/lib/questions/generation.server.ts` — `generation_ms` / S3 `persistence_ms`
4. `src/lib/questions/cache.server.ts` — hot-pool insert folded into `persistence_ms`

Capture helper: `captureQuestionRequestMetric` in `src/lib/server/question-request-metrics.ts` (via `captureAnonymousServerMetric` in `src/lib/server/posthog.ts`).

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

Cache-hit only (time-to-first-good-question on warm pool):

```sql
SELECT
  properties.ap_class AS ap_class,
  properties.unit AS unit,
  quantile(0.50)(toFloat(properties.total_ms)) AS p50_total_ms,
  quantile(0.95)(toFloat(properties.total_ms)) AS p95_total_ms
FROM events
WHERE event = 'question_request'
  AND timestamp > now() - INTERVAL 1 DAY
  AND properties.segment = 'cache_hit'
GROUP BY ap_class, unit
```

Stage breakdown (miss leaders):

```sql
SELECT
  properties.ap_class AS ap_class,
  quantile(0.50)(toFloat(properties.cache_lookup_ms)) AS p50_lookup,
  quantile(0.95)(toFloat(properties.lock_wait_ms)) AS p95_lock_wait,
  quantile(0.50)(toFloat(properties.generation_ms)) AS p50_generation,
  quantile(0.95)(toFloat(properties.generation_ms)) AS p95_generation,
  quantile(0.50)(toFloat(properties.persistence_ms)) AS p50_persistence,
  quantile(0.95)(toFloat(properties.total_ms)) AS p95_total
FROM events
WHERE event = 'question_request'
  AND timestamp > now() - INTERVAL 1 DAY
  AND properties.segment = 'cache_miss_leader'
GROUP BY ap_class
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

## Dashboard (suggested tiles)

1. **p50 / p95 `total_ms`** — trend, broken down by `segment` and filtered by `ap_class` / `unit`
2. **Error rate** — `ok = false` / all `question_request`, by `ap_class` and `error_type`
3. **Cache mix** — share of `cache_hit` vs `cache_miss_leader` vs `cache_miss_follower`
4. **Follower wait** — p95 `lock_wait_ms` where `segment = cache_miss_follower`

## Alert thresholds (documented)

Create PostHog insights alerts (or external monitors on the HogQL above) for **sustained** regressions — e.g. breach for **2 consecutive 15-minute windows** with ≥20 events in the window:

| Signal                           | Threshold       | Why                                        |
| -------------------------------- | --------------- | ------------------------------------------ |
| Cache-hit p95 `total_ms`         | **> 800 ms**    | Warm-pool serve should stay snappy         |
| Cache-miss leader p95 `total_ms` | **> 45_000 ms** | Approaching serverless `maxDuration` (60s) |
| Follower p95 `lock_wait_ms`      | **> 20_000 ms** | Cluster lock / claim path degrading        |
| Error rate (`ok = false`)        | **> 5%**        | Reliability regression                     |
| `error_type = busy` rate         | **> 2%**        | Lock contention / capacity                 |

Tune after a week of baseline data; keep alerts on **rates and percentiles**, not single outliers.
