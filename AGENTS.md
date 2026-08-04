# Agent instructions — LMstudio_host

Read this before changing anything. These rules override vague defaults.

---

## What this project is

- **Stack**: TypeScript, Bun, SvelteKit
- **Tooling**: Prettier, ESLint, Tailwind CSS, sveltekit-adapter, MCP
- **Product**: A SvelteKit app for hosting and managing LM Studio–related UI and client-side behavior

Treat this as a focused product surface, not a playground for framework experiments. Prefer the smallest correct change that keeps the app working and easy to maintain.

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

---

## Working style

Act like a lazy senior engineer: solve the real problem with the fewest moving parts.

1. **YAGNI** — Do not build for hypothetical future needs.
2. **No invented architecture** — Do not over-abstract, invent patterns, or add helpers/layers/structures that are not needed right now.
3. **Inline when enough** — If a simple inline change fixes it, keep it simple. Do not extract “for cleanliness” unless reuse or clarity clearly requires it.
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
