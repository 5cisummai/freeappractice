# Agent Instructions — Free AP Practice

## Project

Free AP Practice is an AP exam preparation platform with MCQs, FRQs, progress tracking, Coach, tutoring, study plans, and Super features.

- **Stack:** TypeScript, Bun, SvelteKit, Tailwind CSS, Neon PostgreSQL, Drizzle
- **Deployment:** Vercel serverless
- **Tooling:** ESLint, Prettier, Svelte MCP, Vercel Flags

### Repository Map

- `src/routes` — Pages, layouts, and HTTP endpoints
- `src/lib/question-bank` — Question serving, generation, quality, and refill
- `src/lib/grading/frq` — FRQ attempts and grading
- `src/lib/users`, `src/lib/auth` — Accounts, progress, history, bookmarks
- `src/lib/agent`, `src/lib/tutor`, `src/lib/billing` — Coach, Tutor, study plans, billing
- `src/lib/admin` — Operational dashboards
- `src/lib/server/neon` — Database schema and client
- `scripts` — Operations and maintenance

Neon is the only application database. Domain functions access Drizzle directly. Do not introduce unnecessary architectural layers.

## Engineering Philosophy

Act like a pragmatic senior engineer. Solve the actual problem with the fewest moving parts.

- **YAGNI:** No speculative features, premature abstractions, or unnecessary dependencies.
- **Minimal changes:** Prefer the smallest correct edit. Avoid unrelated refactors and formatting changes.
- **Reuse first:** Follow existing patterns before introducing new utilities, layers, or structures.
- **No overengineering:** Keep simple logic inline. Extract only when complexity or meaningful reuse justifies it.
- **No ceremony:** For clear tasks, implement directly. Plan only when complexity warrants it. Do not invoke Superpowers workflows by default.
- **Proportional effort:** Scale investigation, tool usage, and verification to actual risk and complexity.
- **Correctness:** Never introduce silent failures, fake implementations, or unnecessary breaking changes.

## Subagent Model Selection

Choose subagent models based on the host and task complexity. Delegate focused, independent tasks when useful; avoid unnecessary delegation for simple changes.

### Cursor

| Task weight | Model |
| --- | --- |
| Hard | Grok 4.5 (high) |
| Light | Composer 2.5 |

### Codex

| Task weight | Model |
| --- | --- |
| Hard | 6.1 Sol (low/light effort) |
| Light | 6 Luna (high effort) |

Use the configured models when available. Otherwise, choose the closest suitable alternative.

## Hard Rules

- **Testing:** Do not install Playwright, Cypress, or similar browser testing frameworks. Use Cursor/Codex native browser tools for UI verification.
- **Styling:** Tailwind utilities only. No `<style>` blocks in Svelte components. Shared styles, prose variants, and global keyframes belong in `src/routes/layout.css`. Inline styles are reserved for dynamic runtime values.
- **Flags:** Use existing Vercel Flags, not environment variables as feature-flag substitutes.
- **Serverless:** Do not assume persistent processes, shared memory, or durable local storage across requests.
- **Security:** Validate untrusted input, enforce authorization, and never expose secrets or server-only data.
- **Sync Scan:** Run only after substantial or difficult changes.

## Database Migrations

Schema: `src/lib/server/neon/schema/`

1. Modify Drizzle schema definitions.
2. Run `bun run db:generate`.
3. Review generated SQL and metadata.
4. Run `bun run db:apply` only when applying the migration is in scope and the target environment is confirmed.

Never:

- Hand-write migrations or manually edit `drizzle/meta/_journal.json`.
- Use `drizzle-kit push` unless explicitly requested.
- Modify already-applied migrations.
- Overwrite existing migration history.

If migration numbering conflicts, reconcile the SQL, journal, and snapshots without overwriting existing history.

## Testing

Write the fewest tests necessary to establish meaningful confidence.

- Test public behavior and business logic, not private implementation details.
- Prioritize edge cases, boundaries, failure paths, and high-risk logic.
- Avoid redundant assertions, trivial existence tests, and duplicate coverage.
- Prefer parameterized tests for repetitive input cases.
- Add permanent regression tests for important bugs and business behavior.
- Use temporary tests/scripts for one-off verification; remove them afterward.
- Do not introduce new testing infrastructure without a compelling need.

**Verification:** Small changes need targeted checks; high-risk changes require appropriate tests, type checking, and linting. Never claim checks passed unless executed.

## Svelte MCP

Use Svelte MCP when documentation or framework-specific validation is useful, especially for unfamiliar or complex APIs.

- `list-sections` → Find relevant documentation.
- `get-documentation` → Read only relevant sections.
- `svelte-autofixer` → Validate substantive Svelte changes; resolve actionable errors.
- `playground-link` → Only when explicitly requested.

Skip unnecessary documentation lookups for straightforward changes following existing patterns.

## Browser and External Services

For account-bound browser tasks (Neon, Vercel, integrations), use `.agents/skills/aside-browser/SKILL.md` when available. This connects to the browser I use on this computer.

Prefer CLI/API tools for routine operations. Verify external changes.

## Linear

For tasks linked to Linear issues:

- Set **In Progress** when starting.
- Set **In Review** after implementation and verification.

## Final Response

Briefly summarize changes, verification, and unresolved issues.
