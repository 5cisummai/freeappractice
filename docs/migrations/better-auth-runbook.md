# Better Auth Migration Runbook

## Code status

This repo uses Better Auth with:

- [`src/lib/auth.ts`](../src/lib/auth.ts) — server config (`better-auth/minimal`, Mongo adapter, rate limits, cookie cache)
- [`src/lib/auth-client.ts`](../src/lib/auth-client.ts) — typed Svelte client
- [`src/hooks.server.ts`](../src/hooks.server.ts) — `svelteKitHandler` + session → `event.locals`
- App-data APIs under `/api/me/**`

## Collections

Better Auth:

- `authUsers`, `authAccounts`, `authSessions`, `authVerifications`

App data:

- `userprofiles` (Mongoose `UserProfile`)

Migration audit:

- `betterAuthMigrationMap`

Legacy (read-only after cutover):

- `users`

## Environment variables

Required:

- `DATABASE_URI`
- `BETTER_AUTH_SECRET` (32+ chars; `openssl rand -base64 32`)
- `BETTER_AUTH_URL` (e.g. `http://localhost:5173` local, `https://freeappractice.org` prod)
- `GOOGLE_CLIENT_SECRET` (if using Google OAuth)
- `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`

Optional:

- `MAINTENANCE_MODE=true` during cutover
- `PUBLIC_BASE_URL` for trusted origins and email links

## Local restore from backup

Prerequisites: Docker Mongo running (`docker compose up -d`).

```bash
# Restore emergency_migration_backup.gz (source DB: test → freeappractice)
pnpm auth:restore-local

# Or manually:
gunzip -c emergency_migration_backup.gz | \
  docker exec -i lmstudio_host-mongodb-1 mongorestore \
    --uri="mongodb://root:password@localhost:27017/?authSource=admin" \
    --archive --nsFrom='test.*' --nsTo='freeappractice.*' --drop
```

Set in `.env`:

```
DATABASE_URI=mongodb://root:password@localhost:27017/freeappractice?authSource=admin
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=http://localhost:5173
```

## Local migration pipeline

```bash
pnpm auth:restore-local   # optional: fresh restore from gz
pnpm auth:indexes
pnpm auth:migrate:dry
pnpm auth:migrate
pnpm auth:validate
# If auth users were migrated before _id fix, repair existing rows:
pnpm auth:repair-ids
# or: pnpm auth:verify
```

## Before production cutover

1. Set Vercel env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_SECRET`
2. Clone production DB to staging OR take `mongodump --archive` backup
3. Run migration pipeline on staging
4. Test: email/password, Google, forgot/reset password, verify email, `/api/me/*`, seen-question dedup
5. Confirm `GET /api/auth/ok` returns `{ "status": "ok" }`

## Production cutover

1. `MAINTENANCE_MODE=true` on Vercel
2. Final MongoDB backup (`mongodump --gzip --archive=production-backup.gz`)
3. Point `DATABASE_URI` at production (or run scripts with prod URI)
4. `pnpm auth:indexes && pnpm auth:migrate && pnpm auth:validate`
5. Deploy Better Auth branch
6. Smoke test 3–5 accounts (password, Google, user with history)
7. `MAINTENANCE_MODE=false`
8. Monitor logs; all users must re-login (sessions not migrated)

## Rollback

If migration fails **before** reopening:

1. Keep maintenance mode on
2. Redeploy previous app version
3. Restore Mongo backup only if migration corrupted data
4. Legacy `users` collection is untouched — safe reference

## Notes

- User IDs preserved from legacy Mongo `_id` strings
- Bcrypt password hashes preserved in `authAccounts` (provider `credential`)
- `seenquestions.userId` unchanged — no remap needed
- `conversations` collection in backup is legacy/orphan — not used by current app
