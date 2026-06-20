# Production Cutover Checklist

Execute on production when local/staging validation is complete. See [better-auth-runbook.md](./better-auth-runbook.md) for details.

## Pre-flight

- [ ] Local migration passed: `pnpm auth:restore-local && pnpm auth:migrate && pnpm auth:validate`
- [ ] `pnpm build` succeeds
- [ ] Vercel env vars set:
  - [ ] `BETTER_AUTH_SECRET` (new 32+ char secret for production)
  - [ ] `BETTER_AUTH_URL=https://freeappractice.org`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `DATABASE_URI` (production Atlas)
  - [ ] `PUBLIC_BASE_URL=https://freeappractice.org`
- [ ] Google OAuth redirect URI includes `https://freeappractice.org/api/auth/callback/google`

## Cutover (maintenance window)

- [ ] Set `MAINTENANCE_MODE=true` on Vercel
- [ ] Take production backup:
  ```bash
  mongodump --uri="$DATABASE_URI" --gzip --archive=production-$(date +%Y%m%d).gz
  ```
- [ ] Run against production URI:
  ```bash
  pnpm auth:indexes
  pnpm auth:migrate
  pnpm auth:validate
  ```
- [ ] Deploy `better-auth-migration` branch to production
- [ ] Smoke tests:
  - [ ] `GET https://freeappractice.org/api/auth/ok` → 200
  - [ ] Email/password login (migrated credential user)
  - [ ] Google login
  - [ ] `/api/me/stats` returns data when authenticated
  - [ ] Forgot/reset password flow
- [ ] Set `MAINTENANCE_MODE=false`

## Post-cutover

- [ ] Monitor Vercel logs for auth errors (24h)
- [ ] Keep legacy `users` collection read-only for 2 weeks
- [ ] Notify users they must sign in again (sessions not migrated)

## Rollback

If issues before reopening:

1. Keep maintenance mode on
2. Redeploy previous release
3. Restore Mongo backup only if migration corrupted data
4. Legacy `users` collection remains intact
