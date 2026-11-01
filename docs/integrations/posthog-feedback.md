# PostHog product feedback

## Status and targets

Production is connected and importing the two approved views with hourly full
refresh and server certificate verification. Initial verification on October 31,
2026 found 4 feedback reports and 64 bug reports; all 68 remained distinct after
identity mapping, with 11 linked to existing PostHog people. Anonymous and
unmatched reports remain visible.

- Dashboard: https://us.posthog.com/project/486732/dashboard/2286190
- Production source: https://us.posthog.com/project/486732/data-management/sources/01a19340-c8c0-0000-df58-ab24f623b647/schemas
- Saved view: `product_feedback`, defined in `posthog-product-feedback.sql`.
- User filter: `Feedback user ID` (`feedback_user_id`), String, empty default.
  Empty includes all reports; a value matches the application user ID exactly.
- Dashboard tiles: recent reports with person links, submissions over time,
  categories, bug severity, and actual successful sync-job timestamps (UTC).

Confirmed production target (October 31, 2026):

- Organization: Vercel: AJ's projects (`org-blue-meadow-40400892`).
- Project: `freeappractice-production` (`old-butterfly-68867755`).
- Branch: `main` (`br-cool-bonus-aveiccax`), marked as the Vercel production branch.
- Database: `neondb`.
- Direct host: `ep-muddy-wind-avaoc5gq.c-11.us-east-1.aws.neon.tech`.

The local `.env` points at development (`ep-still-glitter-au1703ww`), not this
production endpoint. Select the Vercel organization explicitly when listing Neon
projects. The connector's advertised branch creation and credential retrieval
methods were unavailable, so the logged-in browser was used for those operations.
Migration `0008_giant_baron_zemo` was generated, tested, and applied with the
repository migration runner; existing migration checksums matched and it was the
only pending migration.

The temporary PostHog validation source and its active imported tables were removed
after verification. Temporary owner and validation credential files were deleted;
only the dedicated production reader credential file remains in the private
local directory.

An isolated schema-only branch `posthog-feedback-validation`
(`br-raspy-wave-avy8c3iu`) was used for synthetic reports and is configured to expire
automatically. Verification covered real reader logins, underlying-table access
and write denial, excluded columns, Coach transcript removal, full-refresh
propagation of a deleted synthetic report, and exact user-ID filtering. No
synthetic reports were submitted to production. Credentials are private local
files outside the checkout; no credentials belong in this runbook.

## Approved export

- `feedback_analytics.feedback`: id, user_id, category, created_at, message.
  For Coach reports, the first appended `Included chat history` block and all
  following content are removed. The report header and submitted report remain.
- `feedback_analytics.bug_reports`: id, user_id, title, description, steps,
  expected, severity, created_at. Email and arbitrary metadata are absent.

Free text can contain personal details typed by the reporter. These are operational
feedback records; do not generate analytics events, identify previously untracked
users, or copy report content into person properties.

## Apply and provision

1. Confirm the production endpoint against Neon and the deployed application's
   production configuration. Use a direct connection with TLS verification.
2. Test the generated `0008_giant_baron_zemo` migration on an isolated Neon branch
   first. Run `bun scripts/verify-feedback-analytics.ts` with that branch's
   DATABASE_URL to verify the actual SQL transformation without inserting reports.
3. Review the migration and existing migration status before running
   `bun run db:apply` against the confirmed production target. The runner applies
   pending migrations in order; do not accidentally apply unrelated migrations.
4. Set `FEEDBACK_ANALYTICS_CONFIRMED_HOST` to that direct hostname and
   `FEEDBACK_ANALYTICS_CREDENTIAL_FILE` to a new absolute path outside the checkout,
   in a private directory. Run `bun scripts/setup-feedback-analytics.ts --apply`.
   DATABASE_URL must hold the confirmed direct owner connection. Never paste the
   password or URL into chat or commit it.

Provisioning uses a transaction, creates `posthog_feedback_reader` without role
membership or elevated privileges, and grants CONNECT, schema USAGE, and SELECT on
exactly the two views. It rejects inherited SELECT/write access on other user
relations and CREATE access on user schemas. If PUBLIC privileges fail this audit,
stop and investigate; do not revoke shared privileges globally as a workaround.
No default privileges on future objects are granted. Owner-executed views are
intentional: the importer receives no permissions on the original tables.

The credential file is created exclusively with mode 0600 before role creation,
so a filesystem failure cannot strand an active role with a lost password. If the
transaction fails, its credential file is nonfunctional; remove it before retrying.
An existing role is never silently reused or overwritten.

## Connect and verify

Use PostHog's source wizard, selecting Postgres/Neon, prefix `feedback_prod`,
schema `feedback_analytics`, direct hostname, and verified TLS. Use the private
credential file locally to enter connection details. Do not use owner credentials.
Explicitly select only `feedback` and `bug_reports`. Verify both views are
actually discovered; stop if they are not supported. Start with manual full
refresh, compare counts, then enable hourly full refresh for both views.

Verify with the restricted login that both views are readable, original report and
account tables fail with permission errors, excluded fields are inaccessible, and
INSERT/UPDATE/DELETE fail. Do not modify existing production reports to test this.
On the isolated branch, create a disposable report, refresh, delete it, and refresh
again; verify disappearance from PostHog's active dataset. Keep test sources out
of the production dashboard and remove them after testing.

Full refresh is intentional: creation-time incremental imports do not reconcile
account-deletion cascades. Confirm PostHog's current refresh replacement behavior
and deletion/retention policy before production rollout. A failed refresh can leave
old data visible; monitor sync failures and freshness.

## PostHog model and dashboard

After discovery, use the actual imported names in a saved view `product_feedback`.
UNION ALL the two sources with this contract:

| Column           | Feedback         | Bug report          |
| ---------------- | ---------------- | ------------------- |
| report_id        | `feedback:` + id | `bug_report:` + id  |
| report_type      | feedback         | bug_report          |
| created_at       | created_at       | created_at          |
| user_id          | nullable user_id | nullable user_id    |
| category         | category         | bug                 |
| severity         | null             | severity            |
| title            | null             | title               |
| report_text      | message          | description         |
| steps / expected | null             | corresponding field |

Resolve user_id through PostHog's distinct-ID-to-person mapping and LEFT JOIN a
mapping with at most one person per user_id. Do not equate the application's user
ID with PostHog's internal person UUID. Preserve null/unmatched users and verify
that joining does not increase report counts. Show a person link only for matched
people; do not create profiles from imported feedback.

Create a **Product feedback** dashboard with recent reports, daily submission
counts, category counts, bug severity, and a user-ID filter. Expose report text in
the recent-report table. Add source links and the actual last-successful-refresh
timestamp for each source, taken from PostHog sync metadata. Do not label the most
recent report timestamp as sync freshness. If sync metadata is unavailable to a
query, show the source-status links and a clearly labeled manually verified sync
time until an actual sync-metadata integration is available.

## Operations

- Inspect schema/job status in Data pipeline → Sources after initial setup and
  whenever freshness is stale. Resolve the error and rerun a full refresh.
- Rotate the reader password through Neon role management or an authorized admin connection; store it
  privately, update the source credential, run a refresh, verify, and remove the
  old private credential file. Never log ALTER ROLE statements containing secrets.
- Revoke access by stopping sync and setting the role NOLOGIN, then revoking its
  two SELECT grants and schema USAGE. Removing the source's imported data is a
  separate PostHog action; revoking the database login does not erase past imports.
- Restrict PostHog project/table access to people who should read report text.

When changing this integration, rerun the corresponding live checks before marking
the changed behavior verified.
