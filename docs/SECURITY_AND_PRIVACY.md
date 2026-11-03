# Security and privacy

Internal engineering reference reviewed against the working tree on 2026-11-03. This describes code behavior, not verified production provider settings or a compliance certification. See [architecture](architecture.md) for the application structure.

## Identity and access

[Better Auth configuration](../src/lib/auth/server.ts) uses Neon/Drizzle for accounts and sessions. Email/password sign-in requires email verification. Passwords use bcrypt with cost 12 and application length checks. Reset and verification tokens expire after 15 minutes, password reset revokes sessions, and OAuth tokens are configured for encryption. Google sign-in and One Tap are available when configured.

Web requests use session cookies; native clients can use bearer authentication. The mobile handoff exchanges a single-use code and verifier for a separate session after validating the browser session. Treat native session tokens as credentials.

[Server hooks](../src/hooks.server.ts) resolve sessions except on the public paths listed in [request policy](../src/lib/server/request-policy.server.ts). Authenticated API helpers reuse the resolved identity or perform their own lookup. Authorization remains a domain/route responsibility: a valid session alone does not establish ownership, organization membership, classroom role, or Super access.

Account surfaces require a durable 13+ self-attestation, with explicit exemptions for onboarding and related flows. The stored value is a confirmation timestamp. The legacy confirm-age input can validate a birth date without persisting it. This is self-attestation, not independently verified age assurance.

Organizations support personal spaces, study groups, and classrooms. Classroom eligibility includes verified email, feature availability, and teacher creation grants where applicable. Practice context scopes personal and classroom records separately. Group activity sharing defaults to disabled. Consult the organization helpers and [practice-context module](../src/lib/users/practice-context.server.ts) before adding data reads or writes.

## Data inventory

| Data | Storage and processing | Lifecycle |
| --- | --- | --- |
| Account identity, password hashes, OAuth credentials, verification records, sessions, IP/user-agent metadata | Neon `auth`; Better Auth; Resend for authentication email | Token/session expiration follows auth configuration. Account deletion removes linked records through auth hooks and schema relationships. |
| Organizations, memberships, invitations, classroom courses/enrollment, sharing preferences | Neon `auth` and `app` | Organization/member workflows and account relationships control removal. Leaving an organization is not equivalent to deleting every organization-owned record. |
| Course choices, profile preferences, age confirmation | Neon `app` | Kept with the account unless changed or deleted. |
| MCQ, quiz, exam and FRQ attempts, grades, bookmarks, progress, practice sessions, seen-question state | Neon `app`; selected responses/context may be processed by AI for grading or assistance | Personal practice clearing and account deletion are distinct operations; see below. |
| Shared practice sets, items, and activity audiences | Neon `app` | Access, revocation, membership, and deletion follow the shared-practice and organization workflows. |
| Coach conversations, messages, tool results, text attachments, and audits | Neon `app`; relevant context sent through AI Gateway | Durable conversation history. Do not assume a general time-based purge for all conversation content. |
| Coach images | Private Vercel Blob in production; local S3-compatible storage in development; Neon metadata | Cleanup selects detached images and stale unattached uploads and retries failed object deletion. Attached images follow conversation lifecycle. |
| Learning memories and embeddings | Mem0 OSS backed by environment-specific Neon PGVector tables in `public`; model calls through AI Gateway | User memory deletion, account cleanup, and post-Super retention processing. |
| Study plans/tasks | Neon `app` | Maintenance removes plans whose `updatedAt` is at least 90 days old; downgrade cleanup can also remove plans. |
| Super access, subscriptions, grants, usage, cleanup jobs | Neon `auth`, `app`, and `ops`; Stripe | Account deletion cancels subscriptions first; cleanup jobs persist until processed. Provider retention is separate. |
| Transactional email recipients, delivery state, webhook records | Neon `app` and Resend | No general retention period established here. Some operational records require separate retention handling. |
| Bug reports, app feedback, question feedback | Neon `app`/`content`; approved views imported into PostHog | Free text may include personal data. Account relationships and explicit cleanup differ by table; imported copies have their own refresh/provider lifecycle. |
| Browser preferences, consent, drafts, and transient state | Cookies, localStorage, sessionStorage | Browser storage and feature-specific expiration; clearing server practice data does not clear all local state. |
| Analytics, errors, traces, logs, and request metadata | PostHog, Sentry, Vercel, and configured browser telemetry | Provider-specific retention and deletion; not established by a database cascade. |

Exact table definitions and foreign-key actions are in [Drizzle schemas](../src/lib/server/neon/schema/). Neon also stores shared question content and operational queues; these are separate from account-owned practice records.

## AI processing and memory

Question generation, FRQ grading, question-specific Tutor, Coach, conversation summaries/titles, and memory use AI services. Prompts can include question content, student responses, conversation messages, attachments, profile preferences, progress, and retrieved learning memories as needed by the feature. Uploaded images and text can contain personal information even when the application does not request it explicitly.

Gateway routing and credentials are defined in [gateway configuration](../src/lib/server/gateway-credentials.server.ts); model selections live in the relevant domain modules. Provider storage/training policies and deployment configuration cannot be inferred from application code alone.

[Feature access](../src/lib/agent/access.server.ts) checks flags, account preferences where applicable, plan capabilities, age confirmation, and organization eligibility. Proposed Coach profile and study-plan writes require student approval. Server tool handlers validate and enforce the permitted changes.

[Memory service](../src/lib/agent/memory/service.server.ts) uses Mem0 OSS and the [Neon HTTP PGVector adapter](../src/lib/agent/memory/neon-http-pgvector.server.ts). Development, preview, and production have separate table pairs, with vector/payload and entity records filtered by a random per-user `mem0UserId`. Public memory IDs are derived per user rather than exposing the underlying Mem0 ID.

Memory retrieval and recording check opt-in/disclosure preferences, with feature/access checks in the calling flow. Recorded exchanges are bounded by `MAX_TUTOR_MEMORY_EXCHANGE_CHARS`. Instructions ask the model to retain useful learning context and exclude identity, contact, school/location, health, financial information, credentials, and full transcripts. These instructions are model-level controls, not deterministic removal of sensitive text.

Upstash Redis holds short-lived controls, not memory vectors. Memory contents and embeddings are stored in Neon. User-facing memory deletion and cleanup remove the relevant Neon memory records.

## Attachment handling

[Attachment validation](../src/lib/agent/attachments/validation.server.ts) accepts still PNG/JPEG/WebP images with byte, dimension, and decoded-pixel limits. Sharp decodes and re-encodes them as WebP, dropping source metadata. Text attachments accept supported UTF-8 text formats with byte/character limits, reject null bytes, and sanitize filenames.

[Image ownership checks](../src/lib/agent/attachments/images.server.ts) associate images with their user and conversation. Production objects use private Blob access; local S3 endpoint overrides are restricted to development. Private storage does not prevent image content from being sent to the AI service when the feature processes it.

Image cleanup is bounded and retryable. It removes objects before deleting metadata; failures postpone retries. It does not establish a fixed retention period for every image attached to a message.

## Analytics and monitoring

[Client PostHog policy](../src/lib/client/posthog-consent-policy.ts) sends pageview/pageleave traffic in cookieless mode while consent is pending or denied. Identification and product events send after consent; pending product events are queued in memory and discarded on rejection. Exceptions are dropped without consent by the wrapper. PostHog configuration masks inputs and `.ph-mask-pii` text in replay and redacts selected query parameters in captured network URLs. These controls do not guarantee that every possible DOM or error payload is free of personal data.

[Server PostHog capture](../src/lib/server/posthog.ts) requires the analytics consent cookie for identified/request events. A separate anonymous operational-metric function does not require consent and must receive no user IDs, question bodies, or personal data. Browser analytics consent is not a universal switch for operational monitoring: Sentry and server logging have their own configuration. Current Sentry options enable tracing and logs outside development/build.

Feedback reporting also uses a database import, separate from browser event capture. Restricted `feedback_analytics` views expose the approved report fields. Coach feedback export strips the appended chat-history block; free-text reports can still contain personal data. See the [PostHog feedback integration](integrations/posthog-feedback.md) for approved columns, reader permissions, refresh behavior, and verification history. Browser consent does not gate that database import path.

## Clearing data and account deletion

[Clear personal practice](../src/lib/users/clear-practice-data.server.ts) deletes personal-scoped attempts, progress, bookmarks, sessions, and seen-question rows using a null organization ID. It also deletes the user's practice activity events. It retains the account and does not clear classroom-scoped practice records or all Coach, billing, memory, and browser data.

[Account cleanup](../src/lib/users/account-cleanup.server.ts) starts before Better Auth deletes the user: it cancels Stripe subscriptions and creates a durable `account_delete` cleanup job. A cancellation failure aborts deletion. After auth deletion, explicit [application cleanup](../src/lib/users/delete-app-data-documents.server.ts) and foreign-key actions remove linked data, and background cleanup handles known Redis controls, eligible Coach images, PostHog person/event/recording deletion requests, and Neon memories. PostHog/memory failures update the job for retry; successful processing removes it.

[Memory maintenance](../src/lib/agent/memory/maintenance.server.ts) queues downgrade purges after Super has ended for 90 days, checks restored access before purging, and deletes expired study plans. [Super maintenance](../src/routes/api/cron/super-maintenance/+server.ts) also runs pending account cleanup. Execution depends on successful cron delivery and configured provider access; retryable work is not a guarantee of immediate provider deletion.

Account deletion does not prove deletion from provider backups, every anonymous report, operational mail records, or all imported analytics copies. Those lifecycles require separate provider and operational handling.

## Request protections and operational boundaries

Hooks configure trusted-origin CORS, security headers, account age gates, and global API rate limits, with explicit public-path exceptions. The Desmos sandbox has a separate frame/evaluation policy. Content Security Policy is configured in `vite.config.ts`. Individual APIs add body-size limits, schema validation, ownership/role checks, feature controls, usage limits, or webhook/cron authentication as appropriate.

Secrets remain in server-side configuration; never add credentials to docs or client payloads. Database schema changes follow the [migration guide](database-migrations.md). Code review establishes implemented controls, while production access lists, provider contracts, backup retention, incident procedures, and actual deployment configuration require operational verification.
