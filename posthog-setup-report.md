# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into FreeAPPractice. Here's what was set up:

- **Client-side SDK** (`posthog-js`) initialized in `src/hooks.client.ts` with error tracking (`captureException`) and consent-gated opt-in/opt-out via the existing `privacy.svelte.ts` consent system.
- **Server-side SDK** (`posthog-node`) singleton in `src/lib/server/posthog.ts` used across API routes for server-side event capture with real user IDs.
- **Reverse proxy** at `/ingest/*` added to `src/hooks.server.ts` to route PostHog traffic through the app's own domain (avoids ad blockers; handles both `/static/` and `/array/` asset paths).
- **Session replay** enabled by setting `paths.relative: false` in `svelte.config.js`.
- **User identification** at login/signup (client-side with email) and persistently on every app layout mount via the authenticated `data.user` object.
- **CSP** updated to allow `https://us.posthog.com` in `connect-src`.
- **Consent integration**: PostHog initializes with `opt_out_capturing_by_default` based on stored consent, and `opt_in_capturing()` / `opt_out_capturing()` are called when the user changes their preference in Settings.

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created a new account (email or Google OAuth). | `src/lib/components/signup-form.svelte` |
| `user_logged_in` | User successfully signed in to an existing account. | `src/lib/components/login-form.svelte` |
| `question_answered` | User checked their answer on a practice question, capturing correctness and time taken. | `src/lib/components/question-card.svelte` |
| `question_skipped` | User skipped the current practice question without answering. | `src/lib/components/question-card.svelte` |
| `question_marked_not_learned` | User marked a question as not yet learned, indicating a gap in knowledge. | `src/lib/components/question-card.svelte` |
| `question_attempt_recorded` | Server-side event confirming a question attempt was persisted to the database. | `src/routes/api/me/record-attempt/+server.ts` |
| `question_bookmark_toggled` | User bookmarked or removed a bookmark from a practice question. | `src/routes/api/me/bookmark/+server.ts` |
| `tutor_chat_started` | User sent a message to the AI tutor for help with a question. | `src/routes/api/tutor/chat/+server.ts` |
| `analytics_consent_changed` | User explicitly granted or denied optional analytics consent. | `src/lib/client/privacy.svelte.ts` |
| `practice_page_viewed` | User landed on a practice page (top of the question-practice conversion funnel). | `src/routes/(practice)/practice/[...slug]/+page.svelte` |
| `server_error` | Unhandled server-side error captured with context. | `src/hooks.server.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) dashboard](https://us.posthog.com/project/486732/dashboard/1763327)
- [New signups](https://us.posthog.com/project/486732/insights/LpVC4H9Q)
- [Daily active practitioners](https://us.posthog.com/project/486732/insights/F6ei5H34)
- [Answer accuracy rate](https://us.posthog.com/project/486732/insights/HQJJM7pg)
- [Signup to first question funnel](https://us.posthog.com/project/486732/insights/uqmVrXQa)
- [AI tutor usage](https://us.posthog.com/project/486732/insights/8W262k1P)

## Verify before merging

- [ ] Run a full production build (`pnpm build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `(app)/+layout.svelte` `onMount` handles this for authenticated sessions, but verify it fires correctly after a hard refresh.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-sveltekit/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
