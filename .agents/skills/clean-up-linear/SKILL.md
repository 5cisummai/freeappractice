---
name: clean-up-linear
description: Reconcile Linear issue status with GitHub/main by marking landed In Review, In Progress, and Todo work Done. Use when cleaning up Linear, syncing issue status after merges, or auditing stale In Review / In Progress / Todo issues.
---

# Clean Up Linear

Reconcile open Linear issues with what already landed. Prefer evidence from linked PRs and `main` over titles or guesses.

## Scope

1. Default: issues assigned to `me`.
2. If the user asks for the whole team/workspace, drop the assignee filter.
3. Process these states in order: **In Review** → **In Progress** → **Todo**.
4. Skip Done, Canceled, Duplicate, and Backlog unless the user asks to include them.

## Tools

- Linear MCP (`plugin-linear-linear`): `list_issues`, `get_issue`, `save_issue`.
- GitHub via `gh` (and GitHub MCP if available): PR state, merge commit, head branch.
- Local git only as a secondary check against `origin/main`.

## Workflow

Copy and track:

```
Linear cleanup:
- [ ] List In Review / In Progress / Todo
- [ ] Inspect each issue for PR / main evidence
- [ ] Update landed issues to Done
- [ ] Leave ambiguous issues untouched and report them
- [ ] Summarize changes
```

### 1. List candidates

For each state (`In Review`, `In Progress`, `Todo`), call `list_issues` with:

- `assignee: "me"` unless whole-workspace mode
- `orderBy: "updatedAt"`
- fields: `id`, `title`, `status`, `priority`, `url`, `project`, `updatedAt`, `description`

Paginate until complete.

### 2. Decide status from evidence

For each issue, open it with `get_issue` when attachments/description are needed. Collect linked GitHub PR URLs from attachments, description, and comments.

Classify:

| Evidence | Action |
| -------- | ------ |
| Any linked PR is **MERGED** into the default branch, or the fix commit is on `origin/main` | Set status to **Done** |
| Issue is explicitly superseded and a duplicate of a Done/merged issue | Set **Duplicate** (or cancel only if Linear workflow already uses Canceled for that) and link `duplicateOf` when possible |
| Linked PRs are **OPEN** / draft, or work is still unfinished | Leave status unchanged |
| No linked PR and no clear main evidence | Leave unchanged; list under **Needs review** |
| Work abandoned with user confirmation only | Do not auto-cancel |

Rules:

- Do **not** mark Done from “sounds finished” language alone.
- Do **not** reopen Done issues.
- Prefer the consolidating/superseding PR when several drafts exist.
- For Sentry/noise issues: Done only when the ignore/fix PR merged (or the issue was intentionally closed as won’t-fix with an explicit decision already recorded).

### 3. Update Linear

For each landed issue:

1. `save_issue` with `id` and `state: "Done"`.
2. Optionally append a short note only when useful (merged PR number). Prefer status change over rewriting the whole description.

Do not edit labels, assignees, or projects unless the user asked.

### 4. Report

Return a short summary:

- **Marked Done** — id, title, evidence (PR # / merge)
- **Left open** — id, title, why (open PR, no evidence, still in progress)
- **Needs review** — ambiguous items for the user
- Counts by previous state

## Guardrails

- Never invent merges or claim CI/deploy verification you did not check.
- Never bulk-cancel Todo/In Progress without clear duplicate/supersede evidence.
- If Linear MCP is unavailable, stop and say so; do not fake updates.
- Keep the pass proportional: batch `list_issues`, then inspect only issues that might be closable.
