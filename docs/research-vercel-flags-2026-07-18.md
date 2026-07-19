# Research: Vercel Flags × Free AP Practice (SvelteKit)

**Date:** 2026-07-18  
**Primary sources:** [Vercel Flags overview](https://vercel.com/docs/flags), [Vercel Flags](https://vercel.com/docs/flags/vercel-flags), [Flags SDK + Vercel adapter](https://vercel.com/docs/flags/vercel-flags/sdks/flags-sdk), [SDKs](https://vercel.com/docs/flags/vercel-flags/sdks), [Flags Explorer](https://vercel.com/docs/flags/flags-explorer/getting-started), [Observability](https://vercel.com/docs/flags/observability), [SvelteKit Flags SDK](https://flags-sdk.dev/docs/frameworks/sveltekit)

---

## Verdict

This app already has **half** of the Flags stack: `flags` + SvelteKit `createHandle` + Toolbar + two declared flags. It does **not** yet connect evaluations to the **Vercel Dashboard Flags** provider — that requires `@flags-sdk/vercel` + `vercelAdapter()`, OIDC/`FLAGS` credentials, and promoting drafts in the dashboard.

---

## What you already have

| Piece                                 | Status                     | Where                                      |
| ------------------------------------- | -------------------------- | ------------------------------------------ |
| `flags` package                       | ✅ `^4.2.0`                | `package.json`                             |
| Flag declarations                     | ✅ two flags               | `src/lib/flags.ts`                         |
| Discovery + overrides hook            | ✅ gated on `FLAGS_SECRET` | `src/hooks.server.ts`                      |
| Vercel Toolbar (local)                | ✅                         | `vite.config.ts`, `+layout.svelte`         |
| `@flags-sdk/vercel` / `vercelAdapter` | ❌ missing                 | —                                          |
| Dashboard-managed values              | ❌                         | Local `decide()` / hardcoded `false` / env |

### Declared flags today

1. **`multi-attempt-experiment`** (`multiAttemptExperimentEnabled`)
   - Kill-switch for sticky multi-attempt experiment ([DEV-60](https://linear.app/freeappractice/issue/DEV-60)).
   - Currently hard-off: `decide() → false`, `isMultiAttemptExperimentEnabled() → false`.
   - API `GET /api/me/practice-experiment` also hard-returns `experimentEnabled: false` (bypasses the flag).

2. **`frq-practice`** (`frqPracticeEnabled`)
   - Pilot gate for authenticated FRQ practice ([DEV-82](https://linear.app/freeappractice/issue/DEV-82)).
   - `decide()` reads `FRQ_PRACTICE_ENABLED === 'true'`.
   - Used by practice page load, FRQ gate, dashboard, history API.

### Explorer wiring

When `FLAGS_SECRET` is set, `createHandle` exposes `/.well-known/vercel/flags` and honors Toolbar overrides. Without it, Explorer cannot authenticate and flags fall back to `decide()` only. See [Flags Explorer getting started](https://vercel.com/docs/flags/flags-explorer/getting-started).

---

## How Dashboard Flags connection works

Two layers (easy to confuse):

1. **Flags Explorer / discovery** (already mostly done)
   - Code declares flags → discovery endpoint → Toolbar can list & override.
   - Needs `FLAGS_SECRET` + Toolbar.

2. **Vercel Flags as provider** (the gap)
   - Dashboard owns on/off, targeting, rollouts, per-env values.
   - Needs `@flags-sdk/vercel`, `adapter: vercelAdapter()`, and project auth via OIDC (`vercel env pull` locally; automatic on Vercel) or an SDK key in `FLAGS`.
   - Code-defined flags appear as **drafts** after deploy; promote in Dashboard to manage them.  
     Sources: [Vercel Flags](https://vercel.com/docs/flags/vercel-flags), [Flags SDK adapter](https://vercel.com/docs/flags/vercel-flags/sdks/flags-sdk), [SDKs](https://vercel.com/docs/flags/vercel-flags/sdks).

### Target shape for each flag

```ts
import { flag } from 'flags/sveltekit';
import { vercelAdapter } from '@flags-sdk/vercel';

export const frqPracticeEnabled = flag<boolean>({
	key: 'frq-practice',
	description: 'Enable authenticated written-response practice for pilot courses',
	adapter: vercelAdapter(),
	// optional until draft is promoted:
	// defaultValue: false,
	options: [
		{ value: true, label: 'On' },
		{ value: false, label: 'Off' }
	]
});
```

For user/team targeting (e.g. beta testers, course pilots), add an `identify` function that returns entity attributes matching Dashboard segments. See [adapter + identify](https://vercel.com/docs/flags/vercel-flags/sdks/flags-sdk).

---

## What should be a feature flag vs not

### Should be Vercel Flags (product behavior / rollout)

| Candidate                                                                               | Why                                                                                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `frq-practice`                                                                          | Pilot kill-switch; toggle without redeploy; per-env (dev on / prod off).                            |
| `multi-attempt-experiment`                                                              | Experiment master kill-switch; keep sticky assignment in Mongo, but gate enrollment from Dashboard. |
| Future: focused session loop ([DEV-41](https://linear.app/freeappractice/issue/DEV-41)) | New UX — ship behind a flag.                                                                        |
| Future: new course FRQ profiles beyond pilot                                            | Gradual course rollout / segment by course or user.                                                 |
| Future: landing / growth UI experiments                                                 | A/B via Dashboard splits + Web Analytics.                                                           |

### Keep as env / config (not Flags)

| Item                                                     | Why                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Model names (`GENERATION_MODEL`, `FRQ_GRADING_MODEL`, …) | Ops config, not user-facing rollout.                                     |
| Secrets (`CRON_SECRET`, tokens, API keys)                | Never flags.                                                             |
| Cache TTLs / pool sizes                                  | Tuning knobs.                                                            |
| `QUESTION_QUALITY_*` calibration gates                   | Internal batch pipeline, not runtime UX.                                 |
| Sticky experiment **assignment**                         | Already correctly on the user profile; flag only enables the experiment. |

### Cleanup when connecting Dashboard

- Route `GET /api/me/practice-experiment` should call `isMultiAttemptExperimentEnabled()` / assignment helpers instead of hardcoding `false`.
- Restore `isMultiAttemptExperimentEnabled()` to evaluate the flag (not always `false`).
- After Dashboard owns values, drop `FRQ_PRACTICE_ENABLED` env fallback (or keep only as emergency `defaultValue` / offline fallback).

---

## Setup checklist (to finish Dashboard connection)

1. [ ] `bun add @flags-sdk/vercel`
2. [ ] Ensure project is linked: `vercel link`
3. [ ] Set `FLAGS_SECRET` in Vercel for Development / Preview / Production (Sensitive on Preview+Prod). Generate: `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`
4. [ ] `vercel env pull` (pulls OIDC / `FLAGS` after flags exist)
5. [ ] Add `adapter: vercelAdapter()` to both flags in `src/lib/flags.ts`
6. [ ] Optionally add `identify` (user id, email, plan/course) for targeting
7. [ ] Deploy production → open **Flags → Drafts** → promote `frq-practice` and `multi-attempt-experiment`
8. [ ] Configure per-env defaults in Dashboard (e.g. FRQ on in Development, off in Production until pilot)
9. [ ] Un-hardcode multi-attempt helpers + practice-experiment API
10. [ ] Verify Toolbar → Flags Explorer overrides; check evaluations in Runtime Logs / Web Analytics ([observability](https://vercel.com/docs/flags/observability))

---

## Observability note

Flags SDK evaluations report automatically (`reportValue` under the hood). This project already has `@vercel/analytics` and `@vercel/speed-insights`, so Dashboard-connected flags can correlate with Web Analytics once values are emitted (SvelteKit `createHandle` injects resolved values when configured). Source: [Observability](https://vercel.com/docs/flags/observability).

---

## Bottom line

You are **not** missing the Flags SDK — you are missing the **Vercel provider adapter** and **Dashboard promotion**. Wire `vercelAdapter`, set secrets, promote the two existing draft keys, then drive FRQ and multi-attempt from the Flags tab instead of env vars / hardcoded offs.
