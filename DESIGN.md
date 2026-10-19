# Free AP Practice — Design System

Canonical visual language for marketing, auth, and the app. Tokens live in `src/routes/layout.css`. Prefer matching existing reference pages over inventing new patterns.

## Principles

1. **Clarity over decoration** — Content leads; atmosphere supports comprehension.
2. **Low friction** — Practice in two clicks: generous whitespace, obvious CTAs, minimal steps.
3. **Sans-forward** — Display: DM Sans. UI/body: Open Runde. Noto Serif only for exam-like reading and long-form prose.
4. **Motion with respect** — Deliberate entrance/hover motion; honor `prefers-reduced-motion`; prefer CSS view-timeline helpers over JS scroll observers.
5. **Shared chrome** — Public: `PublicShell` (`Topbar` + `SiteFooter`). App: sidebar + `PageShell`.

## Typography

| Role | Class | Face | Use |
| --- | --- | --- | --- |
| Body & UI | `font-sans` (default) | Open Runde | Labels, buttons, nav, body |
| Display | `font-display` | DM Sans Variable | Page/section titles, marketing headlines |
| Reading / exam | `font-serif` | Noto Serif | Question stems, FRQ prompts, article body |

```css
--font-sans: 'Open Runde', sans-serif;
--font-display: 'DM Sans Variable', sans-serif;
--font-serif: 'Noto Serif', ui-serif, Georgia, serif;
```

### Heading scale

| Level | Classes |
| --- | --- |
| Hero h1 | `font-display text-[2.15rem] leading-[1.15] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]` |
| Marketing page h1 | `font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl` |
| App page h1 | `font-display text-3xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl` |
| Section h2 | `font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl` |
| Subsection h3 | `text-base font-semibold` or `font-display text-xl font-medium tracking-tight sm:text-2xl` |
| Body lead | `text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8` + `max-w-xl`–`max-w-2xl` |
| Body | `text-base leading-7` |
| Exam copy | `font-serif text-[0.925rem] leading-7 text-foreground/80` |
| Meta | `text-sm text-muted-foreground` or `text-xs` |

**Emphasis:** primary keyword underline `underline decoration-primary/70 decoration-2 underline-offset-4`; links `underline underline-offset-2` (or `4` in dense UI); `text-balance` on multi-line headings; landing hero only may use an SVG hand-drawn accent under a key word.

**Avoid:** `font-display` on dense tables/labels/body; `font-serif` on chrome/CTAs/nav; inventing a fourth typeface. Prefer `font-medium` on display headings.

## Color

OKLCH tokens in `src/routes/layout.css` (shadcn + brand). Dark mode via `.dark` on `<html>` (`mode-watcher`). Cards sit slightly above a darker sidebar rail in dark mode.

| Token | Purpose |
| --- | --- |
| `--brand-primary` `oklch(0.546 0.235 262)` | Brand blue-violet; drives `--primary`, `--ring`, sidebar primary |
| `--background` / `--foreground` | Page canvas / primary text |
| `--primary` | CTAs, links, focus rings |
| `--muted` / `--muted-foreground` | Secondary surfaces & text |
| `--card` / `--border` | Cards, dividers |
| `--accent` | Subtle highlights |
| `--destructive` | Errors |
| `--sidebar*` | App sidebar rail |

**Feature-card tints:** `bg-sky-100 dark:bg-sky-950/50`, `bg-amber-50 dark:bg-amber-950/40`, `bg-emerald-100 dark:bg-emerald-950/50`, `bg-violet-100 dark:bg-violet-950/50`, `bg-rose-100 dark:bg-rose-950/50`.

**Feedback:** correct → `border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30` + `text-emerald-600 dark:text-emerald-400`; warning → `text-amber-600 dark:text-amber-400`.

**Super (reuse only — do not invent new gradients):** `super-tier-gradient`, `super-text-gradient`, `super-tier-gradient-button` (`SUPER_GRADIENT_BUTTON_CLASS`), `super-tier-gradient-fab`.

## Spacing & layout

| Shell | Pattern |
| --- | --- |
| Marketing | `PublicShell` → `<main id="main-content">` (marketing layout already wraps) |
| App | Sidebar + `PageShell` (`max-w-6xl`, `px-5 sm:px-8 lg:px-10`, `py-10 sm:py-12`) |
| Auth | Centered `#main-content`; no Topbar/Footer |

| Context | Max width | Padding |
| --- | --- | --- |
| Landing sections | `max-w-7xl` | `px-5 sm:px-8 lg:px-10` |
| Standard marketing | `max-w-6xl`–`max-w-7xl` | `px-5 sm:px-8` |
| Hero / FAQ / narrow | `max-w-3xl` | — |
| App `PageShell` | `max-w-6xl` | `px-5 sm:px-8 lg:px-10` |

**Vertical rhythm:** landing stack `space-y-20 lg:space-y-24`, outer `pt-24 pb-12 lg:pt-32 lg:pb-16`; inner marketing `py-14 sm:py-20`; sections `space-y-8`–`space-y-10`; app `space-y-8` in `PageShell`.

**Radius:** `--radius: 0.625rem`. Controls use component default; rows `rounded-xl`; marketing cards `rounded-2xl`/`rounded-3xl`; pills `rounded-full`.

## Surfaces

| Pattern | Classes |
| --- | --- |
| Marketing card | `rounded-3xl border border-border bg-card p-6|p-7 marketing-card-shadow` |
| Hero practice embed | `rounded-xl border border-border/70 bg-card/45 shadow-md shadow-black/5 backdrop-blur-md` |
| Standard card | `rounded-2xl border border-border bg-card` |
| Interactive row | `rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors` |

Prefer softened borders on marketing UI (`border-border/60`–`/70`).

**Badges:** `HERO_BADGE_CLASS`, `HERO_BADGE_LINK_CLASS`, `HERO_BADGE_COMPACT_CLASS` from `src/lib/components/marketing/hero-badge.ts`. Status: `Badge variant="outline"` or compact primary-tint pills.

## Buttons & CTAs

shadcn `Button` (`src/lib/components/ui/button`).

- Primary `default`, secondary `outline`, quiet `ghost`
- Marketing primary: `lg`; dense app: default/`sm`
- Built-in `active:scale-[0.97]` — do not stack competing scales
- Pill CTAs (`rounded-full px-4`–`px-7`) for Topbar signup, Super upgrade, campaign heroes
- Super: `rounded-full` + `SUPER_GRADIENT_BUTTON_CLASS`
- Topbar: nav links ghost/menu; signup `variant="default" class="rounded-full px-4"`; theme `ghost` `icon`
- Copy: short and action-oriented (“Sign up free”, “Get Started”) — not “Submit” / “Click here”

## Landing atmosphere

**Halftone hero:** `HalftoneBackground` over `/hero-bg.webp` / `/hero-bg-dark.webp` with a light vertical fade for readability. Absolute, `pointer-events-none`, behind content. **Homepage hero and footer reuse only.**

**Motion helpers** (`src/lib/tw-animate.ts`):

| Export | When |
| --- | --- |
| `twAnimateIn` | Above-the-fold / page-load |
| `twAnimateInView` | Below-the-fold sections |
| `twAnimateInViewSubtle` | Dense grids |
| `twAnimateInViewZoom` | Interactive blocks |

Prefer these over custom intersection observers.

## Components

| Component | When |
| --- | --- |
| `PublicShell` / `Topbar` / `SiteFooter` | Public chrome |
| `PublicPageHero` | Utility marketing pages |
| `SectionIntro` | Section title + lead + optional actions |
| `BackToHome` | Secondary pages |
| `LandingHero`, `UnlimitedSection`, `SuperSection`, `StudyTeamSection`, `AspiringStudentsSection`, `PricingSection`/`PricingCards`, `BottomCtaSection` | Landing sections |
| `PageShell` | Authenticated app pages |
| `PracticeRunner` / `practice/*` | Live practice embeds |

Paths under `#lib/components/{layout,marketing,practice}/`.

**FAQ:**

```svelte
<section class="mx-auto w-full max-w-3xl space-y-4">
	<h2 class="text-2xl font-semibold tracking-tight">FAQ</h2>
	<Accordion.Root
		type="single"
		class="rounded-xl border border-border/70 bg-card px-4 transition-shadow duration-300 hover:shadow-sm"
	>
		…
	</Accordion.Root>
</section>
```

## Icons

Tabler (`@tabler/icons-svelte/icons/*`). Prefer filled variants when available. Default `size-4` in buttons; `size-4`/`size-5` standalone. Do not reintroduce Lucide for new work unless a dependency forces it.

## Motion & accessibility

1. Honor `prefers-reduced-motion: reduce` (pause/simplify ambient loops).
2. Skip link → `#main-content` on every page.
3. Landmarks: `<header>`, `<main id="main-content">`, `<footer>`, `<nav aria-label="…">`.
4. Keep visible `focus-visible` / ring styles.

Timing: page enter ~700ms `ease-out` fade+rise; micro-interactions 150–300ms. Gradients: Tailwind v4 `bg-linear-to-*` (not legacy `bg-gradient-to-*`).

## App vs marketing

| Surface | Shell | Density | Notes |
| --- | --- | --- | --- |
| Marketing | `PublicShell` | Airy | Display type, softened borders, section motion |
| App (`/app`) | Sidebar + `PageShell` | Utilitarian | Same tokens; no marketing atmosphere |
| Auth | Minimal centered | Focused | No Topbar/Footer; keep brand tokens |

Reuse marketing **tokens and typography** in the app — not halftone or landing-only section components.

## Prose

Long-form (blog, guides): `.prose` in `layout.css`. Exam-style reading outside prose: `font-serif` on question components.

## Reference pages

| Page | Route | Match for |
| --- | --- | --- |
| Landing | `/` | Tokens, type, spacing, halftone + section stack |
| Rich marketing | `/about`, `/summer`, `/super`, `/blog` | Multi-section layouts |
| Utility marketing | `/subjects`, `/stats`, `/privacy`, `/changelog` | `PublicPageHero` + `BackToHome` |
| Practice | `/practice/*` | Practice flow |
| App home | `/app` | Product density |

When unsure: `/` for tokens/type/spacing; `/about` or `/super` for multi-section marketing; `/app` for product density.

## New page checklist

- [ ] Correct shell (`PublicShell`, sidebar + `PageShell`, or auth)
- [ ] `<main id="main-content">`
- [ ] `font-display` on page `<h1>`; secondary copy `text-muted-foreground`
- [ ] Container `max-w-6xl`/`max-w-7xl` with `px-5 sm:px-8` (+ `lg:px-10` when matching landing/app)
- [ ] Cards `rounded-2xl`/`rounded-3xl`, softened borders; `marketing-card-shadow` on marketing cards
- [ ] Motion via `twAnimateIn` / `twAnimateInView*` (not custom scroll JS)
- [ ] Tabler icons; Super surfaces use `super-tier-*` only
- [ ] Dark mode checked; no homepage-only atmosphere off the landing/footer pattern
- [ ] No `<style>` blocks in `.svelte` — Tailwind + `layout.css` only
