# Components directory

Feature-specific UI lives in named subfolders. Shared primitives live under `ui/`. Import with full paths, e.g. `$lib/components/questions/question-card.svelte`.

## App features

| Folder | Purpose | Key files |
| --- | --- | --- |
| `questions/` | Question practice UI — card, selection, tools | `question-card.svelte`, `question-card-session.svelte.ts`, `question-shell.svelte`, `question-selector.svelte`, `mcq-answer-choices.svelte`, `frq-card.svelte`, `bug-report-dialog.svelte`, `desmos-calculator.svelte`, `reference-sheet.svelte` |
| `practice/` | Practice chrome + public landing pages | `practice-shell.svelte` (MCQ/FRQ orchestrator), `practice-landing.svelte`, `practice-breadcrumbs.svelte`, `practice-hub-nav.svelte` |
| `history/` | Question attempt history tables and detail sheet | `history-data-table.svelte`, `history-detail-sheet.svelte`, `history-columns.ts` |
| `admin/` | Admin dashboard tables and cache UI | `admin-users-data-table.svelte`, `admin-cache-dashboard.svelte` |

## Shared components

| File | Purpose |
| --- | --- |
| `content/rich-text.svelte` | Markdown, math, and code rendering — used by questions, history, and tutor |
| `questions/tutor-widget.svelte` | In-question AI tutor panel |
| `history/progress-history-panel.svelte` | Progress dashboard history panel |

## Marketing & content

| Folder | Purpose | Key files |
| --- | --- | --- |
| `marketing/` | Landing page sections and banners | `features-section.svelte`, `aspiring-students-section.svelte`, `bottom-cta-section.svelte`, `public-page-hero.svelte`, `invite-banner.svelte`, `signature.svelte` |
| `blog/` | Blog index and post pages | `blog-post-card.svelte`, `blog-related-links.svelte` |

## Shell & auth

| Folder | Purpose | Key files |
| --- | --- | --- |
| `layout/` | Site chrome and app shell | `topbar.svelte`, `site-footer.svelte`, `page-shell.svelte`, `app-sidebar.svelte`, `nav-user.svelte`, `theme-toggle.svelte`, `skip-to-main.svelte`, `back-to-home.svelte`, `referral-card.svelte` |
| `auth/` | Sign-in and sign-up flows | `login-form.svelte`, `signup-form.svelte`, `google-logo.svelte`, `google-one-tap-prompt.svelte` |

## Design system

| Folder | Purpose |
| --- | --- |
| `ui/` | shadcn-svelte primitives — `button`, `card`, `dialog`, `sidebar`, `data-table`, etc. Import from each component's `index.js`. |

## Where to put new components

- **Question or practice flow** → `questions/` or `practice/`
- **A page section on the marketing site** → `marketing/` or `blog/`
- **Navigation, footer, or app chrome** → `layout/`
- **Login / signup** → `auth/`
- **Reusable rich content rendering** → `content/rich-text.svelte`
- **Standalone feature widget with no siblings yet** → root of `components/`
- **Generic button, dialog, table, etc.** → `ui/` (via shadcn-svelte CLI)

## Related modules (outside this folder)

- Question types and props: `$lib/questions/types.ts`
