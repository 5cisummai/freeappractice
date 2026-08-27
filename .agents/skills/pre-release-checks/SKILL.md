---
name: pre-release-checks
description: Prepare a Free AP Practice release by updating release notes, passing all quality gates, and opening a PR to main.
---

# Pre-release Checks

Use this skill when preparing a release for Free AP Practice. The requested target version is the release source of truth.

## Release notes and version

1. Inspect the current version declarations, changelog, branch, and working tree. Search for all live version references with `rg`, and preserve unrelated user changes.
2. Review `git log` and focused diffs from the last documented release through the target. Write concise notes from observable user impact: new capabilities, changed workflows, accessibility improvements, reliability users notice, and meaningful UI changes.
3. Exclude implementation-only work such as refactors, dependency updates, CI changes, schema or migration work, internal data-shape changes, tests, and documentation unless the change also produces a user-visible result. Do not invent release notes from commit titles alone when the diff does not support them.
4. Preserve the existing changelog format in `src/routes/(marketing)/changelog/+page.svelte`. Add missing releases newest first, use the project’s existing section names, update “Last Updated” metadata, and retain older historical entries.
5. Synchronize the target version in the project’s live version locations, including:
   - `package.json` (`version`)
   - `src/routes/app/settings/+page.svelte` (`APP_VERSION`)
   - `src/routes/+page.svelte` JSON-LD (`softwareVersion` and `dateModified`)

If a search finds another live version display or metadata field, update it too. Do not rewrite historical version numbers in old changelog entries.

## Branch and quality gates

1. Work on a non-`main` branch. If starting on `main`, create a branch such as `codex/pre-release-<version>` before editing. Do not push release changes directly to `main`.
2. Run the repository-wide formatter first: `bun run format`.
3. Run these four gates in order:
   - `bun run lint`
   - `bun run test:unit`
   - `bun run check`
   - `bun run build`
4. If any gate fails, inspect the actual error, make the smallest correct fix, and rerun the failed gate. After fixes, rerun all four gates in order. Continue until all four pass in the final run; do not suppress failures or weaken checks.
5. Run `git diff --check`. Because the changelog and version metadata live in Svelte files, use the repository-pinned `@sveltejs/mcp` from `package.json` / the lockfile (do not float to latest) and run `npx @sveltejs/mcp svelte-autofixer <changed-svelte-file> --svelte-version 5`, then resolve any issues or suggestions. Do not add browser automation or Playwright.

## Pull request

Only after the changelog, version updates, formatter, and all four quality gates pass:

1. Review `git status` and the final diff. Do not stage or discard unrelated user work.
2. Commit the release changes with a concise message, push the current branch, and create a pull request targeting `main` using the repository’s configured GitHub tooling (for example, `gh pr create --base main`).
3. Include the target version, user-facing release-note summary, and the four passing gate commands in the PR description. Do not merge the PR. Report the PR URL and final verification results.
