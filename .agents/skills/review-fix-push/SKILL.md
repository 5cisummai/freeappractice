---
name: review-fix-push
description: Review this project's branch against main, delegate actionable fixes to subagents, verify them, then commit and push the fixes. Use when asked to review and repair a branch in one pass.
---

# Review, fix, push

Use the `code-review` skill with `main` as its fixed point. Review the committed branch diff from the merge base with an up-to-date `origin/main`, following that skill's Standards and Spec axes. Preserve its separate findings and distinguish documented violations from judgement calls. If no spec can be found, state that limitation; do not invent requirements. Stop if the base cannot be resolved or the committed diff is empty.

Before editing, record the current branch, HEAD, and working-tree status. Preserve unrelated work. If the tree is dirty, use an isolated worktree and a new `codex/` branch from HEAD for the review fixes; leave the original tree untouched. Never commit pre-existing uncommitted changes. Do not push directly to `main`.

Fix concrete, actionable findings from the review. Skip speculative style suggestions unless they expose a real maintainability or behavior problem. Spawn implementation subagents for independent fixes. In Codex, request `gpt-6-luna` with high reasoning. In Cursor, use `gpt-6-luna` with high reasoning if available, otherwise Grok 4.5 with high reasoning. Assign each agent explicit file ownership and tell them others are working in the same codebase, to preserve one another's edits, and to prefer the smallest well-coded fix. Coordinate overlapping findings in one owner or handle them sequentially. Review every agent's patch yourself and correct integration issues.

Follow this repository's `AGENTS.md`, including the Svelte MCP sequence for Svelte work and the ban on Playwright testing. Run focused verification appropriate to the files changed, inspect the final diff, and run `git diff --check`. If a finding cannot be fixed safely, report it and do not claim the review is clean.

Stage only the review fixes, commit with a concise message, and push the working branch to its remote. If there are no valid fixes, do not create an empty commit or push. Report the review findings by axis, fixes, verification, commit, and pushed branch. Do not create a PR or merge unless separately requested.
