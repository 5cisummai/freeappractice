# Free AP Practice — Design System

Canonical visual language for marketing, auth, and the authenticated app. Tokens live in `src/routes/layout.css`. Prefer matching existing reference pages over inventing new patterns.

---

## Principles

1. **Clarity over decoration** — Content leads. Atmosphere supports comprehension; it never competes with the task.
2. **Low friction** — Product promise: practice in two clicks. Generous whitespace, obvious CTAs, minimal steps.
3. **Sans-forward personality** — Display headings use DM Sans; UI/body uses Open Runde. Noto Serif is reserved for exam-like reading and long-form prose.
4. **Motion with respect** — Entrance and hover motion should feel deliberate. Honor `prefers-reduced-motion`. Prefer CSS view-timeline animation helpers over JS scroll observers.
5. **Shared chrome** — Public pages use `PublicShell` (`Topbar` + `SiteFooter`). The app uses the sidebar shell + `PageShell`.

---

## Typography

### Font families

| Role           | Token / class                   | Face                 | Use for                                             |
| -------------- | ------------------------------- | -------------------- | --------------------------------------------------- |
| Body & UI      | `font-sans` (default on `html`) | **Open Runde**       | Labels, buttons, nav, body UI                       |
| Display        | `font-display`                  | **DM Sans Variable** | Page titles, section titles, marketing headlines    |
| Reading / exam | `font-serif`                    | **Noto Serif**       | Question stems, FRQ prompts, long-form article body |

Defined in `src/routes/layout.css`:

```css
--font-sans: 'Open Runde', sans-serif;
--font-display: 'DM Sans Variable', sans-serif;
--font-serif: 'Noto Serif', ui-serif, Georgia, serif;
```

### Heading scale

| Level               | Usage                                | Classes                                                                                                           |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Hero (h1)**       | Landing / campaign heroes            | `font-display text-[2.15rem] leading-[1.15] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]` |
| **Page (h1)**       | Marketing utility + `PublicPageHero` | `font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl`            |
| **App page (h1)**   | `PageShell`                          | `font-display text-3xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl`                        |
| **Section (h2)**    | Major sections / `SectionIntro`      | `font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl`                         |
| **Subsection (h3)** | Cards, FAQ triggers                  | `text-base font-semibold` or `font-display text-xl font-medium tracking-tight sm:text-2xl`                        |
| **Body lead**       | Hero / section intro                 | `text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8` with `max-w-xl`–`max-w-2xl`                   |
| **Body**            | Paragraphs, accordion                | `text-base leading-7`                                                                                             |
| **Exam copy**       | Stems, choices, FRQ                  | `font-serif text-[0.925rem] leading-7 text-foreground/80`                                                         |
| **Small / meta**    | Dates, captions, footer              | `text-sm text-muted-foreground` or `text-xs`                                                                      |

### Emphasis patterns

- **Primary keyword underline** (section headings):  
  `underline decoration-primary/70 decoration-2 underline-offset-4`
- **Inline links**: `underline underline-offset-2` (or `underline-offset-4` in dense UI)
- **Text balance**: add `text-balance` on multi-line headings and leads
- **Hand-drawn accent** (landing hero only): SVG underline under a key word, `text-primary`

### What not to do

- Do not use `font-display` for dense data tables, form labels, or body paragraphs.
- Do not use `font-serif` for chrome, CTAs, or navigation.
- Prefer `font-medium` on display headings; reserve heavier weights for UI emphasis or prose headings inside `.prose`.
- Avoid inventing a fourth typeface.

---

## Color

All colors use **OKLCH** CSS variables (shadcn/ui + brand). Source of truth: `src/routes/layout.css`.

### Brand

| Token             | Value                    | Purpose                                                            |
| ----------------- | ------------------------ | ------------------------------------------------------------------ |
| `--brand-primary` | `oklch(0.546 0.235 262)` | Primary blue-violet; drives `--primary`, `--ring`, sidebar primary |

### Semantic tokens

| Token                            | Light              | Dark                               | Purpose                   |
| -------------------------------- | ------------------ | ---------------------------------- | ------------------------- |
| `--background`                   | White              | Midnight-tinted near-black         | Page canvas               |
| `--foreground`                   | Near-black         | Near-white                         | Primary text              |
| `--primary`                      | Brand              | Brand                              | CTAs, links, focus rings  |
| `--muted` / `--muted-foreground` | Cool gray          | Cool gray                          | Secondary surfaces & text |
| `--card` / `--border`            | White / light gray | Lifted surface / soft white border | Cards, dividers           |
| `--accent`                       | Soft blue wash     | Deeper blue wash                   | Subtle highlights         |
| `--destructive`                  | Red                | Lighter red                        | Errors                    |
| `--sidebar*`                     | Near-white rail    | Darker rail                        | App sidebar               |

Dark mode is applied via `.dark` on `<html>` (`mode-watcher`). Dark surfaces are intentionally **inset**: cards sit slightly above a darker sidebar rail.

### Accent colors (feature cards, testimonials)

Use Tailwind palette tints with dark-mode counterparts:

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

### Super tier

Paid / Coach surfaces use shared utilities in `layout.css`:

| Utility / class              | Role                                       |
| ---------------------------- | ------------------------------------------ |
| `super-tier-gradient`        | Soft violet → fuchsia → cyan wash          |
| `super-text-gradient`        | Gradient clipped text                      |
| `super-tier-gradient-button` | CTA chrome (`SUPER_GRADIENT_BUTTON_CLASS`) |
| `super-tier-gradient-fab`    | Floating action treatment                  |

Do not invent alternate Super gradients; reuse these.

---

## Spacing & layout

### Page shells

**Marketing / public** — use `PublicShell`:

```svelte
<PublicShell>
	<main id="main-content" class="flex-1">
		<!-- content -->
	</main>
</PublicShell>
```

(`src/routes/(marketing)/+layout.svelte` already wraps children in `PublicShell`.)

**App** — sidebar layout + `PageShell` (`max-w-6xl`, `px-5 sm:px-8 lg:px-10`, `py-10 sm:py-12`).

**Auth** — centered minimal layout with `#main-content`; no Topbar/Footer.

### Content width

| Context              | Max width               | Horizontal padding      |
| -------------------- | ----------------------- | ----------------------- |
| Landing sections     | `max-w-7xl`             | `px-5 sm:px-8 lg:px-10` |
| Standard marketing   | `max-w-6xl`–`max-w-7xl` | `px-5 sm:px-8`          |
| Hero copy column     | `max-w-3xl` (centered)  | —                       |
| FAQ / narrow content | `max-w-3xl`             | —                       |
| App `PageShell`      | `max-w-6xl`             | `px-5 sm:px-8 lg:px-10` |

### Vertical rhythm

- Landing main stack: `space-y-20 lg:space-y-24`; outer `pt-24 pb-12 lg:pt-32 lg:pb-16`
- Inner marketing pages: typically `py-14 sm:py-20`
- Section internal gap: `space-y-8` to `space-y-10`
- App pages: `space-y-8` inside `PageShell`

### Radius scale

Base `--radius: 0.625rem` with derived `radius-sm` … `radius-4xl` in `@theme`. Prefer:

- Controls / inputs: default component radius
- Interactive rows: `rounded-xl`
- Marketing cards: `rounded-2xl` or `rounded-3xl`
- Pills / hero badges: `rounded-full`

---

## Surfaces & borders

### Cards

**Marketing cards** (pricing, stories):

```
rounded-3xl border border-border bg-card p-6|p-7 marketing-card-shadow
```

`marketing-card-shadow` is a Tailwind `@utility` — soft layered shadow with dark-mode counterpart.

**Hero practice embed**:

```
rounded-xl border border-border/70 bg-card/45 shadow-md shadow-black/5 backdrop-blur-md
```

**Standard content cards**:

```
rounded-2xl border border-border bg-card
```

**Interactive list rows**:

```
rounded-xl border border-border bg-card px-4 py-3
hover:bg-muted/40 transition-colors
```

### Border opacity

Prefer softened borders on marketing UI: `border-border/60`, `border-border/70`.

### Badges & pills

**Hero eyebrow** — use shared constants from `src/lib/components/marketing/hero-badge.ts`:

- `HERO_BADGE_CLASS` — static
- `HERO_BADGE_LINK_CLASS` — linked (landing)
- `HERO_BADGE_COMPACT_CLASS` — blog / meta

**Status / category**: `Badge variant="outline"` or compact primary-tint pills above.

---

## Buttons & CTAs

Built on shadcn `Button` (`src/lib/components/ui/button`).

### Defaults

- Primary: `variant="default"` (brand fill)
- Secondary: `variant="outline"`
- Quiet: `variant="ghost"`
- Size: `lg` for marketing primary actions; default/`sm` in dense app UI
- Press feedback: built-in `active:scale-[0.97]` — do not stack competing scale transforms

### Shape conventions

- Marketing primary CTAs often stay on the default button radius
- Pill CTAs (`rounded-full px-4`–`px-7`) for Topbar signup, Super upgrade, and campaign heroes
- Super CTAs: `rounded-full` + `SUPER_GRADIENT_BUTTON_CLASS`

### Navigation (Topbar)

- Links: Navigation Menu / ghost treatments
- Sign up: `variant="default" class="rounded-full px-4"`
- Theme toggle: `variant="ghost" size="icon"`

### CTA copy tone

Action-oriented and short: “Sign up free”, “Get Started”, “Ready to practice?” — not “Submit” or “Click here”.

---

## Landing page atmosphere

### Halftone hero

Homepage hero uses `HalftoneBackground` (`@devmischief/shaders-svelte` HalftoneCMYK) over `/hero-bg.webp` / `/hero-bg-dark.webp`, with a light vertical fade (`bg-linear-to-b`) so type stays readable.

- Layer: absolute, `pointer-events-none`, behind content
- **Homepage hero (and footer reuse) only** — do not sprinkle halftone across every marketing page

### Scroll / enter motion

Shared helpers in `src/lib/tw-animate.ts` (tw-animate-css + CSS view timelines):

| Export                  | When                             |
| ----------------------- | -------------------------------- |
| `twAnimateIn`           | Above-the-fold / page-load enter |
| `twAnimateInView`       | Below-the-fold section enter     |
| `twAnimateInViewSubtle` | Dense grids                      |
| `twAnimateInViewZoom`   | Interactive blocks               |

Prefer these class strings over custom JS intersection observers. Respect reduced motion at the OS level.

---

## Section patterns

Reuse these components:

| Component                         | Path                                                         | When to use                             |
| --------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `PublicShell`                     | `#lib/components/layout/public-shell.svelte`                 | Public chrome wrapper                   |
| `Topbar`                          | `#lib/components/layout/topbar.svelte`                       | Via `PublicShell`                       |
| `SiteFooter`                      | `#lib/components/layout/site-footer.svelte`                  | Via `PublicShell`                       |
| `PublicPageHero`                  | `#lib/components/marketing/public-page-hero.svelte`          | Utility marketing pages                 |
| `SectionIntro`                    | `#lib/components/marketing/section-intro.svelte`             | Section title + lead + optional actions |
| `BackToHome`                      | `#lib/components/layout/back-to-home.svelte`                 | Secondary pages with back nav           |
| `LandingHero`                     | `#lib/components/marketing/landing-hero.svelte`              | Homepage only                           |
| `UnlimitedSection`                | `#lib/components/marketing/unlimited-section.svelte`         | Landing product proof                   |
| `SuperSection`                    | `#lib/components/marketing/super-section.svelte`             | Landing Super pitch                     |
| `StudyTeamSection`                | `#lib/components/marketing/study-team-section.svelte`        | Landing org / team                      |
| `AspiringStudentsSection`         | `#lib/components/marketing/aspiring-students-section.svelte` | Landing social proof                    |
| `PricingSection` / `PricingCards` | `#lib/components/marketing/pricing-*.svelte`                 | Pricing                                 |
| `BottomCtaSection`                | `#lib/components/marketing/bottom-cta-section.svelte`        | Closing CTA                             |
| `PageShell`                       | `#lib/components/layout/page-shell.svelte`                   | Authenticated app pages                 |
| `PracticeRunner` / practice shell | `#lib/components/practice/*`                                 | Live practice embeds                    |

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

- Library: **Tabler** (`@tabler/icons-svelte/icons/*`)
- Prefer filled variants for primary UI glyphs when the set provides them (`*-filled`)
- Default size in buttons: `size-4` (via button base styles)
- Standalone: `class="size-4"` or `size-5` in denser chrome

Do not reintroduce Lucide for new work unless a dependency forces it.

---

## Motion & accessibility

### Required checks

1. `prefers-reduced-motion: reduce` — disable or simplify non-essential animation
2. Skip link in root layout — targets `#main-content` on every page
3. Semantic landmarks: `<header>`, `<main id="main-content">`, `<footer>`, `<nav aria-label="…">`
4. Visible focus rings via `ring` / button `focus-visible` styles — do not remove them

### Animation guidance

- Page enter: ~700ms, `ease-out`, fade + slight rise (`twAnimateIn`)
- Scroll enter: view-timeline helpers (`twAnimateInView*`)
- Micro-interactions: 150–300ms; button press scale is already in the primitive
- Ambient loops (halftone, demos): pause or simplify under reduced motion

### Gradients

Use Tailwind v4 linear helpers: `bg-linear-to-*` (not legacy `bg-gradient-to-*`).

---

## App vs. marketing

| Surface                     | Shell                 | Density     | Notes                                               |
| --------------------------- | --------------------- | ----------- | --------------------------------------------------- |
| Marketing                   | `PublicShell`         | Airy        | Display type, softened borders, section motion      |
| App (`src/routes/app/`)     | Sidebar + `PageShell` | Utilitarian | Same tokens; display titles already via `PageShell` |
| Auth (`src/routes/(auth)/`) | Minimal centered      | Focused     | No Topbar/Footer; keep brand tokens                 |

When refreshing app pages, reuse marketing **tokens and typography**, not marketing atmosphere (no halftone, no landing-only section components).

---

## Prose

Long-form content (blog, summer guides) uses the `.prose` class defined in `layout.css` (Tailwind-first exception documented in `AGENTS.md`). For exam-style reading outside prose, prefer `font-serif` utilities directly on question components.

---

## Reference implementations

| Page                | Route                                           | Notes                                             |
| ------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Landing (canonical) | `/`                                             | Halftone hero, live practice embed, section stack |
| Rich marketing      | `/about`, `/summer`, `/super`, `/blog`          | Custom heroes, cards, display type                |
| Utility marketing   | `/subjects`, `/stats`, `/privacy`, `/changelog` | `PublicPageHero` + `BackToHome` where needed      |
| Practice hub        | `/practice/*`                                   | Practice landing + question flow                  |
| App home            | `/app`                                          | `PageShell` + denser product UI                   |

When in doubt: match `/` for **tokens, type, and spacing**; match `/about` or `/super` for **multi-section marketing layouts**; match `/app` for **product density**.

---

## Quick checklist for new pages

- [ ] Correct shell (`PublicShell`, app sidebar + `PageShell`, or auth layout)
- [ ] `<main id="main-content">` landmark
- [ ] `font-display` on the page `<h1>`
- [ ] Secondary copy uses `text-muted-foreground`
- [ ] Container: `max-w-6xl` or `max-w-7xl` with `px-5 sm:px-8` (and `lg:px-10` when matching landing/app)
- [ ] Cards: `rounded-2xl` / `rounded-3xl`, softened borders; `marketing-card-shadow` on marketing cards
- [ ] Motion via `twAnimateIn` / `twAnimateInView*` (not custom scroll JS)
- [ ] Icons from Tabler
- [ ] Super surfaces reuse `super-tier-*` utilities
- [ ] Dark mode checked
- [ ] No halftone / homepage-only atmosphere unless it is the landing hero or footer pattern
- [ ] No `<style>` blocks in `.svelte` files — Tailwind utilities + `layout.css` only
