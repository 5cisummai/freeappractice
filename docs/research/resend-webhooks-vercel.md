# Resend webhooks on SvelteKit and Vercel

Research date: 2026-09-16

## Conclusion

Resend webhooks fit this application. A SvelteKit `+server.ts` endpoint can receive Resend's HTTPS POST requests as a Vercel Node.js Function. The handler should verify the raw request body with Resend's SDK, deduplicate using the `svix-id` header, perform the required database write, and return HTTP 200 only after successful processing.

## Current repository fit

- Resend is already installed at version 6.26.0 in `package.json`.
- Transactional mail is centralized in `src/lib/auth/email.server.ts`.
- The app already uses `@sveltejs/adapter-vercel` and the Neon HTTP driver, both suitable for stateless serverless execution.
- The Resend webhook route is `src/routes/api/webhooks/resend/+server.ts`, and `RESEND_WEBHOOK_SECRET` is documented in `.env.example`.
- The global hook currently performs Better Auth session lookup for most requests and applies the global API rate limiter to most `/api/*` requests. A webhook route under `/api/` must be explicitly exempted from both, because Resend has no user session and webhook traffic should not consume the user-facing rate-limit budget.

## Resend webhook contract

Resend requires a publicly accessible HTTPS endpoint. The endpoint should return HTTP 200 after accepting an event. Non-200 responses are retried with exponential backoff. Resend's documented schedule is immediately, 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, and another 10 hours.

Webhook delivery is at least once, so duplicate deliveries are possible. Delivery order is not guaranteed. The `svix-id` request header is the unique delivery identifier and should be stored with a unique constraint before applying side effects.

The current email event set includes `email.sent`, `email.scheduled`, `email.delivered`, `email.delivery_delayed`, `email.complained`, `email.bounced`, `email.opened`, `email.clicked`, `email.received`, `email.failed`, and `email.suppressed`. Resend also supports contact, domain, and suppression-list events.

For this app's transactional authentication mail, start with:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.failed`
- `email.suppressed`

Do not subscribe to `email.received` unless the product is intentionally adding inbound email. Treat opened and clicked events as optional analytics, since open tracking is not always accurate and those events are not needed for delivery health.

Email event payloads have a top-level `type`, `created_at`, and `data`. The email data includes the Resend `email_id`, `message_id`, sender, recipients, subject, and optional tags. Bounce, failure, suppression, and click events add event-specific data.

## Signature verification

The request body must be read as raw text before parsing. Re-serializing parsed JSON can change whitespace or escaping and invalidate the signature. The Resend SDK already exposes `resend.webhooks.verify`, so this project should not need a separate webhook-signature dependency.

The required headers are:

- `svix-id`
- `svix-timestamp`
- `svix-signature`

The verification shape is:

```ts
const payload = await request.text();
const event = resend.webhooks.verify({
  payload,
  headers: { id, timestamp, signature },
  webhookSecret: RESEND_WEBHOOK_SECRET
});
```

Reject missing or invalid signatures before parsing or processing the event. Never log the raw payload because it contains recipient addresses, subjects, and potentially sensitive email metadata.

## Correlating events to the app

Resend includes email tags in webhook payloads. This implementation generates an opaque browser delivery ID, forwards it to Better Auth in `x-email-delivery-id`, and sends it to Resend as the `delivery_id` tag alongside `email_type`. The returned Resend email ID is also preserved for reconciliation. The recipient email address is never used as the status key.

Do not use the recipient email address as the only identity key. Users can change addresses, and email addresses are sensitive. If an email is safe to retry, Resend also supports a 24-hour idempotency key on the send request to prevent duplicate sends.

## Recommended implementation shape

1. Add `src/routes/api/webhooks/resend/+server.ts`.
2. Read `request.text()`, verify the three Svix headers with `resend.webhooks.verify`, and return 400 for invalid requests.
3. Add application-schema delivery and webhook-event tables with a unique `svix_id`. Generate their Drizzle migration with `bun run db:generate`; do not hand-write migration SQL.
4. Insert each event idempotently. A duplicate `svix_id` returns 200 without repeating side effects.
5. Apply only the business effect needed by this feature: move the email-sent screen from pending to sent or failed.
6. Return 5xx when a verified event cannot be durably stored so Resend retries it. Return 200 after a successful insert or an already-seen duplicate.
7. Update the request policy to skip session lookup and the global API rate limiter for the webhook path.
8. Add `RESEND_WEBHOOK_SECRET` to Vercel Production and local development environments. Keep it server-only through `$env/static/private` or `$env/dynamic/private`.

The handler should remain on the default Vercel Node.js runtime. There is no need to use Edge for this route, especially because the existing Resend SDK is already available in the Node-oriented application.

## Deployment and testing

Register the stable production URL, for example `https://freeappractice.org/api/webhooks/resend`, in Resend after the production deployment is live. Preview deployments should not be the permanent webhook target because their URLs are not stable and may be protected by Vercel deployment access controls.

For local development, Resend documents both a public tunnel and the Resend CLI's temporary webhook listener. Resend also supports dashboard replay, which is useful after fixing a handler. Local and production endpoints must both verify signatures.

Focused tests should cover valid signature verification, missing headers, invalid signatures, malformed JSON after verification, first delivery, duplicate `svix-id`, and database failure. Browser automation is not needed for this backend feature.

## Sources

- [Resend: Managing webhooks](https://resend.com/docs/webhooks/introduction)
- [Resend: Event types](https://resend.com/docs/webhooks/event-types)
- [Resend: Verify webhook requests](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Resend: Retries and replays](https://resend.com/docs/webhooks/retries-and-replays)
- [Resend: Create a webhook](https://resend.com/docs/api-reference/webhooks/create-webhook)
- [Resend: Managing tags](https://resend.com/docs/dashboard/emails/tags)
- [Resend: Send email and idempotency keys](https://resend.com/docs/api-reference/emails/send-email)
- [Resend: Storing webhook data](https://resend.com/docs/dashboard/webhooks/how-to-store-webhooks-data)
- [Vercel: SvelteKit on Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit)
- [Vercel: Reading raw request bodies](https://vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function)
