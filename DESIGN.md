# Free AP Practice — Design System

Design language derived from the landing page (`src/routes/+page.svelte`) and its shared marketing components. Use this document when building or refreshing any public-facing page.

---

## Principles

1. **Clarity over decoration** — Content leads. Visual flair supports comprehension, never competes with it.
2. **Low friction** — The product promise is “2 clicks to practice.” UI should feel immediate: generous whitespace, obvious CTAs, minimal steps.
3. **Warm but credible** — Serif display headings add personality; sans-serif body text keeps things readable and trustworthy.
4. **Motion with respect** — Entrance animations and hover states delight, but always honor `prefers-reduced-motion` and the `reduce-motion` body class.
5. **Consistent chrome** — Public pages share `Topbar` + `SiteFooter`. The app area uses its own sidebar shell (see [App vs. marketing](#app-vs-marketing)).

---

## Typography

### Font families

| Role             | Token / class                   | Face                          |
| ---------------- | ------------------------------- | ----------------------------- |
| Body & UI        | `font-sans` (default on `html`) | **Geist Variable**            |
| Display headings | `font-display`                  | **Fraunces Variable** (serif) |

Defined in `src/routes/layout.css`:

```css
--font-sans: 'Geist Variable', sans-serif;
--font-display: 'Fraunces Variable', ui-serif, Georgia, serif;
```

### Heading scale

| Level               | Usage                         | Classes                                                                                                |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Hero (h1)**       | Page title, landing hero      | `font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl` |
| **Section (h2)**    | Major sections                | `font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl`              |
| **Subsection (h3)** | Card titles, FAQ triggers     | `text-base font-semibold` or `text-xl font-semibold tracking-tight sm:text-2xl`                        |
| **Body lead**       | Hero / section intro          | `text-base leading-8 text-muted-foreground sm:text-lg` with `max-w-2xl`                                |
| **Body**            | Paragraphs, accordion content | `text-base leading-7`                                                                                  |
| **Small / meta**    | Dates, captions, footer       | `text-sm text-muted-foreground` or `text-xs`                                                           |

### Emphasis patterns

- **Primary keyword underline** (section headings):  
  `underline decoration-primary/70 decoration-2 underline-offset-4`
- **Inline links**: `underline underline-offset-2` (or `underline-offset-4` in dense UI)
- **Text balance**: add `text-balance` on multi-line headings and leads

### What not to do

- Do not use `font-display` for body copy, labels, or dense data tables.
- Do not use raw `font-bold` on display headings — use `font-medium` for the serif voice.
- Avoid `text-2xl font-semibold` for page titles on marketing pages (that pattern belongs to the app `PageShell`).

---

## Color

All colors use **OKLCH** CSS variables (shadcn/ui palette). Source of truth: `src/routes/layout.css`.

### Semantic tokens

| Token                            | Light              | Purpose                   |
| -------------------------------- | ------------------ | ------------------------- |
| `--background`                   | White              | Page background           |
| `--foreground`                   | Near-black         | Primary text              |
| `--primary`                      | Blue-violet        | CTAs, links, accents      |
| `--muted` / `--muted-foreground` | Gray               | Secondary surfaces & text |
| `--card` / `--border`            | White / light gray | Cards, dividers           |
| `--destructive`                  | Red                | Errors                    |

Dark mode is applied via `.dark` on `<html>` (handled by `mode-watcher`).

### Accent colors (feature cards, testimonials)

Use **Tailwind palette tints** for decorative surfaces — always with dark-mode counterparts:

```
bg-sky-100 dark:bg-sky-950/50
bg-amber-50 dark:bg-amber-950/40
bg-emerald-100 dark:bg-emerald-950/50
bg-violet-100 dark:bg-violet-950/50
bg-rose-100 dark:bg-rose-950/50
```

Feedback states:

- **Correct**: `border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30`, text `text-emerald-600 dark:text-emerald-400`
- **Review / warning**: `text-amber-600 dark:text-amber-400`

### Atmospheric gradients

Landing feature section uses a soft blurred gradient blob:

```
bg-gradient-to-br from-sky-200/40 via-violet-200/30 to-rose-200/30 blur-3xl
dark:from-sky-900/20 dark:via-violet-900/15 dark:to-rose-900/15
```

Apply behind content with `pointer-events-none absolute -z-10` — never as a full-page background wash.

---

## Spacing & layout

### Page shell (marketing)

```html
<div class="relative isolate flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />
	<main id="main-content" class="flex-1">
		<!-- content -->
	</main>
	<SiteFooter />
</div>
```

### Content width

| Context                 | Max width                             | Horizontal padding      |
| ----------------------- | ------------------------------------- | ----------------------- |
| Landing page sections   | `max-w-7xl`                           | `px-5 sm:px-8 lg:px-10` |
| Standard marketing page | `max-w-6xl`                           | `px-5 sm:px-8`          |
| Hero / prose column     | `max-w-3xl` (centered with `mx-auto`) | —                       |
| FAQ / narrow content    | `max-w-3xl`                           | —                       |

### Vertical rhythm

- Landing main: `space-y-20 lg:space-y-24` between major sections; `py-12 lg:py-16` page padding
- Inner marketing pages: `py-14 sm:py-20`
- Section internal gap: `space-y-8` to `space-y-10`

---

## Surfaces & borders

### Cards

**Feature / marketing cards** (landing):

```
rounded-3xl border border-border/60 bg-card shadow-sm
```

Inner preview area (mock UI inside card):

```
bg-muted/50
```

**Standard content cards** (about, subjects):

```
rounded-2xl border border-border bg-card
```

**Interactive list rows**:

```
rounded-xl border border-border bg-card px-4 py-3
hover:bg-muted/40 transition-colors
```

### Border opacity

Prefer softened borders on marketing UI: `border-border/60`, `border-border/70` rather than full-strength `border-border`.

### Badges & pills

**Hero trust pills**:

```
rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 text-base
hover:scale-105 hover:border-primary/30
```

**Status / category badge**:

```
rounded-full px-4 py-1 text-sm font-normal  (Badge variant="outline")
```

**Subject pills** (decorative): `rounded-full px-2 py-0.5 text-[0.62rem] font-medium` with rotating accent backgrounds.

---

## Buttons & CTAs

Built on shadcn `Button` (`src/lib/components/ui/button`).

### Primary CTA

- Size: `size="lg"`
- Shape: `rounded-full px-6`
- Optional icon with hover nudge: `group-hover:translate-x-0.5`
- Subtle hover scale on hero CTAs: `hover:scale-[1.02]`

### Secondary CTA

- `variant="outline" size="lg" class="rounded-full px-6"`

### Navigation (Topbar)

- Links: `variant="ghost"`
- Sign up: `variant="default" class="rounded-full px-4"`
- Theme toggle: `variant="ghost" size="icon"`

### CTA copy tone

Action-oriented and short: “Get Started”, “Read more”, “Ready to practice?” — not “Submit” or “Click here”.

---

## Landing page atmosphere

### Dot grid background

Fixed parallax dot pattern behind the hero. Defined on the landing page:

- Grid: `2rem × 2rem` radial dots at 15% foreground opacity (5% in dark mode)
- Parallax: `scrollY * -0.35`, disabled when reduced motion
- Shimmer: `landing-dot-shimmer` (8s opacity pulse)
- Layer: `fixed -z-10 pointer-events-none`, height ~130vh

**Use only on the homepage.** Other pages use plain `bg-background`.

### Scroll reveal

Action: `use:scrollReveal` from `src/lib/actions/scroll-reveal.ts`

CSS classes in `layout.css`:

- `.reveal-hidden` → `.reveal-visible` (fade + translate up)
- `.reveal-scale` variant adds subtle scale

Stagger cards with `{ delay: 80 }` increments (0, 80, 160, …).

Hero uses `animate-in` from `tw-animate-css` with staggered delays instead of scroll reveal.

---

## Section patterns

Reuse these components on marketing pages:

| Component                 | Path                                                         | When to use                              |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `Topbar`                  | `$lib/components/layout/topbar.svelte`                       | All public pages                         |
| `SiteFooter`              | `$lib/components/layout/site-footer.svelte`                  | All public pages                         |
| `PublicPageHero`          | `$lib/components/marketing/public-page-hero.svelte`          | Utility pages (privacy, stats, subjects) |
| `BackToHome`              | `$lib/components/layout/back-to-home.svelte`                 | Secondary pages with back navigation     |
| `FeaturesSection`         | `$lib/components/marketing/features-section.svelte`          | Landing only                             |
| `AspiringStudentsSection` | `$lib/components/marketing/aspiring-students-section.svelte` | Landing only                             |
| `BottomCtaSection`        | `$lib/components/marketing/bottom-cta-section.svelte`        | Landing / long-form pages                |
| `QuestionShell`           | `$lib/components/questions/question-shell.svelte`            | Landing + practice pages                 |
| `BlogPostCard`            | `$lib/components/blog/blog-post-card.svelte`                 | Blog index                               |

### FAQ block

```
<section class="mx-auto w-full max-w-3xl space-y-4">
  <h2 class="text-2xl font-semibold tracking-tight">FAQ</h2>
  <Accordion.Root
    type="single"
    class="rounded-xl border border-border/70 bg-card px-4 transition-shadow duration-300 hover:shadow-sm"
  >
    ...
  </Accordion.Root>
</section>
```

---

## Icons

- Library: **Lucide** (`@lucide/svelte/icons/*`)
- Default size in buttons: `size-4` (via button base styles)
- Standalone: `class="size-4"` or `h-5 w-5` in topbar

---

## Motion & accessibility

### Required checks

1. `prefers-reduced-motion: reduce` — animations disabled in CSS
2. `body.reduce-motion` — user setting from accessibility preferences; same effect
3. `SkipToMain` link in root layout — target `#main-content` on every page
4. Semantic landmarks: `<header>`, `<main id="main-content">`, `<footer>`, `<nav aria-label="…">`

### Animation easing

Preferred curve for custom transitions:

```
cubic-bezier(0.22, 1, 0.36, 1)
```

Duration: 300–750ms for UI; 8–18s for ambient loops.

### Hover lifts

Cards: `translateY(-3px)` + soft shadow on hover (see `.feature-card` in `features-section.svelte`). Disable under reduced motion.

---

## App vs. marketing

The authenticated app (`src/routes/app/`) uses a **sidebar layout** and `PageShell` — intentionally denser and utilitarian. When refreshing app pages, adopt marketing **tokens and typography** (`font-display` for page titles, softened borders) but keep the sidebar shell.

`PageShell` today uses `text-2xl font-semibold` — migrating to `font-display` would align it with this system.

Auth pages (`/login`, `/signup`, etc.) currently use a minimal centered layout **without** Topbar/Footer. To align with this design system, wrap them in the marketing shell or a dedicated `AuthLayout` that shares Topbar + background tokens.

---

## Reference implementations

| Page                | Route                             | Notes                                                  |
| ------------------- | --------------------------------- | ------------------------------------------------------ |
| Landing (canonical) | `/`                               | Dot grid, hero animation, all section components       |
| Rich marketing      | `/about`, `/summer`, `/blog`      | Custom heroes, card grids, `font-display`              |
| Utility marketing   | `/subjects`, `/stats`, `/privacy` | Topbar + `PublicPageHero` + `BackToHome`               |
| Practice hub        | `/practice/*`                     | `PracticeLanding` — breadcrumbs, hero, `QuestionShell` |

When in doubt, match the landing page for **tokens, typography, and spacing**; match `/about` for **multi-section marketing layouts**.

---

## Quick checklist for new pages

- [ ] `Topbar` + `SiteFooter` (public pages)
- [ ] `<main id="main-content">` landmark
- [ ] `font-display` on the page `<h1>`
- [ ] Body text uses `text-muted-foreground` for secondary copy
- [ ] Container: `max-w-6xl` or `max-w-7xl` with `px-5 sm:px-8`
- [ ] Cards: `rounded-2xl` or `rounded-3xl`, `border-border/60`
- [ ] Primary buttons: `rounded-full`
- [ ] Scroll reveal on below-fold sections (or skip if reduced motion)
- [ ] Dark mode tested
- [ ] No dot grid unless it is the homepage
