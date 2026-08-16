# Agent instructions — Free AP Practice

Read this before changing anything. These rules override vague defaults.

---

## What this project is

- **Stack**: TypeScript, Bun, SvelteKit
- **Tooling**: Prettier, ESLint, Tailwind CSS, Vercel adapter, MCP
- **Product**: A free AP exam-practice app with MCQ/FRQ practice, progress and history, Coach, tutoring, Insights, and optional Super features

Treat this as a focused product surface, not a playground for framework experiments. Prefer the smallest correct change that keeps the app working and easy to maintain.

## Repository map

| Area                                                 | Primary ownership                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/routes`                                         | SvelteKit pages, layouts, and thin HTTP boundaries                         |
| `src/lib/question-bank`                              | Canonical question serving, generation, bank metadata, quality, and refill |
| `src/lib/grading/frq`                                | FRQ attempt persistence and grading workflows                              |
| `src/lib/users`, `src/lib/referrals`, `src/lib/auth` | Accounts, attempts, progress, history, bookmarks, and referrals            |
| `src/lib/super`, `src/lib/tutor`, `src/lib/mem0`     | Coach, tutor personalization, study plans, Insights, billing, and memory   |
| `src/lib/question-bank/quality`, `src/lib/admin`     | Review jobs and operational dashboards                                     |
| `src/lib/server/neon`                                | Drizzle schema and the Neon database client                                |
| `scripts`                                            | Operations and database maintenance tooling                                |

Neon PostgreSQL is the only application database. Domain functions call Drizzle directly; there is no compatibility model or MongoDB runtime dependency.

## Drizzle migrations

Schema lives in `src/lib/server/neon/schema/`. **Never hand-write migration SQL or edit `drizzle/meta/_journal.json` directly.**

1. **Change the schema** in `src/lib/server/neon/schema/` (Drizzle table/column definitions).
2. **Generate** the migration: `bun run db:generate`
   - Creates `drizzle/NNNN_*.sql`, `drizzle/meta/NNNN_snapshot.json`, and a journal entry.
   - Review the generated SQL before applying.
3. **Apply** to Neon: `bun run db:apply`
   - Runs `scripts/apply-neon-migrations.ts` (HTTP transactions; records checksums in `public._neon_schema_migrations`).

**Do not:**
- Write `.sql` files by hand and add journal entries manually.
- Run `drizzle-kit push` or other schema-sync shortcuts unless the user explicitly asks.
- Edit an already-applied migration file (the apply script rejects checksum mismatches).

If `db:generate` picks a conflicting migration number (e.g. two `0015_*` files), rename the new SQL file and journal tag to the next free number, move the new snapshot to the matching `drizzle/meta/NNNN_snapshot.json`, and restore the previous snapshot file from git if it was overwritten.

---

## Hard constraints

Follow these without exception.

| Rule                                        | Detail                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No Playwright (or similar) for testing**  | Do not install, add, or configure Playwright or other browser-automation tooling for testing.                                                                                                                                                                                                                                                       |
| **Verify in the browser with native tools** | Use Codex’s or Cursor’s built-in browser tools for browser verification.                                                                                                                                                                                                                                                                            |
| **Feature flags**                           | Use the existing Vercel Flags implementation. Do not introduce env vars as a substitute for flags.                                                                                                                                                                                                                                                  |
| **Sync Scan**                               | Only run Sync Scan after long, hard changes — not on routine edits.                                                                                                                                                                                                                                                                                 |
| **Serverless deploy**                       | This app deploys to Vercel (serverless). Design and implement with that environment in mind (cold starts, no long-lived local process assumptions, no shared memory, etc.).                                                                                                                                                                         |
| **Do not overuse Superpowers skills**       | This file and the user’s request win over Superpowers ceremony. Do not run brainstorming, writing-plans, TDD skill loops, or other Superpowers workflows for straightforward edits, rewrites, or clear instructions. Use a Superpowers skill only when it clearly helps the specific task — never by default, and never when it slows a simple job. |

| **Tailwind-first styling** | Use Tailwind utility classes for all component and page styling. Do not add `<style>` blocks to `.svelte` files; put shared Tailwind theme definitions or unavoidable global keyframes in `src/routes/layout.css`, and reserve inline `style=` attributes for runtime data values only. The exception is the prose class and its variants, which should have their definitions in `src/routes/layout.css`. |

---

## Aside Browser — required for account setup

Use the Aside Browser skill at `.agents/skills/aside-browser/SKILL.md` whenever completing work that requires the user’s logged-in browser accounts or interactive website setup, including logging into Neon or Vercel, provisioning databases, changing dashboard settings, or configuring integrations through a web UI.

Use the browser skill for those account-bound actions and verify the resulting UI state. Continue using the CLI or APIs for ordinary non-interactive checks and scripted work. This rule does not authorize browser automation for testing; the no-Playwright testing constraint above still applies. Use the in-app browsers for normal testing.

## Working style

Act like a lazy senior engineer: solve the real problem with the fewest moving parts.

1. **YAGNI** — Do not build for hypothetical future needs.
2. **No invented architecture** — Do not over-abstract, invent patterns, or add helpers/layers/structures that are not needed right now. Also, do not consider compatibility to be the biggest concern unless it is stated.
3. **Inline when enough** — If a simple inline change fixes it, keep it simple. Do not extract “for cleanliness” unless reuse or clarity clearly requires it. For simple changes, do not run expensive lints and typecheck because there is a 99 percent chance they are correct and they will be fixed later if not.
4. **Skip ritual process** — If the user already said what to do, just do it. Do not invent multi-step skill pipelines, design docs, or approval gates unless the task is large/ambiguous and the skill would actually reduce mistakes.

Default question before every change: _Is there a smaller edit that still solves this?_

---

## Linear workflow

When work is tied to a Linear issue:

1. Set status to **In Progress** before you start implementation.
2. After the work is complete and verified, set status to **In Review**.

---

## Subagent model selection

Pick models by host and task weight.

### Cursor

| Task weight | Model                  |
| ----------- | ---------------------- |
| Harder      | Cursor Grok 4.5 (high) |
| Lighter     | Composer 2.5           |

### Codex

| Task weight | Model                  |
| ----------- | ---------------------- |
| Harder      | 5.6 Luna, xhigh effort |
| Easier      | high effort            |

---

## Svelte MCP — required for Svelte / SvelteKit work

You have the Svelte MCP server (Svelte 5 + SvelteKit docs and helpers). Use it as follows.

### Tool order

1. `**list-sections**` — Call this **first** whenever the task involves Svelte or SvelteKit. It returns section titles, `use_cases`, and paths. Use it to find relevant docs before writing or guessing.
2. `**get-documentation**` — After `list-sections`, read the returned sections (especially `use_cases`) and fetch **all** sections relevant to the task. Pass one or many sections.
3. `**svelte-autofixer**` — Run this whenever you write Svelte code, **before** showing it to the user. Re-run until it returns no issues or suggestions.
4. `**playground-link**` — Only after the user confirms they want a playground link. **Never** call it when the code was written into project files.

### Quick checklist

- [ ] Svelte/SvelteKit topic → `list-sections` at the start
- [ ] Relevant sections → `get-documentation` for all of them
- [ ] Wrote `.svelte` / Svelte code → `svelte-autofixer` until clean
- [ ] Playground → ask first; skip if code lives in the repo
