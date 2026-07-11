# Activation funnel analytics (DEV-36)

Consent-respecting PostHog events for the anonymous landing → first answer → signup journey. Implemented in `src/lib/client/activation-analytics.ts` (event capture) and `src/lib/client/activation-funnel-metrics.ts` (pure latency/failure helpers). Wired from landing, question, signup, and app layout surfaces.

## Privacy

- Events fire only when analytics consent is **granted** (`hasAnalyticsConsent()`).
- Never send question text, answer text, emails, names, or other identifying content.
- Allowed properties: AP class name, unit label, coarse timing buckets, correctness boolean, HTTP status codes, failure kind, signup method, and a non-identifying journey key.

## Journey key

When consent is granted, a random UUID is stored in `localStorage` under `ph_activation_journey_key` and attached as `journey_key` on every activation event. This links funnel steps without using account identifiers. Storage is not read or written when consent is denied.

Other consent-gated keys:

| Key                               | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `ph_activation_first_answer_sent` | Ensures `first_answer_submitted` fires once per browser |
| `ph_last_auth_visit_day`          | Local calendar day (`YYYY-MM-DD`) for return detection  |

## Event taxonomy

| Event                            | When                                                                                               | Properties                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `landing_page_viewed`            | Landing page mount                                                                                 | `path`, `journey_key`                                                                                          |
| `practice_selector_used`         | User selects class and unit                                                                        | `ap_class`, `unit`, `journey_key`                                                                              |
| `generate_clicked`               | Generate button click                                                                              | `ap_class`, `unit`, `journey_key`                                                                              |
| `question_request_succeeded`     | Question API returns a payload                                                                     | `ap_class`, `unit`, `source` (`cached` \| `generated`), `latency_ms`, `latency_bucket`, `journey_key`          |
| `question_request_failed`        | Question API or network error                                                                      | `ap_class`, `unit`, `failure_kind`, optional `status`, optional `latency_ms` / `latency_bucket`, `journey_key` |
| `first_answer_submitted`         | First “Check answer” in this browser                                                               | `ap_class`, `unit`, `is_correct`, `time_taken_ms`, `time_taken_bucket`, `journey_key`                          |
| `signup_started`                 | Signup page view or submit/OAuth start                                                             | `method` (`page` \| `email` \| `google`), `journey_key`                                                        |
| `signup_completed`               | Email signup succeeds or Better Auth redirects a newly created Google user to `/app?signup=google` | `method` (`email` \| `google`), `journey_key`                                                                  |
| `authenticated_student_returned` | Authenticated app visit on a later local calendar day                                              | `days_since_previous_visit`, `journey_key`                                                                     |

## Failure kinds (`failure_kind`)

| Value        | Meaning                                       |
| ------------ | --------------------------------------------- |
| `validation` | HTTP 4xx                                      |
| `generation` | HTTP 5xx (server/generation failure)          |
| `network`    | No response status, fetch error, or status 0  |

## Latency buckets (`latency_bucket`, `time_taken_bucket`)

`0-500ms` · `500-1000ms` · `1-2s` · `2-5s` · `5s+`

## Instrumentation map

| File                                          | Events                                                              |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/routes/+page.svelte`                     | `landing_page_viewed`                                               |
| `src/lib/components/question-selector.svelte` | `practice_selector_used`                                            |
| `src/lib/components/question-shell.svelte`    | `generate_clicked`                                                  |
| `src/lib/components/question-card.svelte`     | `question_request_*`, `first_answer_submitted`                      |
| `src/routes/signup/+page.svelte`              | `signup_started` (`page`)                                           |
| `src/lib/components/signup-form.svelte`       | `signup_started`, `signup_completed`                                |
| `src/routes/(app)/+layout.svelte`             | `signup_completed` (OAuth), `authenticated_student_returned`        |

## Related events (outside this funnel)

Existing PostHog events such as `question_answered`, `user_signed_up`, and `$pageview` remain separate. Activation helpers delegate to `capturePostHogEvent` in `src/lib/client/posthog-analytics.ts`. Types and pure helpers live in `activation-funnel-metrics.ts` — import those directly, not via the capture module.
