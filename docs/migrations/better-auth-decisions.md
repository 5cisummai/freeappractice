# Better Auth Migration Decisions

Date: 2026-06-19
Branch observed: `update/1.4.1`

This document locks the foundational migration decisions before implementation. The migration is designed for maximum user safety, with planned downtime accepted.

## Locked Decisions

### 1. Cutover model

**Decision:** Use a hard cutover with maintenance downtime.

- No live dual-write migration.
- No concurrent old-auth/new-auth production period.
- Writes will be frozen during production migration.

**Reason:** This removes race conditions around auth state, progress writes, bookmarks, attempts, email changes, signup, and password reset.

### 2. Session migration

**Decision:** Do not migrate existing JWT sessions.

- All users will be signed out after cutover.
- Users must log in again using Better Auth.
- Existing localStorage bearer tokens become obsolete.

**Reason:** Converting custom JWT/localStorage sessions to Better Auth cookie sessions adds avoidable risk. A forced re-login is safer and predictable.

### 3. Better Auth route ownership

**Decision:** Better Auth owns `/api/auth/**` after the migration.

Current app-data routes under `/api/auth` will be moved out before cutover.

Current app-data routes to move:

- `/api/auth/stats`
- `/api/auth/progress`
- `/api/auth/history`
- `/api/auth/bookmark`
- `/api/auth/bookmarks`
- `/api/auth/record-attempt`
- `/api/auth/record-frq-attempt`

Target namespace:

- `/api/me/**`

**Reason:** Avoid route conflicts with Better Auth and separate auth concerns from product data APIs.

### 4. Auth data vs app data

**Decision:** Better Auth will own authentication data only.

Better Auth owns:

- users
- accounts
- sessions
- verification/reset records
- OAuth provider links
- password hashes

The app owns:

- progress
- MCQ question history
- FRQ history
- bookmarks
- seen-question data

**Reason:** The current `User` schema mixes authentication and product state. Splitting these makes future auth changes safer.

### 5. User profile collection

**Decision:** Create a new app-owned `UserProfile` collection for migrated user app data.

Planned fields:

- `userId`
- `legacyUserId`
- `progress`
- `questionHistory`
- `frqHistory`
- `bookmarkedQuestions`
- timestamps

**Reason:** Keeps Better Auth user records clean and avoids storing large app-history arrays in auth user documents.

### 6. Password compatibility

**Decision:** Preserve existing bcrypt password hashes.

- Existing `User.password` bcrypt hashes will be migrated into Better Auth credential accounts.
- Better Auth email/password will be configured to hash and verify with `bcryptjs` initially.
- Users should not need password resets solely because of migration.

**Reason:** Password-reset-for-all is bad UX and creates support risk.

### 7. Google account migration

**Decision:** Existing Google-linked accounts will become Better Auth Google account records.

Current fields:

- `googleId`
- `authProvider`

Target:

- Better Auth `account` record with provider `google`.

If a user has both password and Google login, they should end up with both account records linked to the same Better Auth user.

### 8. Legacy data retention

**Decision:** Do not delete the old `users` collection during migration.

- Keep the legacy collection read-only after cutover.
- Use it for rollback/debugging if needed.
- Cleanup happens only after a stability window.

**Reason:** This gives us a safe recovery path if a user reports missing progress/history/bookmarks.

### 9. User ID strategy

**Decision:** Prefer preserving the old Mongo `_id` string as the Better Auth user ID if cleanly supported.

Fallback:

- Generate Better Auth user IDs normally.
- Store a legacy-to-new mapping.
- Migrate `SeenQuestion.userId` and any other user references.

**Reason:** Preserving IDs minimizes downstream changes. If Better Auth adapter constraints make that risky, explicit mapping is safer.

### 10. Migration execution style

**Decision:** Migration scripts must be idempotent and auditable.

Scripts must support:

- dry run
- commit mode
- resume mode
- verify-only mode

Migration state should be recorded in a dedicated mapping/log collection.

**Reason:** If migration is interrupted or partially fails, it must be safely resumable.

### 11. Production deployment model

**Decision:** Production cutover sequence will be:

1. Enable maintenance mode.
2. Take final production MongoDB backup.
3. Run indexes/setup.
4. Run migration.
5. Run validation script.
6. Run manual smoke tests.
7. Deploy or activate Better Auth app version.
8. Disable maintenance mode.
9. Monitor.

### 12. Rollback model

**Decision:** Rollback must remain simple until the site is reopened.

If migration fails before reopening:

1. Keep maintenance mode enabled.
2. Drop/ignore Better Auth migration output.
3. Redeploy old code.
4. Restore backup only if legacy data was modified.
5. Disable maintenance mode.

Because the old `users` collection is not modified/deleted, rollback risk is minimized.

## Current repo notes

Current custom auth is centered around:

- `src/lib/server/models/user.ts`
- `src/lib/server/auth.ts`
- `src/hooks.server.ts`
- `src/lib/client/auth.svelte.ts`
- `src/lib/client/auth-storage.ts`
- `src/lib/client/api.ts`

Current custom auth uses:

- JWT bearer tokens
- localStorage token persistence
- Mongoose `User` model
- custom Google ID token verification
- custom email verification/reset tokens

## Non-goals for the initial migration

- No live dual-write auth bridge.
- No old JWT session preservation.
- No deletion of legacy users during cutover.
- No storage of large progress/history arrays in Better Auth auth-user records unless absolutely necessary.

## Next step

Proceed to step 2: create or confirm a dedicated migration branch before code changes.
