# Dead code & cleanup suggestions

Snapshot from a full [Fallow](https://docs.fallow.tools) scan (v3.28) on 2026-09-25, plus import reachability checks. Use this as a cut list, not as a mandate to zero every Fallow finding.

## TL;DR

| Priority | Action | Approx. payoff | Risk |
| --- | --- | --- | --- |
| Wave 1 | Delete proven-orphaned files | ~1.6k LOC | Low |
| Wave 2 | Drop unused load/action work | Less CPU, clearer routes | Low |
| Wave 3 | Collapse duplicated surfaces | Maintainability | Medium |
| Wave 4 | Configure Fallow ignores; prune real unused exports | Signal quality | Low |
| Wave 5 | Split high-complexity hot files (when touching them) | Long-term | Med–High |

**Do not** chase the raw ~553 issue count. Most “unused exports” are intentional shadcn / ai-elements barrel APIs.

---

## What Fallow reported (context)

Combined scan (`fallow`): cleanup + health + dupes.

### Cleanup summary

| Kind | Count | Notes |
| --- | ---: | --- |
| Unused exports | 442 | Mostly `components/ui/**` and `ai-elements/**` barrels |
| Unused types | 42 | Same barrel / kit noise + a few real orphans |
| Unused files | 25 | **19** calendar UI pieces; **6** real app/script orphans |
| Duplicate exports | 21 | Kit component name collisions across barrels |
| Dev deps in production | 10 | UI build deps (`bits-ui`, `clsx`, …) — don’t delete |
| Unused load data keys | 3 | Coach + settings |
| Circular deps | 1 | `calendar.svelte` ↔ `calendar/index.ts` (dies with Wave 1) |
| Unused devDependency | 1 | `@sveltejs/mcp` |

### Health (complexity)

- Files analyzed: ~939 · functions: ~4949
- Average maintainability: **90.8**
- Functions above threshold: **383** (88 critical / 123 high / 172 moderate)
- Churn × complexity hotspots: `question-card.svelte`, `practice-shell.svelte`, `quiz-session.svelte`, `hooks.server.ts`

Worst complexity units:

| Path | Unit | Cyclomatic | Cognitive |
| --- | --- | ---: | ---: |
| `src/lib/components/questions/question-card.svelte` | `<template>` | 90 | 137 |
| `src/lib/components/super/coach-shell.svelte` | `<template>` | 83 | 270 |
| `src/routes/app/onboarding/+page.svelte` | `<template>` | 68 | 119 |
| `src/lib/question-bank/mcq/payload.ts` | `normalizeQuestionPayload` | 52 | 43 |
| `src/lib/question-bank/quality/service.server.ts` | `updateQualityFromBatchLine` | 50 | 42 |
| `src/lib/super/agent-runtime.server.ts` | `createSuperAgentStreamResponse` | 46 | 62 |

### Duplication (~3.1% of scanned lines)

Largest clones:

| Lines | Locations |
| ---: | --- |
| ~73 | `src/routes/api/question/+server.ts` ↔ `src/routes/api/questions/batch/+server.ts` |
| ~54 | `site-footer.svelte` ↔ `landing-hero.svelte` |
| ~50 | `org-group-dashboard.svelte` ↔ `study-team-section.svelte` |
| ~29 | history / practice-activity data-table chrome |

---

## Wave 1 — delete proven-dead files (~1.6k LOC)

Safe deletes: nothing else imports these (except each other).

| Path | LOC | Why it’s dead |
| --- | ---: | --- |
| `src/lib/components/history/history-data-table.svelte` | 222 | Orphan. Progress uses `practice-activity-data-table.svelte` + `history-detail-sheet.svelte` |
| `src/lib/components/history/progress-history-panel.svelte` | 360 | Orphan. Only consumer of `history-data-table` |
| `src/lib/components/auth/birth-date-picker.svelte` | 83 | Orphan. Age flow uses attestation / confirm-age, not this picker |
| `src/lib/components/ui/calendar/**` | ~609 | Only imported by the dead birth-date picker; also owns the only circular dep |
| `src/lib/question-bank/question-id-registry.server.ts` | 45 | S3-era registry helper. Live writes go through `mcq/repository.server.ts` / FRQ model |
| `scripts/shared.ts` | 81 | Not referenced by `package.json` scripts or other scripts |
| `scripts/validate-ap-classes-data.ts` | 177 | Same — unreachable ops script |

### Wave 1 checklist

1. Delete the files above.
2. Update `src/lib/components/README.md` (still documents `history-data-table` / `progress-history-panel`).
3. Remove `question-id-registry.server.ts` from `eslint.config.js` ignores if listed.
4. Grep for leftover imports; run unit tests + a quick practice/history smoke.

Suggested PR shape: **one pure-delete PR**, no behavior changes.

---

## Wave 2 — stop unused route / load work

### Coach page

`src/routes/app/coach/+page.server.ts` returns:

- `planAccess` — unused by `+page.svelte` (only `hasCoachAccess` is used)
- `audits` — fetched via `getRecentCoachAudits` but never rendered

**Suggestion:** keep `hasCoachAccess` / `profile` / `coachEnabled`; drop `planAccess` and `audits` from the load return (and the audit query).

### Settings page

`src/routes/app/settings/+page.server.ts`:

- Loads `assistantFeaturesEnabled`
- Still has `updateAssistantFeatures` action
- `+page.svelte` does **not** reference either

**Suggestion (pick one):**

- **A.** Restore a settings toggle that reads/writes assistant features, or
- **B.** Remove the load field + action if the product no longer exposes that control (layout/nav still get the flag from `app/+layout.server.ts`)

### Age helpers

`src/lib/auth/age.ts` still has exports that primarily served the deleted picker (`EARLIEST_BIRTH_DATE`, date-input formatters, etc.). Keep what `confirm-age` / profile / tests use (`MINIMUM_ACCOUNT_AGE`, `isValidBirthDate`, `isAtLeastAge`, errors). Trim the rest after Wave 1.

---

## Wave 3 — collapse duplicated surfaces

Do these when already touching the files; don’t open a mega-refactor PR.

1. **Question APIs** — extract shared validate / rate-limit / metrics / error path used by:
   - `src/routes/api/question/+server.ts`
   - `src/routes/api/questions/batch/+server.ts`
2. **Marketing chrome** — shared link/CTA bits between footer and landing hero.
3. **Org / study-team marketing blocks** — shared composition for org dashboard vs study-team section.
4. **Tables** — finish consolidating history vs practice-activity table chrome (columns already partly shared).

---

## Wave 4 — unused exports (after ignoring kit noise)

### Configure Fallow (recommended)

Add project config so barrels don’t drown real signal, for example ignore or down-rank:

- `src/lib/components/ui/**`
- `src/lib/components/ai-elements/**`

Also decide whether `@sveltejs/mcp` stays as a tooling dep or gets removed from `devDependencies`.

### Then prune real app orphans (verify with `fallow dead-code --trace …` first)

Examples that looked unused outside kits:

| Area | Examples |
| --- | --- |
| Pool constants | Several `QUESTION_POOL_*` knobs with no importers |
| Auth surface helpers | `isAnonymousMcqFetch`, `shouldSkipGlobalApiRateLimit`, … if truly unreferenced |
| Coach tool schemas | Unused schema/helper exports in `coach-question.ts` / `coach-practice-question.ts` |
| Study plan | Exported helpers that are only used internally — demote to non-exports |
| AP knowledge | `AP_KNOWLEDGE_REVIEWED_AT`, `AP_KNOWLEDGE_FRESHNESS_NOTE` if unused |

**Rule:** never auto-delete an export without `--trace`. Dynamic imports, scripts, and tests can hide consumers.

---

## Wave 5 — complexity hotspots (refactor, don’t delete)

These are live product surfaces. Split when you next change them; don’t refactor for the score alone.

| File | Suggestion |
| --- | --- |
| `question-card.svelte` | Extract snippets / child components (choices, feedback, annotations) |
| `coach-shell.svelte` | Split composer, message list, tool/approval UI, streaming state |
| `onboarding/+page.svelte` | Split welcome / age / subjects / Super setup steps |
| `normalizeQuestionPayload` | Narrow schema branches; pull stimulus vs MCQ paths apart |
| `createSuperAgentStreamResponse` | Keep the agent/runtime split going; isolate stream event mapping |

---

## Leave alone (for now)

| Thing | Why |
| --- | --- |
| UI kit barrel exports | Public component API by design |
| `questionRegistry` table / `contentHash` | Still used by pool + quality; only the orphan *helper file* is dead |
| Blog / summer marketing routes | Live routes; unfinished ≠ unreachable |
| DevDeps flagged as “in production” | Bundled UI libs — move to `dependencies` or ignore in Fallow, don’t delete |
| Coach Bloub unused methods (`setLook`, `reset`) | May be intentional avatar API surface — confirm before cutting |
| Feature already removed | MongoDB, S3 question store, referrals, Insights, realistic mode, calculator / reference sheet, dual-cache leftovers, Redis flag cache |

---

## Suggested execution order

1. **Wave 1 PR** — pure deletes + README/eslint cleanup.
2. **Wave 2 PR** — coach/settings load + age export trim.
3. **Optional:** `fallow init` / ignore config so future scans stay useful.
4. **Wave 3** — opportunistically when editing question APIs or marketing.
5. **Wave 5** — only alongside real feature work on those files.

### Re-scan commands

```bash
npx fallow --format json --quiet
npx fallow dead-code --unused-files --format json --quiet
npx fallow dead-code --trace path/to/file.ts:ExportName
npx fallow dupes --format json --quiet
npx fallow health --hotspots --targets --format json --quiet
```

---

## Already cleaned in recent releases

Useful so we don’t re-hunt:

- MongoDB → Neon-only
- Question storage S3 → Neon
- Referrals removed
- Insights removed
- Realistic mode removed
- Calculator / reference sheet tools removed
- Dual-cache / hydratable-history leftovers removed
- Redis caching of Vercel flags removed
- Super agent split from turn runtime

---

## Appendix — Wave 1 unused files (full Fallow list)

Real orphans (delete):

- `scripts/shared.ts`
- `scripts/validate-ap-classes-data.ts`
- `src/lib/components/auth/birth-date-picker.svelte`
- `src/lib/components/history/history-data-table.svelte`
- `src/lib/components/history/progress-history-panel.svelte`
- `src/lib/question-bank/question-id-registry.server.ts`

Calendar kit (delete with birth-date picker):

- `src/lib/components/ui/calendar/calendar-caption.svelte`
- `src/lib/components/ui/calendar/calendar-cell.svelte`
- `src/lib/components/ui/calendar/calendar-day.svelte`
- `src/lib/components/ui/calendar/calendar-grid-body.svelte`
- `src/lib/components/ui/calendar/calendar-grid-head.svelte`
- `src/lib/components/ui/calendar/calendar-grid-row.svelte`
- `src/lib/components/ui/calendar/calendar-grid.svelte`
- `src/lib/components/ui/calendar/calendar-head-cell.svelte`
- `src/lib/components/ui/calendar/calendar-header.svelte`
- `src/lib/components/ui/calendar/calendar-heading.svelte`
- `src/lib/components/ui/calendar/calendar-month-select.svelte`
- `src/lib/components/ui/calendar/calendar-month.svelte`
- `src/lib/components/ui/calendar/calendar-months.svelte`
- `src/lib/components/ui/calendar/calendar-nav.svelte`
- `src/lib/components/ui/calendar/calendar-next-button.svelte`
- `src/lib/components/ui/calendar/calendar-prev-button.svelte`
- `src/lib/components/ui/calendar/calendar-year-select.svelte`
- `src/lib/components/ui/calendar/calendar.svelte`
- `src/lib/components/ui/calendar/index.ts`
