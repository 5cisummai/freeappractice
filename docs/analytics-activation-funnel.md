# Activation funnel analytics (DEV-36)

Consent-respecting PostHog events for the anonymous landing → first answer → signup journey. Implemented in `src/lib/client/activation-analytics.ts` (event capture + latency/failure helpers) with shared failure kinds in `src/lib/question-failure.ts`. Wired from landing, question, signup, and app layout surfaces.

## Privacy

- Detailed product events fire only when analytics consent is **granted**.
- Events generated while the consent banner is undecided are held in a bounded in-memory queue. Accepting flushes them in order; rejecting discards them.
- Rejected visitors send only cookieless `$pageview` events. These contain no persistent PostHog identifier and do not enable detailed events or replay.
- `account_created` and `account_email_verified` are aggregate server metrics with `$process_person_profile: false`. They contain no user ID, email, name, or request body and do not depend on analytics consent.
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

| Event                            | When                                                                                                                                  | Properties                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `landing_page_viewed`            | Landing page mount                                                                                                                    | `path`, `journey_key`                                                                                          |
| `practice_selector_used`         | User selects class and unit                                                                                                           | `ap_class`, `unit`, `journey_key`                                                                              |
| `generate_clicked`               | Generate button click                                                                                                                 | `ap_class`, `unit`, `journey_key`                                                                              |
| `question_request_succeeded`     | Question API returns a payload                                                                                                        | `ap_class`, `unit`, `source` (`cached` \| `generated`), `latency_ms`, `latency_bucket`, `journey_key`          |
| `question_request_failed`        | Question API or network error                                                                                                         | `ap_class`, `unit`, `failure_kind`, optional `status`, optional `latency_ms` / `latency_bucket`, `journey_key` |
| `first_answer_submitted`         | First “Check answer” in this browser                                                                                                  | `ap_class`, `unit`, `is_correct`, `time_taken_ms`, `time_taken_bucket`, `journey_key`                          |
| `signup_started`                 | Signup page view or submit/OAuth start                                                                                                | `method` (`page` \| `email` \| `google`), `journey_key`                                                        |
| `signup_completed`               | Consent-enabled activation funnel: email signup succeeds or Better Auth redirects a newly created Google user to `/app?signup=google` | `method` (`email` \| `google`), `journey_key`                                                                  |
| `authenticated_student_returned` | Authenticated app visit on a later local calendar day                                                                                 | `days_since_previous_visit`, `journey_key`                                                                     |

## Authoritative account metrics

Use these events for account totals. Do not use `signup_completed` as the signup KPI because it is a consent-enabled funnel event and intentionally undercounts declined analytics.

| Event                    | When                                     | Properties                                                                                              |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `account_created`        | Better Auth creates a user record        | `method` (`email` \| `google` \| `google_one_tap` \| `unknown`), `email_verified_at_creation`, `source` |
| `account_email_verified` | Better Auth completes email verification | `source`                                                                                                |

Both events are emitted server-side with the shared anonymous distinct ID `server` and person-profile processing disabled. Google One Tap creation is counted here even though its browser response does not distinguish a new account from a returning sign-in.

## Practice quality and support events

All of these events are consent-gated and never include question text, answer text, tutor messages, or free-form feedback.

| Event                           | When                                            | Properties                                                                          |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `question_answered`             | Student checks an answer                        | `ap_class`, `unit`, `question_id`, `topic`, `source`, `is_correct`, `time_taken_ms` |
| `question_skipped`              | Student skips before answering                  | `ap_class`, `unit`, `question_id`, `topic`, `source`                                |
| `question_marked_not_learned`   | Student marks a question as not yet learned     | `ap_class`, `unit`, `question_id`, `topic`, `source`                                |
| `explanation_viewed`            | Student opens an explanation after answering    | `ap_class`, `unit`, `question_id`, `topic`, `source`, `is_correct`                  |
| `question_feedback_submitted`   | Student flags an answer, prompt, or explanation | `reason`, `ap_class`, `unit`, `question_id`, `topic`, `source`, `is_correct`        |
| `tutor_response_completed`      | A tutor stream completes                        | `ap_class`, `unit`, `question_id`, `topic`, `response_time_ms`, `conversation_turn` |
| `tutor_response_failed`         | A tutor stream fails or times out               | `ap_class`, `unit`, `question_id`, `topic`, `failure_kind`, `response_time_ms`      |
| `practice_progress_save_failed` | Authenticated progress persistence fails        | `endpoint`                                                                          |

`topic` is the generated question's stored concept label (`topicsCovered`). It is useful for exploratory analysis, but it is free text; use AP class and unit for dependable grouped reporting until a controlled topic taxonomy exists.

## Failure kinds (`failure_kind`)

| Value        | Meaning                                      |
| ------------ | -------------------------------------------- |
| `validation` | HTTP 4xx                                     |
| `generation` | HTTP 5xx (server/generation failure)         |
| `network`    | No response status, fetch error, or status 0 |

## Latency buckets (`latency_bucket`, `time_taken_bucket`)

`0-500ms` · `500-1000ms` · `1-2s` · `2-5s` · `5s+`

## Instrumentation map

| File                                                    | Events                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/routes/+page.svelte`                               | `landing_page_viewed`                                               |
| `src/lib/components/questions/question-selector.svelte` | `practice_selector_used`                                            |
| `src/lib/components/questions/question-shell.svelte`    | `generate_clicked`                                                  |
| `src/lib/components/questions/question-card.svelte`     | `question_request_*`, `first_answer_submitted`                      |
| `src/routes/signup/+page.svelte`                        | `signup_started` (`page`)                                           |
| `src/lib/components/auth/signup-form.svelte`            | `signup_started`, `signup_completed`                                |
| `src/routes/app/+layout.svelte`                         | `signup_completed` (Google OAuth), `authenticated_student_returned` |
| `src/lib/auth/server.ts`                                | `account_created`, `account_email_verified`                         |
| `src/routes/+layout.svelte`                             | `$pageview` on initial load and SPA navigation                      |

## Related events (outside this funnel)

Existing detailed PostHog events such as `question_answered` remain separate. `$pageview` is captured on initial load and every SvelteKit navigation, including cookieless visits after rejection. Activation helpers (including latency/failure helpers) live in `src/lib/client/activation-analytics.ts` and delegate to `capturePostHogEvent` in `src/lib/client/posthog-analytics.ts`. Shared failure kinds: `src/lib/question-failure.ts`.

## Referral funnel (growth)

| Event                | When                                       | Properties / notes                                            |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `invite_landed`      | `/invite/{code}` hit                       | Anonymous metric: `code_valid`                                |
| `referral_claimed`   | Cookie attributed to a new account         | Consent-gated; `activated_on_claim`                           |
| `referral_activated` | First recorded attempt (or claim backfill) | Consent-gated; `source` (`first_attempt` \| `claim_backfill`) |

Invite links land on `/subjects?invited=1` (not bare `/practice`, which has no index route). Claim runs on every authenticated `(app)` layout load so practice-before-dashboard still attributes.
